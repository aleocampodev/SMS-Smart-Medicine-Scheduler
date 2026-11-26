# Feature: pro-autonomous-monitoring

Organize the repository for portfolio presentation and implement a Telegram-first medication-claim gate, `PISO3` + `118` branch monitoring, hexagonal ports with PostgreSQL state persistence, complete Playwright booking flow, and a functional Next.js dashboard.
Engram Mirror: odd/pro-autonomous-monitoring/tasks

## Specs

- **S1**: "que debo mejorar para que sea Pro / necesito que esto sea un poco autonomo / antes de buscar en la web primero pregunte si el usuario ya reclamo sus medicamentos" — scheduler must ask via Telegram before polling Qanty.
- **S2**: "yo lo digo es que eso pase es por telegram, si el usuario dice que si no busca nada" — answering Yes (`claim:yes`) transitions state to `PAUSED` with zero web requests; answering No (`claim:no`) transitions to `ACTIVE` and starts polling.
- **S3**: "Nueva eps promeda tercer piso cambia la 6025 por esa" — replace `6035` with `PISO3` (`XVoySp4iyl9hC7nNhuEN`, line `G26hsHGJQWHLWsSUghdK`) alongside `118`.
- **S4**: "organiza primero lo que sea necesario, ademas del repo" & "si, hazlo" — organize repo hygiene, add hexagonal ports (`BookingPort`, `NotificationPort`, `MonitorStatePort`), persist monitor state in `@SMS/db`, wire `apps/web` dashboard, and complete `PlaywrightBooker` flow.
- **S5**: "All codebase elements—including source code, comments, logs, documentation, ADRs, commit messages, and PR descriptions—must be written strictly in English." (AGENTS.md language policy)
- **S6**: "All work (`feat`, `fix`, `docs`, `refactor`, `test`) must be conducted in dedicated branches (`<type>/<scope>/<description>`)." (AGENTS.md, P-DEV-01)

## Tasks

- [x] **T1** [S4, S5]: Repo hygiene cleanup, `oxlint`/`oxfmt` check, and `README.md` update | Route: inline | Commit: pending
- [x] **T2** [S1, S2, S3]: Add `PISO3` branch to `BRANCH_MAP` and pure `monitorGate` (`shouldPoll`, `summarizeBranchSlots`) + unit tests in `@SMS/poller` & `@SMS/scheduler` | Route: inline | Commit: pending
- [x] **T3** [S1, S2, S4]: Add `monitor_state` table & repository in `@SMS/db` + hexagonal ports (`BookingPort`, `NotificationPort`, `MonitorStatePort`) in `@SMS/scheduler` | Route: inline | Commit: pending
- [x] **T4** [S1, S2, S3, S4]: Wire Telegram pre-search medication-claim gate (`claim:yes` / `claim:no`, `/buscar`, `/pausar`), branch digest alerts, and `PISO3,118` defaults in `@SMS/scheduler` | Route: inline | Commit: pending
- [x] **T5** [S4]: Complete `PlaywrightBooker` branch/date/time selection + form submission and wire `apps/web` dashboard to `trpc.profiles` & `trpc.appointments` | Route: inline | Commit: pending
- [x] **T6** [S4, S5]: Run full verification (`npm run check`, `npm run check-types`, `npm test`, `npm run build`) and create walkthrough artifact | Route: inline | Commit: pending

## Log

- **L1**: "si, hazlo" — user approved the 4-phase implementation plan in `pro-autonomous-monitoring-plan.md`.
- **L2**: Evidence (2026-11-14): `npm run check` → 0 warnings, 0 errors; `npm run check-types` → 8/8 packages OK; `npm test` → 4/4 turbo test tasks OK (including `testBranches.ts` and `testMonitorGate.ts` 4/4); `npm run build` → 3/3 (`@SMS/scheduler`, `server`, `web`) OK.
