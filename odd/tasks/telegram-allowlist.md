# Feature: telegram-allowlist

Restrict the SMS Telegram bot to an explicit set of chat/user IDs and load the BotFather token from the monorepo root `.env`.
Engram Mirror: odd/telegram-allowlist/tasks

## Specs

- **S1**: "si hazlo" — authorizes the allowlist and scheduler `.env` loading fix proposed in the preceding turn.
- **S2**: "no veo donde estas usando el bot de telegram, sabiendo que ya he creado uno en botfather con telegram, no comprendo por que usaste gammY" — the scheduler must load the BotFather token from the repository `.env` so the bot actually connects.
- **S3**: "que es un allowlist?" — only Telegram chat/user IDs explicitly allowed may run commands, receive alerts, or trigger bookings.
- **S4**: "All codebase elements—including source code, comments, logs, documentation, ADRs, commit messages, and PR descriptions—must be written strictly in English." (AGENTS.md language policy)
- **S5**: "All work (`feat`, `fix`, `docs`, `refactor`, `test`) must be conducted in dedicated branches (`<type>/<scope>/<description>`)." (AGENTS.md, P-DEV-01)

## Tasks

- [x] **T1** [S1, S2]: Load local and repository-root `.env` files for the scheduler, with local precedence | Route: inline | Commit: 024c8a7
- [x] **T2** [S1, S3]: Add pure allowlist parsing/validation helpers and unit tests (RED first) | Route: inline | Commit: 024c8a7
- [x] **T3** [S1, S3]: Enforce the allowlist in Telegram middleware, callback queries, and alert recipients | Route: inline | Commit: 024c8a7
- [x] **T4** [S1, S3]: Add `TELEGRAM_ALLOWED_CHAT_IDS` to the env schema and both env examples | Route: inline | Commit: 024c8a7
- [x] **T5** [S1, S3]: Wire `test:allowlist` into scheduler/root scripts and verify the full quality gate | Route: inline | Commit: 024c8a7
- [x] **T6** [S1, S3]: Update guardrails and onboarding documentation | Route: inline | Commit: 024c8a7

## Log

- **L1**: "si hazlo" — user authorizes the allowlist and scheduler `.env` loading fix.
- **L2**: "no veo donde estas usando el bot de telegram, sabiendo que ya he creado uno en botfather con telegram, no comprendo por que usaste gammY" — evidence: root `.env` contains `TELEGRAM_BOT_TOKEN`, but `apps/scheduler/.env` does not exist; `dotenv.config()` runs with the scheduler package as cwd and falls back to `mock_token`.
- **L3**: "que es un allowlist?" — user asked for the concept; the implementation restricts bot access to an explicit ID list.
- **L4**: Evidence (2026-11-09): `bun run test:allowlist` → 7/7 checks passed; `bun run test` → 4/4 turbo tasks OK; `bun run check-types` → 8/8 OK; `bun run build` → 3/3 OK; env probe from `apps/scheduler` printed `TOKEN=LOADED`.
