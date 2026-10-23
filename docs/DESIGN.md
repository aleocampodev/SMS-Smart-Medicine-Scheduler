# SMS: Systems Design
### Deterministic Multi-Branch Healthcare Availability & Sub-Second Playwright Booking
*sms.smart-medicine-scheduler · Kevin Vicent · Architecture & Systems Manual*

---

> **The Target Reality**: Qanty is a high-demand, rate-limited healthcare dispensary portal with unpredictable appointment releases, aggressive bot protection (reCAPTCHA v3 score-based handshakes), and immediate slot exhaustion (<10 seconds). We monitor appointment availability deterministically without scraping overhead, validate slots through a 3-rule decision core, dispatch instant Telegram 1-click booking alerts, and execute sub-second Playwright form completion with Addy Osmani performance patterns.
>
> Most healthcare dispensary scrapers fail due to anti-bot bans or booking race conditions. SMS separates discovery from deterministic execution: **System 2** learns and adapts to the portal's behavioral cadence; **Shared Memory** models the domain ontology; **System 1** applies compiled decision rules and executes bookings in <1s under human-in-the-loop authorization.

---

## 1. Problem and Goals

### The Problem
Patients requiring essential medication from dispensaries in Medellín (specifically **Branch `6035`** and **Branch `118`**) face severe availability friction. Slots open without prior notice (primarily during early morning releases between 06:00 and 08:00 COT), and human manual navigation through the portal takes 45–90 seconds—by which time slots are consumed by competing users.

Furthermore, direct API automation faces severe hurdles:
1. **Unpredictable Handshake**: The endpoint `POST /p/appointments/list_day_schedule` requires an active session initialized through a reCAPTCHA v3 challenge. Unauthenticated calls yield HTTP `400` or `BOT` rejection codes.
2. **Strict Rate Limiting**: Repeated rapid polling triggers HTTP `429` / `403` and IP blocking.
3. **Data Invariants**: The API returns calendar slots with multiple internal statuses (`free`, `waiting`, `busy`). False positives trigger unnecessary patient alerts.
4. **Zero-PII Compliance**: Automated systems must handle sensitive patient identification documents without risking leakage into version control, telemetry, or unencrypted logs.

### Goals
- **① Deterministic Multi-Branch Polling**: Continuously poll Branch `6035` and Branch `118` with adaptive frequency and session-aware backoff.
- **② 3-Rule Decision Core**: Evaluate candidate slots with 0% false positive rate using strict deterministic criteria:
  - **Rule 1 (Volume)**: Slot payload contains $> 2$ JSON schedule records.
  - **Rule 2 (Availability)**: Slot has explicit `status: "free"` (`waiting` and `busy` treated as occupied).
  - **Rule 3 (Horizon)**: Slot date is in the future relative to local Colombian calendar date (`America/Bogota`).
- **③ 1-Click Telegram Alerts**: Deliver instant, actionable notifications with inline callback buttons, preventing alert fatigue through state deduplication.
- **④ Sub-Second Booking (<1000ms)**: Upon human confirmation, launch a pre-warmed, stealth Chromium browser to complete multi-step patient appointment forms under 1 second.
- **⑤ Strict Operational Guardrails**: Enforce P-SEC (Zero PII, masked IDs), P-NET (30s+ jittered polling, 10m circuit breaker), P-ACT (Human-in-the-loop, single-browser mutex), and P-DEV (feature branch isolation, zero direct push to `main`).

### Non-Goals
- Autonomous, unconfirmed bookings without patient consent (strictly banned by `P-ACT-01`).
- Bypassing medical quotas or government prescription validation systems.
- Distributed brute-force scraping across proxy botnets.
- Maintaining long-term user profile databases (profiles remain local and hermetic).

### Core Principles & Behavioral Hypotheses

| Assumption / Invariant | Validation & Evidence Mechanism |
| :--- | :--- |
| **Qanty Session Lifetime** | Harvested session cookie and ID remain valid for up to 90 minutes; tested via `SessionHarvester` TTL monitors. |
| **Branch Identifiers** | External branch IDs (`6035`, `118`) map to immutable Firestore company collections (`862...`, `rJ9...`); verified in `testBranches.ts`. |
| **Slot Availability Semantics** | Only `status === 'free'` indicates real bookable capacity; `waiting` represents reservations in progress. |
| **Calendar Horizon** | Qanty rejects appointments booked for past or current-day dates; only $D+1$ onwards is valid. |
| **Human-in-the-Loop Latency** | Telegram push + human button tap takes 2–8s; automated browser filling must take $<1\text{s}$ to win the race condition. |

---

## 2. Architecture: Dual-Process, One Ontology

Following Kahneman's cognitive paradigm, SMS splits into two distinct operational systems communicating through a shared domain ontology:

```
+---------------------------------------------------------------------------------------------------------------+
|                                            ORIGINAL TARGET SERVICE                                            |
|                        Qanty Healthcare Portal (POST /p/appointments/list_day_schedule)                       |
+-------------------------------------------------------+-------------------------------------------------------+
                                                        |
                            probes & session token      |      POST 200 OK (Slots JSON)
                                                        v
+------------------------------------+   +-------------------------------+   +----------------------------------+
| SYSTEM 2: DISCOVERY & ADAPTIVE     |   | SHARED MEMORY & CONTRACTS     |   | SYSTEM 1: DETERMINISTIC RUNTIME  |
| INTELLIGENCE (OFFLINE / HARNESS)   |   |                               |   | (DEPLOYED ENGINE)                |
|                                    |   | - Domain Ontology (Zod):      |   |                                  |
| - Session Harvester:               |   |   Branches, Slots, Profiles   |   | - Event Poller Core:             |
|   Headless Playwright handshake    |-->| - Branch Firestore Mapping:   |-->|   Pure functional multiplexer    |
|   reCAPTCHA v3 & 90m TTL cookie    |   |   Branch 6035 <-> 862...      |   |   Concurrent branch queries      |
| - Adaptive Scheduler:              |   |   Branch 118  <-> rJ9...      |   | - Decision Core (3 Rules):       |
|   Peak (06:00-08:00) vs Off-peak   |   | - State Deduplication:        |   |   >2 slots, free, future date    |
| - Circuit Breaker & Jitter Guard:  |   |   In-memory notified slots    |   | - Telegram Notifier (grammY):    |
|   30s min + ±5-15s jitter          |   |   Zero alert spam             |   |   1-Click Interactive Keyboards  |
|   10m freeze on HTTP 429/403       |   |                               |   | - Scheduler MCP / Booker:        |
| - API Discovery & Traffic Sniffer  |   |                               |   |   Playwright Browser Mutex       |
|   (IP-001 Reverse Engineering)     |   |                               |   |   Sub-second form completion     |
+------------------------------------+   +-------------------------------+   +----------------------------------+
                                                        |                                     |
                                                        |                                     | 1-Click Alert
                                                        |                                     v
                                                        |                    +----------------------------------+
                                                        |                    | TELEGRAM PATIENT                 |
                                                        |                    | (Human-in-the-Loop Confirmation) |
                                                        |                    +----------------------------------+
                                                        |                                     |
                                                        |                                     | Tap "Agendar"
                                                        |                                     v
                                                        |                    +----------------------------------+
                                                        |                    | PLAYWRIGHT AUTOMATION            |
                                                        |                    | Mutex Lock -> Form Auto-fill <1s |
                                                        +------------------->| Booking Confirmation Screen      |
                                                                             +----------------------------------+
                                                                                              |
                                                                                              v
+---------------------------------------------------------------------------------------------------------------+
| VERIFICATION & DRIFT GOVERNANCE                                                                               |
| - Automated Test Suites (5/5 passing): testRules, testGuardrails, testAdaptive, testBranches, testSession    |
| - Differential Tester: Replays recorded API JSON against Decision Core to guarantee 0% false positives      |
| - Guardrail Canary: Verifies P-SEC (zero PII leakage), P-NET (rate limits), P-ACT (human safety mutex)       |
+---------------------------------------------------------------------------------------------------------------+
```

### Component Details

#### 1. System 2: Discovery & Adaptive Intelligence (The Harness)
- **Session Harvester (`SessionHarvester`)**: Launches a stealth Chromium instance to navigate `https://qanty.com/dispensario-medic-colombia`, triggers the background `regular_start` challenge, harvests cookies and authenticated session IDs, and caches them for 90 minutes. If reCAPTCHA scores flag a bot (`code === 'BOT'`), it activates a 10-minute cooldown to prevent browser spam (`P-NET-03`).
- **Adaptive Scheduler (`AdaptiveScheduler`)**: Adjusts polling intervals based on dispensary release cycles:
  - *Peak Window (06:00 – 08:00 COT)*: Aggressive cadence (~30s base + jitter).
  - *Day Window (08:00 – 18:00 COT)*: Moderate cadence (~60s base + jitter).
  - *Off-Peak / Night (18:00 – 06:00 COT)*: Conservation cadence (~120s base + jitter).
- **Circuit Breaker**: Tracks HTTP response codes. If an upstream `429 Too Many Requests` or `403 Forbidden` occurs, all outbound requests halt for 10 minutes (`P-NET-01`).

#### 2. Shared Memory: Domain Ontology & Contracts
- **Branch Ontology**:
  - `6035`: Medellín Principal (Dispensario Carrera 43A) $\rightarrow$ Firestore ID `86234...`
  - `118`: Medellín Oriental (Dispensario Calle 50) $\rightarrow$ Firestore ID `rJ931...`
- **Slot Contract**: Zod-validated schema guaranteeing fields `id`, `date`, `time`, `branchId`, `status`, and `displayHour`.
- **State Deduplication**: An in-memory cache tracking notified slots (`${branchId}:${date}:${time}`). Even if the poller queries every 30s, identical openings are only broadcast once.

#### 3. System 1: Deterministic Engine & Booking Runtime
- **Event Poller (`@sms/poller`)**: Pure functional core without mutable module state or class inheritance. Exposes `createPoller` and `onAvailability`, emitting standard `CustomEvent` instances over `EventTarget`. Concurrently queries configured branches using `Promise.all`.
- **Decision Core (`rules.ts`)**: Evaluates raw responses using pure mathematical logic:
  $$\text{Valid}(\text{slots}) = (|\text{slots}| > 2) \land (\exists s \in \text{slots} : s.\text{status} = \text{'free'}) \land (s.\text{date} > \text{today}_{\text{Bogota}})$$
- **Telegram Bot (`TelegramBot`)**: Built with **grammY**. Delivers formatted markdown alerts displaying the dispensary name, target date, slot time, and a 1-click inline button (`Agendar cita`).
- **Scheduler MCP / Playwright Booker (`PlaywrightBooker`)**: Holds a strict process mutex (`isBookingMutex`). When the user taps the Telegram button:
  1. Acquires mutex (rejects concurrent requests).
  2. Launches stealth Chromium with `--disable-blink-features=AutomationControlled`.
  3. Injects user profile (Document ID, Phone, Birthdate, Prescription Details).
  4. Fills and submits the multi-page Qanty flow in $< 1000\text{ms}$.
  5. Takes screenshot receipt and delivers it to Telegram.
  6. Releases mutex.

---

## 3. Architecture Decisions & Trade-Off Matrix

| Architectural Seam | Chosen Solution | Rejected Alternatives & Rationale |
| :--- | :--- | :--- |
| **Runtime & Language** | **Node.js v20+ / Bun & TypeScript Strict Mode** (`ADR-001`) | *Python / Scrapy*: Too slow for sub-second UI form completion; weak typed integration with Telegram frameworks.<br>*Go*: Excellent concurrency, but Playwright ecosystem is second-tier compared to Node.js. |
| **Browser Automation** | **Microsoft Playwright with Stealth Flags** (`ADR-002`) | *Puppeteer*: Prone to anti-bot fingerprints on modern Cloudflare/reCAPTCHA challenges.<br>*Selenium*: Heavyweight, slower startup latency ($>3\text{s}$), unreliable headless event sniffing. |
| **HTTP & Networking** | **Native Fetch API + In-Memory Circuit Breaker** (`ADR-003`) | *Axios*: Unnecessary dependency overhead; does not leverage native Node 20 stream optimizations.<br>*Got / Request*: Deprecated or redundant with modern web standards. |
| **Telegram Framework** | **grammY** (`ADR-004`) | *Telegraf*: Stale TypeScript definitions, less robust typed inline keyboard builder.<br>*Raw Bot API*: High maintenance burden for callback routing and webhook session state. |
| **Data Validation** | **Zod Schemas** (`ADR-005`) | *Joi / Yup*: Poor static TypeScript type inference.<br>*JSON Schema raw*: Cumbersome DX without automated type extraction. |
| **Poller Architecture** | **Functional Event Poller (`packages/poller`)** | *Monolithic OOP Poller*: Tight coupling between network I/O, rule evaluation, and Telegram messaging prevented independent testing and Bun bundling. |
| **Booking Safety** | **Human-in-the-Loop Mutex Lock (`P-ACT-01`)** | *Fully Autonomous Booker*: Risk of booking wrong appointments, burning patient quota, or violating ethical boundaries. |

---

## 4. Verification, Guardrails & Governance

### Verification Suite (`npm test`)
The test harness runs hermetically without making live outbound network requests or launching actual browsers:
1. `testRules.ts`: Validates that Rule 1, Rule 2 (including WAITING slot exclusion), and Rule 3 evaluate identically across single and nested payload structures.
2. `testGuardrails.ts`: Validates automated checks for `P-SEC`, `P-ACT`, and `P-NET` invariants.
3. `testAdaptiveScheduler.ts`: Confirms mathematical correctness of peak/off-peak intervals and verifies jitter randomness boundaries.
4. `testBranches.ts`: Confirms Branch `6035` and Branch `118` Firestore mapping, payload structures, and session failure handling.
5. `testSessionHarvester.ts`: Confirms session TTL expiration and cookie parsing logic.

### Guardrails Enforcement Matrix

```
+------------------------------------------------------------------------------------------------------+
| CODEBASE GUARDRAIL                   IMPLEMENTATION MECHANISM                  ENFORCEMENT LOCATION  |
+------------------------------------------------------------------------------------------------------+
| P-DEV-01: Strict Branching           Git Worktrees + GitHub Pull Requests      CI Quality Gate       |
| P-DEV-02: English Codebase           Strict English code, comments & ADRs      Code Review & Linter  |
| P-SEC-01: Zero PII in Git            profiles.json in .gitignore               pre-commit hook & CI  |
| P-SEC-02: National ID Masking        Leading digits masked (******7890)        Telegram / Logs       |
| P-NET-01: Minimum 30s Polling        AdaptiveScheduler enforces 30s floor      packages/poller       |
| P-NET-03: Circuit Breaker            10-minute cooldown on HTTP 429/403        CircuitBreaker class  |
| P-ACT-01: Human Confirmation         Telegram inline button tap mandatory      telegramBot.ts        |
| P-ACT-02: Single-Browser Mutex       Strict isBookingMutex lock                playwrightBooker.ts   |
+------------------------------------------------------------------------------------------------------+
```

### Interactive Architecture Diagram
The validated interactive HTML diagram is published and available at:
- **Interactive SVG/HTML Diagram**: [`.archify/architecture-sms-scheduler-20261013-161115/sms-architecture.html`](file:///home/ale/Work/sms-smart-medicine-scheduler/.archify/architecture-sms-scheduler-20261013-161115/sms-architecture.html)
- **Specification Source**: [`.archify/architecture-sms-scheduler-20261013-161115/candidate.json`](file:///home/ale/Work/sms-smart-medicine-scheduler/.archify/architecture-sms-scheduler-20261013-161115/candidate.json)
