# ADR-004: World + Event Ledger, Neon City as client

- Status: accepted

## Context
Need to compare human production economy vs AI-only fast simulation
under the same institution, and keep 3D experimentation from destabilizing core.

## Decision
- World partitions all economy tables (production vs sim:*).
- domain_events is append-only; every transition emits one.
- Neon City reads World + events only.

## Consequences
- Same research question answerable in both worlds.
- City can be replaced without touching economy.
