# Feature: profiles-appointments-crud

First data-layer slice of the SMS monorepo: authenticated tRPC CRUD over the existing `profile` and `appointment` tables.
Engram Mirror: odd/profiles-appointments-crud/tasks

## Specs

- **S1**: "CRUD perfiles + citas" — "profiles.list/create/update/delete y appointments.list/create/updateStatus, protegidos por sesión y scoped al usuario. Es lo que destraba el dashboard y la migración del scheduler a DB."
- **S2**: "Postgres embebido PGlite" — "Tests de integración reales e in-process con @electric-sql/pglite + drizzle; corren en CI sin servicios externos. Añade una devDependency y un script test en @SMS/api."
- **S3**: "All logs and Telegram messages displaying national IDs must mask leading digits (e.g. `******7890`)." (AGENTS.md, P-SEC-02)
- **S4**: "All work (`feat`, `fix`, `docs`, `refactor`, `test`) must be conducted in dedicated branches (`<type>/<scope>/<description>`)." (AGENTS.md, P-DEV-01)
- **S5**: "Strictly **one** Playwright browser instance may book at any time (concurrency mutex lock)." (AGENTS.md, P-ACT-02) — unchanged by this slice; no booking path is touched.

## Tasks

- [x] **T1** [S1, S2]: Add PGlite test harness and capture RED tests for profile/appointment CRUD | Route: inline | Commit: b85b144
- [x] **T2** [S1]: Implement profile router (list/create/update/delete) scoped to session user | Route: inline | Commit: b85b144
- [x] **T3** [S1]: Implement appointment router (list/create/updateStatus) scoped through profile ownership | Route: inline | Commit: b85b144
- [x] **T4** [S1, S2]: Wire routers into appRouter, add `@SMS/api` test script, update root test pipeline | Route: inline | Commit: b85b144
- [x] **T5** [S2, S3]: Add PII masking helper coverage and verify full quality gate | Route: inline | Commit: b85b144

## Log

- **L1**: "no primero lo que me dices, tienes en memoria el grafico de excalidraw?"
- **L2**: Scope decision (user-selected): "CRUD perfiles + citas (Recommended)" — "profiles.list/create/update/delete y appointments.list/create/updateStatus, protegidos por sesión y scoped al usuario. Es lo que destraba el dashboard y la migración del scheduler a DB."
- **L3**: Test decision (user-selected): "Postgres embebido PGlite (Recommended)" — "Tests de integración reales e in-process con @electric-sql/pglite + drizzle; corren en CI sin servicios externos. Añade una devDependency y un script test en @SMS/api."
- **L4**: Reference blueprint confirmed by user: `docs/architecture.excalidraw` (already materialized as `@SMS/poller` + monorepo; this slice extends beyond that drawing).
- **L5**: Evidence (2026-10-30): RED captured (`Cannot find module '../sanitize'`), then GREEN with 8 integration tests against in-process PGlite. `bun run check-types`: 8/8 packages OK. `bun run test`: 2/2 turbo tasks OK (@SMS/api + @SMS/scheduler). `bun run build`: 3/3 OK. `bunx oxlint packages/api/src`: clean.
