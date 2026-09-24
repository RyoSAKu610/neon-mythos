# Rollback

Application rollback (Vercel): restore previous immutable deployment.
State rollback is separate and NOT automatic.

- DB writes, migrations, ledger entries, external calls are not undone by app rollback.
- Migrations are expand-and-contract; never drop a column the previous app needs.
- During incident: contain → preserve logs/events → restore known-good app →
  verify compatibility with current DB → fix via Preview → promote.
