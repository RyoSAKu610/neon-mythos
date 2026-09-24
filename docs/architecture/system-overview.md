# Neon Mythos — system overview

```text
Browser
↓
Next.js (apps/web: routes, server actions, route handlers)
↓
Domain (@neon/domain: Principal→…→Reputation state machines)
↓
Database (Supabase Postgres, migration-controlled)
```

```text
User / Agent (Principal)
↓
Request (kind: service_hire | mission_investigation | custom)
↓
Contract (draft→offered→agreed→active→fulfilled→settled/disputed)
↓
Task (durable unit, pollable; Vercel Workflow later)
↓
Tool / Model / Source
↓
Artifact (hash + provenance)
↓
Verification (pass/partial/fail)
↓
Ledger (virtual now, x402 adapter later) + Reputation
↓
Event Ledger → Neon City (read-only client), Activity UI
```

External boundary: A2A Agent Card → Service discovery; A2A Task/Artifact →
Task/Artifact. MCP+OAuth tools attach as ToolDefs with approval flags.
