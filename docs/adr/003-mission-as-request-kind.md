# ADR-003: Mission as a Request kind

- Status: accepted

## Context
Original spec made Mission the parent of all activity.

## Decision
Mission = Request(kind=mission_investigation). Its pipeline stages are Tasks
under one Contract. Intelligence and economy stay composable.

## Consequences
- Strategy Room renders mission stages from mission_stages + tasks.
- No marketplace assumptions embedded in mission tables.
