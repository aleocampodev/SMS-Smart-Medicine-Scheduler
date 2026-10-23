# Pull Request — SMS Smart Medicine Scheduler

> **Mandatory workflow (`P-DEV-01`).** `main` is protected: never push or merge into it directly.
> Every contribution lands through a Pull Request from a dedicated `<type>/<scope>/<description>` branch (`P-DEV-02`).
> Remove any section that genuinely does not apply, but never remove the **Verification** or **Guardrail Compliance** sections.

---

## 1. Summary

<!-- What does this PR do, in 2-3 sentences? A reviewer with no context must understand the intent. -->

**Type of change:**

- [ ] `feat` — new capability
- [ ] `fix` — bug fix
- [ ] `refactor` — behaviour-preserving restructuring
- [ ] `perf` — performance / latency
- [ ] `docs` — documentation only
- [ ] `test` — tests only
- [ ] `chore` — tooling, config, dependencies

**Branch:** `<!-- e.g. feat/infra/event-poller-functional-bun -->`

**Related issue / board item:** <!-- #12, openspec/specs/..., or "none" -->

---

## 2. What changed

<!-- Bullet the meaningful changes. Point to files, not sentences. -->

-
-

### Why

<!-- The problem being solved. Link the requirement, whiteboard item, or spec. -->

---

## 3. Architecture impact

<!-- Tick every row that applies. If all are unticked, justify why the change is contained. -->

- [ ] No change to the poll → validate → notify → book pipeline
- [ ] Touches the polling layer (`src/poller/`, `packages/poller/`)
- [ ] Touches the rules engine (3-rule validation or dedup state)
- [ ] Touches Telegram UX or user-facing message text
- [ ] Touches Playwright automation, session harvesting, or booking flow
- [ ] Changes shared types, public interfaces, or module boundaries
- [ ] Changes configuration, dependencies, or the build/runtime toolchain

**Interface changes** (new/changed/removed exports, payload shapes, event names):

<!-- "None" is a valid answer — state it explicitly. -->

---

## 4. Verification

> Required by `P-DEV-03`. Paste real output, not a paraphrase. "Should work" is not verification.

**Build — `npm run build`**

```
<!-- paste tsc output -->
```

**Test suite — `npm test`** (rules, guardrails, scheduler, branches, session)

```
<!-- paste summary lines of all suites -->
```

| Suite             | Result      | Notes |
| ----------------- | ----------- | ----- |
| `test:rules`      | pass / fail |       |
| `test:guardrails` | pass / fail |       |
| `test:adaptive`   | pass / fail |       |
| `test:branches`   | pass / fail |       |
| `test:session`    | pass / fail |       |

**Manual / live verification**

<!-- Only if the change touches live Qanty behaviour, Telegram, or the browser. -->

- [ ] Not applicable
- [ ] Verified manually — describe the steps and the observed result

**How a reviewer can reproduce this**

```bash
# exact commands, in order
```

---

## 5. Guardrail compliance

> Tick each box honestly. If a box cannot be ticked, say so in the Notes column and explain the mitigation.

### Security & Privacy (`P-SEC`)

| Guardrail  | Rule                                                               | Compliant | Notes |
| ---------- | ------------------------------------------------------------------ | --------- | ----- |
| `P-SEC-01` | No real PII committed; only `profiles.example.json` is tracked     | [ ]       |       |
| `P-SEC-02` | National IDs masked in all logs and Telegram output (`******7890`) | [ ]       |       |
| `P-SEC-03` | Secrets only from `.env`; nothing hardcoded                        | [ ]       |       |

### Network & anti-ban (`P-NET`)

| Guardrail  | Rule                                        | Compliant | Notes |
| ---------- | ------------------------------------------- | --------- | ----- |
| `P-NET-01` | Polling interval never below **30s**        | [ ]       |       |
| `P-NET-02` | Random jitter `±5s`–`±15s` on every cycle   | [ ]       |       |
| `P-NET-03` | 10-minute cooldown on HTTP `429` / `403`    | [ ]       |       |
| `P-NET-04` | Realistic browser headers on outbound calls | [ ]       |       |

### Action & automation (`P-ACT`)

| Guardrail  | Rule                                                     | Compliant | Notes |
| ---------- | -------------------------------------------------------- | --------- | ----- |
| `P-ACT-01` | No autonomous booking; explicit human tap required       | [ ]       |       |
| `P-ACT-02` | Single booking mutex — one Playwright instance at a time | [ ]       |       |
| `P-ACT-03` | 30s hard timeout + `finally` cleanup of contexts/pages   | [ ]       |       |
| `P-ACT-04` | CAPTCHA detected → halt, screenshot, ask the human       | [ ]       |       |
| `P-ACT-05` | Screenshot receipt delivered on every booking attempt    | [ ]       |       |

### Development & Git (`P-DEV`)

| Guardrail  | Rule                                                            | Compliant | Notes |
| ---------- | --------------------------------------------------------------- | --------- | ----- |
| `P-DEV-01` | No direct push/merge to `main`                                  | [ ]       |       |
| `P-DEV-02` | Work lives in a dedicated `<type>/<scope>/<description>` branch | [ ]       |       |
| `P-DEV-03` | TypeScript compiles clean and all suites pass                   | [ ]       |       |

---

## 6. Risk & rollback

| Question                                                                  | Answer |
| ------------------------------------------------------------------------- | ------ |
| Can this break the live poller in production?                             |        |
| Can this leak PII into logs, Telegram, or Git?                            |        |
| Can this trigger Qanty rate limiting or a bot ban (`P-NET`)?              |        |
| Blast radius if wrong: single branch / both branches / full reset needed? |        |
| **Rollback plan** (exact revert command or `git revert <sha>`)            |        |

---

## 7. Reviewer notes

<!-- Call out the risky parts, deliberate trade-offs, and anything you want challenged.
     Disclose known limitations, incomplete wiring, or debt this PR introduces. -->

**Known limitations / follow-up work**

- [ ] None
- [ ] Listed below

-

---

## 8. Checklist before requesting review

- [ ] Branch name follows `<type>/<scope>/<description>` (`P-DEV-02`)
- [ ] Commit messages follow Conventional Commits (`feat:`, `fix:`, `refactor:`, …)
- [ ] `npm run build` returns 0 errors
- [ ] `npm test` passes all suites
- [ ] No secrets, tokens, or real identity data in the diff
- [ ] Debug leftovers removed (`console.log` spam, `.only`, commented-out blocks, stray build artifacts)
- [ ] Documentation updated (`README.md`, `docs/`, ADRs, `openspec/specs/`) if behaviour or interfaces changed
- [ ] Screenshots attached for any user-facing Telegram or browser change (redacted)
