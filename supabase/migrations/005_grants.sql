-- 005_grants: RLS policies alone do not grant table privileges.
-- Without these, even `authenticated` gets "permission denied" on Supabase too.
-- Writes stay service-role-only (service_role bypasses RLS and holds full rights).

grant select on all tables in schema public to authenticated;
alter default privileges in schema public grant select on tables to authenticated;

-- Ledger stays read-only for authenticated: no insert/update/delete grant,
-- no non-SELECT policy (verified: pg_policies has 0 non-SELECT rows there).
-- Anon intentionally receives nothing (deny by default, defense in depth).
