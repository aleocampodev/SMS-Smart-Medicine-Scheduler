# SMS Project Guardrails & Operational Safety Policies

This document establishes the **core project guardrails** for the Smart Medicine Scheduler (SMS). These guardrails are non-negotiable safety policies that govern the runtime behavior of the system, data protection, network hygiene, browser automation, and developer workflows.

```
                         ┌────────────────────────────────────────────────┐
                         │            SMS PROJECT GUARDRAILS              │
                         └───────────────────────┬────────────────────────┘
                                                 │
      ┌──────────────────┬───────────────────────┼───────────────────────┬──────────────────┐
      ▼                  ▼                       ▼                       ▼                  ▼
[🛡️ Security & PII]  [🌐 Network Defense]   [⚙️ Business Integrity]  [🤖 Action Safety]  [🌿 Git & Workflows]
- No PII in repo     - Rate limit >= 30s     - The 3 Qanty rules     - Human-in-the-loop - No push to main
- Mask national IDs  - Anti-bot Jitter       - Deduplication cache   - Mutex lock (1 max)- Feature branches
- Credential isolate - Circuit breaker (429) - Multi-branch isolate  - CAPTCHA escalation- Quality gates
```

---

## 1. Security & Privacy Guardrails (`P-SEC`)

| ID | Name | Severity | Enforcement Mechanism | Policy Description |
| :--- | :--- | :--- | :--- | :--- |
| **`P-SEC-01`** | **No PII in Git** | `CRITICAL` | `.gitignore` & Pre-commit | Real family identity documents, names, emails, and phone numbers in `profiles.json` must **NEVER** be committed to Git. Only `profiles.example.json` with fake data is tracked. |
| **`P-SEC-02`** | **PII Data Masking** | `HIGH` | `maskDocument()` Utility | All system logs, console outputs, and Telegram notifications that display national ID numbers must mask leading digits (e.g. `******7890`). |
| **`P-SEC-03`** | **Credential Isolation** | `CRITICAL` | `src/config/env.ts` | Bot tokens, company codes, and chat IDs must strictly be loaded from `.env`. No secrets may be hardcoded in application source code. |

---

## 2. Network Defense & Anti-Ban Guardrails (`P-NET`)

| ID | Name | Severity | Enforcement Mechanism | Policy Description |
| :--- | :--- | :--- | :--- | :--- |
| **`P-NET-01`** | **Rate Limiting Threshold** | `HIGH` | `AdaptiveScheduler` | Polling intervals must never drop below **30 seconds**. High-frequency sub-second polling is strictly forbidden to protect IP reputation and clinic servers. |
| **`P-NET-02`** | **Anti-Fingerprint Jitter** | `MEDIUM` | Math Random Variance | Every polling cycle must inject a randomized micro-delay ($\pm 5\text{s}$ to $\pm 15\text{s}$) to break clock-like request regularities that trigger WAF/bot filters. |
| **`P-NET-03`** | **Circuit Breaker** | `HIGH` | `QantyClient` Cooldown | If Qanty returns HTTP `429 (Too Many Requests)` or `403 (Forbidden)`, polling must pause immediately for a **10-minute cooldown** (600,000 ms). |
| **`P-NET-04`** | **Realistic Signatures** | `MEDIUM` | HTTP Headers Config | Outbound HTTP calls must include legitimate desktop browser headers (`User-Agent`, `Referer`, `Origin`, `Accept`). |

---

## 3. Business Integrity & Anti-Spam Guardrails (`P-BIZ`)

| ID | Name | Severity | Enforcement Mechanism | Policy Description |
| :--- | :--- | :--- | :--- | :--- |
| **`P-BIZ-01`** | **Strict 3-Rules Gate** | `CRITICAL` | `RulesEngine.evaluate()` | An alert is triggered if and only if all 3 criteria match simultaneously:<br>1. Response items $> 2$<br>2. Slot status is `'free'` or `'available'`<br>3. Slot date is strictly a future date (`date !== today`). |
| **`P-BIZ-02`** | **Zero-Spam Deduplication** | `HIGH` | In-Memory TTL Set | Appointments already notified must not re-trigger Telegram alerts every cycle. Duplicate notifications within the state window are filtered out. |
| **`P-BIZ-03`** | **Multi-Branch Isolation** | `HIGH` | Branch ID Prefixing | Slot IDs must include branch prefixes (e.g. `118_2026-09-20_10:00` vs `6035_2026-09-20_10:00`) so slots from different dispensary branches never collide. |
| **`P-BIZ-04`** | **Runtime Schema Validation** | `HIGH` | Zod Schemas | All external payloads, `.env` settings, and profile data must validate against strict Zod schemas at startup. |

---

## 4. Browser Automation & Action Guardrails (`P-ACT`)

| ID | Name | Severity | Enforcement Mechanism | Policy Description |
| :--- | :--- | :--- | :--- | :--- |
| **`P-ACT-01`** | **Mandatory Human-in-the-Loop** | `CRITICAL` | Telegram Inline Buttons | The system must **never** book appointments autonomously without explicit human authorization. Booking requires a user tapping a specific profile button in Telegram. |
| **`P-ACT-02`** | **Concurrency Mutex Lock** | `HIGH` | `isBookingInProgress` Flag | Strictly **one** Playwright browser instance may run a booking session at any time. Parallel booking requests are defensively rejected until the active session finishes. |
| **`P-ACT-03`** | **Hard Timeout & Cleanup** | `HIGH` | 30s Timeout & `finally` | All browser operations have a 30-second hard ceiling. Browser contexts and pages must be terminated in `finally` blocks to prevent zombie processes. |
| **`P-ACT-04`** | **CAPTCHA Escalation** | `HIGH` | DOM Detector & Alert | If an interactive Cloudflare challenge or reCAPTCHA puzzle appears, automation halts immediately, captures a screenshot, and prompts the user for manual completion. |
| **`P-ACT-05`** | **Proof Receipt** | `MEDIUM` | Screenshot Delivery | Every booking attempt must capture a timestamped `.png` screenshot of the final page and send it to Telegram as proof of confirmation. |

---

## 5. Development & Git Guardrails (`P-DEV`)

| ID | Name | Severity | Enforcement Mechanism | Policy Description |
| :--- | :--- | :--- | :--- | :--- |
| **`P-DEV-01`** | **Main Branch Protection** | `CRITICAL` | Agent Rule & CI | **NEVER** push or merge directly to `main` (`git push origin main` is prohibited). All contributions must be integrated through Pull Requests. |
| **`P-DEV-02`** | **Feature Branch Exclusivity** | `HIGH` | Git Workflow | All code, refactors, and documentation must be created in dedicated branches (`<type>/<scope>/<description>`). |
| **`P-DEV-03`** | **Quality Gate Verification** | `HIGH` | Test Suite (`npm test`) | No branch may be merged unless all test suites (rules, guardrails, scheduler, and branches) pass with zero errors and TypeScript compiles cleanly. |
