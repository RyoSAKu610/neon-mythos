# ADR-002: Virtual ledger first, x402 via Settlement Adapter

- Status: accepted

## Context
Real money too early couples consensus/economics to payment rails.

## Decision
Stage 1-2: virtual credits in append-only ledger_entries. Stage 3: swap
SettlementAdapter to x402 (settlementRef attached, domain unchanged).

## Consequences
- Same Contract/Ledger tested in simulation then production.
- No Solana/x402 logic inside domain; only adapter in @neon/db.
