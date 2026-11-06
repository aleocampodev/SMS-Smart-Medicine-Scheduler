# Feature: db-backed-profiles

PR B of the db-backed-profiles chain: the scheduler reads profiles through a `ProfileSource` abstraction, with JSON as the default and Postgres opt-in.
Engram Mirror: odd/db-backed-profiles/tasks

## Specs

- **S1**: "1a" — "`PROFILES_SOURCE` con default `json`, y en un PR posterior se voltea a `db` y se borra el loader JSON. (Recomendada: migración segura, reversible.)"
- **S2**: "2a" — "Una instalación = un dueño designado (`PROFILES_OWNER_EMAIL`); el scheduler lee todos los perfiles de ese usuario. (Recomendada: el dashboard y el scheduler ven lo mismo, sin rediseñar Telegram.)"
- **S3**: "3a" — "Dos PRs encadenados (A → B). (Recomendada: cada uno revisable y con su task ODD.)"
- **S4**: "All logs and Telegram messages displaying national IDs must mask leading digits (e.g. `******7890`)." (AGENTS.md, P-SEC-02)
- **S5**: "The system must never book appointments autonomously without human confirmation. A user must tap a Telegram inline button." (AGENTS.md, P-ACT-01)

## Tasks

- [x] **T1** [S1]: Introduce `ProfileSource` and move the current loader into `JsonProfileSource` without behavior changes | Route: inline | Commit: -
- [x] **T2** [S1, S2]: Add `DbProfileSource` and the source factory, plus `DATABASE_URL` / `PROFILES_SOURCE` / `PROFILES_OWNER_EMAIL` env | Route: inline | Commit: -
- [x] **T3** [S1]: Refactor `index.ts` and every Telegram handler to `await` the injected source | Route: inline | Commit: -
- [x] **T4** [S2, S4]: Add `seedProfiles` (profiles.json → Postgres, idempotent upsert, masked logs) and document the env | Route: inline | Commit: -
- [x] **T5** [S1, S3]: Cover the source contract with tests and verify the full quality gate | Route: inline | Commit: -

## Log

- **L1**: "1a" — explicit `PROFILES_SOURCE=json|db` with `json` as the default; the scheduler must keep working without Postgres.
- **L2**: "2a" — one installation, one designated owner resolved through `PROFILES_OWNER_EMAIL`; the scheduler performs installation-wide reads.
- **L3**: "3a" — this is PR B, branched from `main` after PR #22 (`c796a78`).
- **L4**: Human-in-the-loop stays intact (S5): the booking path still requires the Telegram inline button; only profile resolution changes.

- **L5**: Evidence (2026-11-06): `bun run test` → 4/4 turbo tasks OK, including the new `testProfileSource` suite. `bun run check-types` → 8/8 packages. `bun run build` → 3/3 tasks. `bunx oxlint` clean. The DB source reuses the PGlite-tested repository from PR #22; switching `PROFILES_SOURCE=db` is the only runtime change.
