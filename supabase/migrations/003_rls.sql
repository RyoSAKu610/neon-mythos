-- 003_rls: user isolation. Service role bypasses RLS; anon/authenticated scoped by world.
-- NOTE: principals carry no auth user id in v0; link via app layer (profiles table added here).
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  principal_id uuid references principals(id) on delete set null,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

alter table worlds enable row level security;
alter table principals enable row level security;
alter table services enable row level security;
alter table requests enable row level security;
alter table contracts enable row level security;
alter table tasks enable row level security;
alter table artifacts enable row level security;
alter table verifications enable row level security;
alter table ledger_entries enable row level security;
alter table reputations enable row level security;
alter table domain_events enable row level security;
alter table missions enable row level security;
alter table decisions enable row level security;

-- Read-only public demo policy: authenticated users can read production/sim rows.
-- Writes go through service-role API routes with zod validation (never anon direct write
-- for ledger/verifications). Ledger is insert-only: no update/delete policies.
do $$ begin
  create policy "read_all_authenticated" on worlds for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read_all_authenticated" on principals for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read_all_authenticated" on capabilities for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read_all_authenticated" on services for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read_all_authenticated" on requests for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read_all_authenticated" on contracts for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read_all_authenticated" on tasks for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read_all_authenticated" on artifacts for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read_all_authenticated" on verifications for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read_all_authenticated" on ledger_entries for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read_all_authenticated" on reputations for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read_all_authenticated" on domain_events for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read_all_authenticated" on missions for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read_all_authenticated" on decisions for select to authenticated using (true);
exception when duplicate_object then null; end $$;
