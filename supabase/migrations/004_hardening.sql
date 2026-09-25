-- 004_hardening: fix findings from adversarial audit. All additive/idempotent.

-- F3/F4: enable RLS where missing (policies on capabilities already exist in 003
-- and activate once RLS is on; profiles/mission_stages get both).
alter table if exists capabilities enable row level security;
alter table if exists profiles enable row level security;
alter table if exists mission_stages enable row level security;

do $$ begin
  if to_regclass('public.profiles') is not null then
    create policy "read_all_authenticated" on profiles for select to authenticated using (true);
  else
    raise notice 'skipping profiles policy: table not present (no auth.users)';
  end if;
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read_all_authenticated" on mission_stages for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- Writes remain service-role-only (service_role bypasses RLS). Authenticated
-- direct writes are denied everywhere, including ledger_entries (append-only
-- via API). This is intended: see AGENTS.md.

-- F8 comment correction is documentary; no SQL needed (deny-by-default stands).

-- F9: updated_at auto-maintenance.
create or replace function set_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_contracts_updated on contracts;
create trigger trg_contracts_updated before update on contracts for each row execute function set_updated_at();
drop trigger if exists trg_tasks_updated on tasks;
create trigger trg_tasks_updated before update on tasks for each row execute function set_updated_at();
drop trigger if exists trg_missions_updated on missions;
create trigger trg_missions_updated before update on missions for each row execute function set_updated_at();
drop trigger if exists trg_reputations_updated on reputations;
create trigger trg_reputations_updated before update on reputations for each row execute function set_updated_at();

-- F10: FK supporting indexes.
create index if not exists idx_services_provider on services(provider_id);
create index if not exists idx_services_cap on services(capability_id);
create index if not exists idx_requests_requester on requests(requester_id);
create index if not exists idx_requests_world on requests(world_id);
create index if not exists idx_contracts_request on contracts(request_id);
create index if not exists idx_contracts_service on contracts(service_id);
create index if not exists idx_contracts_parties on contracts(requester_id, provider_id);
create index if not exists idx_tasks_contract on tasks(contract_id);
create index if not exists idx_tasks_assignee on tasks(assignee_id);
create index if not exists idx_artifacts_task on artifacts(task_id);
create index if not exists idx_artifacts_contract on artifacts(contract_id);
create index if not exists idx_verifications_artifact on verifications(artifact_id);
create index if not exists idx_verifications_contract on verifications(contract_id);
create index if not exists idx_ledger_contract on ledger_entries(contract_id);
create index if not exists idx_ledger_from on ledger_entries(from_principal_id);
create index if not exists idx_ledger_to on ledger_entries(to_principal_id);
create index if not exists idx_missions_request on missions(request_id);
create index if not exists idx_missions_world on missions(world_id);
create index if not exists idx_stages_mission on mission_stages(mission_id);
create index if not exists idx_stages_task on mission_stages(task_id);
create index if not exists idx_decisions_mission on decisions(mission_id);
create index if not exists idx_decisions_contract on decisions(contract_id);
do $$ begin
  if to_regclass('public.profiles') is not null then
    create index if not exists idx_profiles_principal on profiles(principal_id);
  end if;
end $$;
create index if not exists idx_principals_world on principals(world_id);

-- F11a: constrain mission status/stage vocabularies.
do $$ begin
  alter table missions add constraint missions_status_check
    check (status in ('open','running','decided','closed','cancelled'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table mission_stages add constraint mission_stages_stage_check
    check (stage in ('research','debate','falsify','synthesize','decide','plan','execute','learn'));
exception when duplicate_object then null; end $$;

-- F11b: domain_events id uniqueness (seq stays PK for ordering).
do $$ begin
  alter table domain_events add constraint domain_events_id_unique unique (id);
exception when duplicate_object then null; end $$;
-- NOTE: actor_id stays text (not uuid FK): system actors 'ledger'/'reputation'
-- are not principals rows. Do not convert to uuid.

-- F12: worlds seed rows live here too (idempotent; 001 tables FK to worlds).
insert into worlds(id, kind) values ('production','production') on conflict (id) do nothing;
insert into worlds(id, kind) values ('sim:fast-001','simulation') on conflict (id) do nothing;

-- Treasury mint principal (matches TREASURY_ID in @neon/domain). One row per world.
insert into principals(id, kind, display_name, world_id)
values ('00000000-0000-0000-0000-000000000000','org','Treasury','production')
on conflict (id) do nothing;
-- NOTE: same uuid cannot repeat per world (principals PK is id); multi-world
-- mints reuse this single treasury row. Ledger world_id carries the partition.

-- Approval requests: human approval boundary storage (tools/settleContract binds
-- approval.action + approval.paramsHash before queueing).
do $$ begin
  create type approval_status as enum ('pending','approved','rejected','expired');
exception when duplicate_object then null; end $$;

create table if not exists approval_requests (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  params_hash text not null,
  params jsonb not null default '{}',
  status approval_status not null default 'pending',
  contract_id uuid references contracts(id) on delete set null,
  requester_id uuid references principals(id) on delete set null,
  approver_id uuid references principals(id) on delete set null,
  world_id text not null default 'production' references worlds(id),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists idx_approvals_contract on approval_requests(contract_id);
create index if not exists idx_approvals_status on approval_requests(status);
alter table approval_requests enable row level security;
do $$ begin
  create policy "read_all_authenticated" on approval_requests for select to authenticated using (true);
exception when duplicate_object then null; end $$;
