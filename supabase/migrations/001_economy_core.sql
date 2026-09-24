-- 001_economy_core: vertical flow tables. Backward-compatible base.
create extension if not exists "pgcrypto";

do $$ begin
  create type principal_kind as enum ('human','agent','org');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_kind as enum ('service_hire','mission_investigation','custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('open','matched','closed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type contract_status as enum ('draft','offered','agreed','active','fulfilled','settled','disputed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('pending','running','awaiting_verification','succeeded','failed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type verification_verdict as enum ('pass','partial','fail');
exception when duplicate_object then null; end $$;

create table if not exists worlds (
  id text primary key,
  kind text not null default 'production',
  created_at timestamptz not null default now()
);

create table if not exists principals (
  id uuid primary key default gen_random_uuid(),
  kind principal_kind not null,
  display_name text not null,
  world_id text not null default 'production' references worlds(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists capabilities (
  id text primary key,
  name text not null,
  version text not null default '1.0.0',
  input_schema_ref text not null default '{}',
  output_schema_ref text not null default '{}'
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references principals(id) on delete restrict,
  capability_id text not null references capabilities(id),
  title text not null,
  description text not null default '',
  price_credits integer not null default 0 check (price_credits >= 0),
  agent_card jsonb not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references principals(id) on delete restrict,
  kind request_kind not null default 'service_hire',
  capability_id text not null references capabilities(id),
  title text not null,
  details text not null default '',
  budget_credits integer not null default 0 check (budget_credits >= 0),
  status request_status not null default 'open',
  world_id text not null default 'production' references worlds(id),
  created_at timestamptz not null default now()
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete restrict,
  service_id uuid not null references services(id) on delete restrict,
  requester_id uuid not null references principals(id) on delete restrict,
  provider_id uuid not null references principals(id) on delete restrict,
  price_credits integer not null check (price_credits >= 0),
  terms text not null default '',
  status contract_status not null default 'draft',
  world_id text not null default 'production' references worlds(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  title text not null,
  input jsonb not null default '{}',
  status task_status not null default 'pending',
  assignee_id uuid not null references principals(id) on delete restrict,
  world_id text not null default 'production' references worlds(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  contract_id uuid not null references contracts(id) on delete cascade,
  producer_id uuid not null references principals(id) on delete restrict,
  content jsonb not null default '{}',
  content_hash text not null,
  media_type text not null default 'application/json',
  world_id text not null default 'production' references worlds(id),
  created_at timestamptz not null default now()
);

create table if not exists verifications (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references artifacts(id) on delete cascade,
  contract_id uuid not null references contracts(id) on delete cascade,
  verifier_id uuid not null references principals(id) on delete restrict,
  verdict verification_verdict not null,
  rubric_scores jsonb not null default '{}',
  comment text not null default '',
  world_id text not null default 'production' references worlds(id),
  created_at timestamptz not null default now()
);

-- Append-only virtual ledger. No updates/deletes via RLS policy (enforced in 003).
create table if not exists ledger_entries (
  id uuid primary key default gen_random_uuid(),
  world_id text not null default 'production' references worlds(id),
  contract_id uuid references contracts(id) on delete set null,
  from_principal_id uuid not null references principals(id) on delete restrict,
  to_principal_id uuid not null references principals(id) on delete restrict,
  amount_credits integer not null check (amount_credits > 0),
  memo text not null default '',
  settlement_ref text,
  created_at timestamptz not null default now(),
  check (from_principal_id <> to_principal_id)
);

create table if not exists reputations (
  principal_id uuid not null references principals(id) on delete cascade,
  world_id text not null references worlds(id),
  score integer not null default 50 check (score >= 0 and score <= 100),
  jobs_completed integer not null default 0,
  jobs_failed integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (principal_id, world_id)
);

-- Event ledger: every state transition emits a row. Append-only.
create table if not exists domain_events (
  seq bigserial primary key,
  id uuid not null default gen_random_uuid(),
  world_id text not null default 'production' references worlds(id),
  type text not null,
  entity_id text not null,
  payload jsonb not null default '{}',
  actor_id text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_events_world_seq on domain_events(world_id, seq);
create index if not exists idx_contracts_world on contracts(world_id);
create index if not exists idx_ledger_world on ledger_entries(world_id);
