# AGENTS.md — operational contract for future coding agents

Read before modifying the repo.

- Vertical first: Principal→Capability→Service→Request→Contract→Task→Artifact→Verification→Ledger→Reputation. Do not bypass.
- Mission is a Request kind. Do not make it the parent of contracts/ledger.
- Ledger is append-only. Never update/delete ledger_entries; fix by new entry.
- Reputation is derived from verifications only.
- Neon City reads World + Event Ledger; no business logic there.
- Real money only via SettlementAdapter (virtual default). No x402/Solana logic in domain.
- Domain (@neon/domain) has no React, no Supabase imports. DB lives in @neon/db. Validation in @neon/contracts (zod).
- Consequential tools require approval. Bind approval to action+params.
- Migrations: versioned SQL under supabase/migrations, backward-compatible, expand-and-contract.
- Commands: pnpm dev|build|lint|typecheck|test. Verify domain invariants with vitest.
- Fixed-point rule: if removing your change still proves the requested outcome, exclude it.
- Features multiply, coupling must not.
