# OpenSpec: Guardrails & Safety Policies (G-SPEC)

**ID**: `guardrails`  
**Version**: `1.0.0`  
**Status**: `Active`  
**Scope**: Security, Network Resilience, Data Privacy, and Execution Boundaries for `sms-smart-medicine-scheduler`.

---

## 1. Overview

This document establishes the **mandatory guardrails** that govern the runtime behavior and deployment of the Smart Medicine Scheduler. No code change or operational workflow may violate these policies.

```
                    ┌──────────────────────────────────────────────┐
                    │            OPENSPEC GUARDRAILS               │
                    └──────────────────────┬───────────────────────┘
                                           │
         ┌──────────────────┬──────────────┴─────┬──────────────────┐
         ▼                  ▼                    ▼                  ▼
  [🛡️ Privacy & PII]     [🌐 Network Defense]  [⚙️ Business Logic]  [🤖 Playwright & Ops]
  - No PII in repo       - Rate Limit >= 30s   - 3 Qanty Rules      - Human-in-the-loop
  - Mask national IDs    - Random Jitter       - Deduplication      - Concurrency Mutex
  - Strict .gitignore    - Circuit Breaker     - Anti-spam Cache    - Timeouts & Screenshots
```

---

## 2. Guardrail Catalog

### 2.1. Security and Privacy (PII & Credentials)

| ID | Name | Severity | Policy Rule |
| :--- | :--- | :--- | :--- |
| **G-SEC-01** | **No PII in Repositories** | `CRITICAL` | `profiles.json` and files containing real citizen IDs, names, or phone numbers must **NEVER** be tracked in Git. Only `profiles.example.json` is tracked. |
| **G-SEC-02** | **Data Masking** | `HIGH` | All logs and Telegram messages displaying document numbers must obfuscate leading digits (e.g. `******7890`). |
| **G-SEC-03** | **Credential Isolation** | `CRITICAL` | `TELEGRAM_BOT_TOKEN` and access keys must be supplied strictly via environment variables (`.env`), never hardcoded. |

### 2.2. Network and Anti-Ban (WAF & Rate Limiting)

| ID | Name | Severity | Policy Rule |
| :--- | :--- | :--- | :--- |
| **G-NET-01** | **Minimum Rate Limit** | `HIGH` | Polling requests to `qanty.com` must have a baseline interval of at least **30 seconds**. |
| **G-NET-02** | **Anti-Fingerprint Random Jitter** | `MEDIUM` | Every polling iteration must introduce a random delay variance ($\pm 5\text{s}$ to $\pm 15\text{s}$) to avoid mechanical bot detection by WAF / Cloudflare. |
| **G-NET-03** | **Circuit Breaker (429 / 403)** | `HIGH` | If Qanty responds with HTTP status `429 (Too Many Requests)` or `403 (Forbidden)`, polling must halt immediately for **10 minutes** with defensive cooldown. |
| **G-NET-04** | **Realistic Browser Signatures** | `MEDIUM` | All outbound HTTP requests must supply genuine browser headers (`User-Agent`, `Referer`, `Origin`, `Accept`). |

### 2.3. Business Rules Integrity & Anti-Spam

| ID | Name | Severity | Policy Rule |
| :--- | :--- | :--- | :--- |
| **G-BIZ-01** | **Strict 3-Rules Validation** | `CRITICAL` | A slot can only trigger an alert if it satisfies all 3 conditions simultaneously:<br>1. Response items $> 2$<br>2. Slot status is explicitly `'free'`<br>3. Slot date is strictly different from today (`date != today`). |
| **G-BIZ-02** | **Zero-Spam Deduplication** | `HIGH` | An appointment slot that has already been notified to the user must not re-trigger duplicate notifications within its state TTL. |
| **G-BIZ-03** | **Zod Schema Enforcement** | `HIGH` | All external inputs (Qanty responses, user profiles, environment configs) must be validated with Zod schemas at runtime. |

### 2.4. Playwright Browser Automation Safety

| ID | Name | Severity | Policy Rule |
| :--- | :--- | :--- | :--- |
| **G-ACT-01** | **Mandatory Human-in-the-Loop** | `CRITICAL` | Booking an appointment strictly requires explicit human authorization via an interactive Telegram inline button click. No blind automated bookings. |
| **G-ACT-02** | **Single Concurrency Mutex Lock** | `HIGH` | Only 1 active Playwright browser booking session is permitted at any given moment to prevent session collisions and IP bans. |
| **G-ACT-03** | **Strict Timeout & Zombie Cleanup** | `HIGH` | All browser operations have a maximum timeout of **30 seconds**. Browser context termination is guaranteed in `finally` blocks. |
| **G-ACT-04** | **CAPTCHA Escalation** | `HIGH` | If a Cloudflare challenge or reCAPTCHA is detected in the DOM, automated input is aborted, an alert screenshot is captured, and manual completion is requested. |
| **G-ACT-05** | **Audit Evidence Receipt** | `MEDIUM` | Every booking attempt (success or failure) must generate a timestamped `.png` screenshot sent directly to Telegram. |

### 2.5. Git & Deployment Policies

| ID | Name | Severity | Policy Rule |
| :--- | :--- | :--- | :--- |
| **G-DEV-01** | **Main Branch Protection** | `CRITICAL` | **NEVER** push or merge directly to `main`. All work must be conducted in dedicated feature branches (`feat/*`, `fix/*`, `docs/*`). |
