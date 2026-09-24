# Runbook (condensed)

- Local: `pnpm install && pnpm test && pnpm --filter web dev`
- DB: `supabase start && supabase db reset` (migrations in supabase/migrations)
- Env: copy `.env.example`; server keys never NEXT_PUBLIC.
- Staging/prod: Preview → staging → main. Never point Preview at prod DB.
- Add agent: new file in packages/agents + Service row + capability id.
- Add tool: packages/tools with permission + approval flag.
- Add provider: implement AIProvider in ai-core, switch via AI_PROVIDER.
- Add entity: migration + contracts schema + domain type + repo + test.
- Incident: see rollback.md; correlate via corr id in logs.
