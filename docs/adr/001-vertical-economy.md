# ADR-001: Vertical economy flow as the core

- Status: accepted
- Date: 2026-09-24

## Context
Scaling agents 10 → 10,000 without a legible transaction pipeline produces an
unintelligible swarm. Neon City 3D and 100 agents do not fix this.

## Decision
Build first: Principal → Capability → Service → Request → Contract → Task →
Artifact → Verification → Ledger → Reputation, plus World + Event Ledger.
Every job, including Missions, flows through it.

## Alternatives
- Mission-centric (all activity under Mission): rejected, couples intelligence loop to economy.
- Fixed 8-agent core: rejected, blocks external A2A agents.
- 3D city first: rejected, visualization without economy.

## Consequences
- A2A Agent Card maps to Service discovery; A2A Task/Artifact map to Task/Artifact.
- Reputation and Ledger are derived, never hand-edited.
- Worlds isolate production vs simulation with identical schema.

## Migration
Mission tables reference requests(request_id); old mission-only code adapts via
002_mission_compat.sql view of request kind.
