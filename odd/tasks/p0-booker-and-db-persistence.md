# Feature: p0-booker-and-db-persistence

Harden `PlaywrightBooker` against silent false-positive bookings and wire `apps/scheduler` to PostgreSQL (`@SMS/db`) for `MonitorStatePort` and appointment recording.
Engram Mirror: odd/p0-booker-and-db-persistence/tasks

## Specs

- **S1**: "/plan analiza que le falta a este proyecto?" & "/plan si" — user approved executing Phase 1 and Phase 2 (P0) from `implementation_plan.md`.
- **S2**: Phase 1 (P0): `PlaywrightBooker` must fail closed (`success: false`) when required booking steps (form filling, submit click, or post-submit confirmation) do not succeed, map `slot.branch` to `BRANCH_MAP` display name, support optional `documentType`/`birthDate`/`healthEntity`/`prescriptionCode` fields, and extract confirmation codes when present.
- **S3**: Phase 2 (P0): Extend `monitorState` schema & repository with `selectedBranches`, add `PostgresMonitorStateAdapter` in `apps/scheduler`, wire `apps/scheduler` to PostgreSQL when `DATABASE_URL` is configured (keeping `InMemoryMonitorStateAdapter` as fallback), and persist alerted/booked appointments in the `appointment` table.
- **S4**: All codebase elements must be written strictly in English (`AGENTS.md` language policy) and committed on a dedicated branch (`P-DEV-01`).

## Tasks

- [x] **T1** [S1, S4]: Create branch `fix/scheduler/p0-booker-and-db-persistence` and ODD task file | Route: inline | Commit: pending
- [x] **T2** [S2]: Harden `PlaywrightBooker` strict step validation, `BRANCH_MAP` label resolution, extra profile fields, and confirmation extraction + unit tests | Route: inline | Commit: pending
- [x] **T3** [S3]: Extend `monitorState` schema/repository with `selectedBranches`, add `appointment` repository helper, and wire `PostgresMonitorStateAdapter` + appointment recording in `apps/scheduler` | Route: inline | Commit: pending
- [x] **T4** [S2, S3, S4]: Run `bun run check`, `bun run check-types`, `bun run test`, `bun run build`, and create `walkthrough.md` | Route: inline | Commit: pending

## Log

- **L1**: "/plan si" — user approved Phase 1 & Phase 2 (P0) execution.
- **L2**: Evidence (2026-11-27): `bun run check` -> 0 warnings, 0 errors; `bun run check-types` -> 8/8 packages OK; `bun run test` -> all workspace suites OK (including `testBooker.ts` and `testMonitorAndAppointments.ts`); `bun run build` -> 3/3 (`@SMS/scheduler`, `server`, `web`) OK.
