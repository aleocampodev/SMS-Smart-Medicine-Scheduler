# Feature: profile-repository

PR A of the db-backed-profiles chain: shared PII masking and a Postgres profile repository, tested with in-process PGlite.
Engram Mirror: odd/profile-repository/tasks

## Specs

- **S1**: "1a" — "`PROFILES_SOURCE` con default `json`, y en un PR posterior se voltea a `db` y se borra el loader JSON. (Recomendada: migración segura, reversible.)"
- **S2**: "2a" — "Una instalación = un dueño designado (`PROFILES_OWNER_EMAIL`); el scheduler lee todos los perfiles de ese usuario. (Recomendada: el dashboard y el scheduler ven lo mismo, sin rediseñar Telegram.)"
- **S3**: "3a" — "Dos PRs encadenados (A → B). (Recomendada: cada uno revisable y con su task ODD.)"
- **S4**: "All logs and Telegram messages displaying national IDs must mask leading digits (e.g. `******7890`)." (AGENTS.md, P-SEC-02)
- **S5**: "All work (`feat`, `fix`, `docs`, `refactor`, `test`) must be conducted in dedicated branches (`<type>/<scope>/<description>`)." (AGENTS.md, P-DEV-01)

## Tasks

- [x] **T1** [S4]: Move `maskDocumentNumber` into `@SMS/poller` with unit coverage | Route: inline | Commit: aa2c634
- [x] **T2** [S1, S2]: Add `@SMS/db` profile repository (`listAll`, `listByUser`, `getById`) with PGlite integration tests | Route: inline | Commit: aa2c634
- [x] **T3** [S4]: Re-export the shared mask from `@SMS/api` and `@SMS/scheduler`, deleting both duplicates | Route: inline | Commit: aa2c634
- [x] **T4** [S1, S3]: Wire the `@SMS/db` test script into the turbo pipeline and verify the full quality gate | Route: inline | Commit: aa2c634

## Log

- **L1**: "1a" — user selected the explicit `PROFILES_SOURCE=json|db` strategy with `json` as the default.
- **L2**: Defaults accepted for the remaining decisions: 2a (single designated owner per installation) and 3a (two chained PRs).
- **L3**: Scope boundary: PR A ships the repository and shared masking only. The scheduler switch, `seedProfiles`, and `PROFILES_SOURCE` env land in PR B.

- **L4**: Evidence (2026-11-05): `bun run test` → 4/4 turbo tasks OK (@SMS/poller, @SMS/db, @SMS/api, @SMS/scheduler). `bun run check-types` → 8/8 packages OK. `bun run build` → 3/3 tasks OK. `bunx oxlint` clean. PGlite pinned in the workspace catalog to keep a single drizzle-orm resolution.
