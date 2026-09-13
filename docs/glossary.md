# Project Glossary & Domain Terminology

This document establishes standard terminology and definitions across the **Smart Medicine Scheduler (SMS)** architecture, codebase, and business domain.

---

## 1. Domain & Business Concepts

### Medicine Dispensing Appointment (Cita de Reclamo de Medicamentos)
A scheduled appointment window required by healthcare institutions (EPS / pharmacies) for patients to pick up controlled and essential prescription medication in person at physical dispensary branches.

### Qanty Appointment Portal
The third-party appointment management web application (`https://qanty.com/portals/appointments?c=...`) utilized by pharmaceutical providers to manage queues, branches, and appointments.

### Dispensary Branch (Sede)
A physical branch location where medicine is dispensed. Each branch possesses a unique integer/string identifier within Qanty's system (e.g., Medellín Branch `6035`, Medellín Branch `118`).

### The 3 Business Rules
The deterministic criteria enforced by `RulesEngine` to distinguish between false/empty responses and real, actionable appointment slots:
1. **Rule 1 (Multiplicity)**: The API response array must contain strictly more than 2 items (`length > 2`). Payloads with $\le 2$ items are empty structural frames or placeholders.
2. **Rule 2 (Availability Status)**: The slot's `status` or `state` field must explicitly equal `'free'`, `'available'`, or `'disponible'`.
3. **Rule 3 (Future Date Only)**: The appointment date must strictly be a future date (`date !== today`). Same-day appointments are rejected due to clinical closing times and logistics.

---

## 2. Browser Automation & Reverse Engineering

### Playwright
A modern, open-source browser automation framework by Microsoft that provides unified control over Chromium, Firefox, and WebKit browsers. Used in SMS for session harvesting, network sniffing, and automated form completion.

### Reactive Network Sniffing / Request Interception
A pattern where browser network traffic (`page.on('request')`, `page.on('response')`) is intercepted in real time. This captures raw JSON payloads directly from backend endpoints (`/p/get_branches`, `/p/appointments/list_day_schedule`) without relying on brittle DOM scrapers.

### Addy Osmani Performance Patterns
Best practices implemented in `PlaywrightBooker`:
- **Resource Routing (`context.route`)**: Aborting heavyweight media, fonts, and third-party trackers (Google Analytics, Hotjar, Facebook) to reduce page load time from ~4s to <900ms.
- **Forensic Tracing (`context.tracing`)**: Recording network packets, console logs, and visual snapshots on failure into `.zip` archives while discarding them on success to save disk space.

### reCAPTCHA v3 & Stealth Mode
Google's risk-analysis bot detection engine. Unlike v2 (which displays image puzzles), v3 returns a score between 0.0 (bot) and 1.0 (human). SMS launches Chromium with `--disable-blink-features=AutomationControlled` and authentic desktop user agents to ensure valid session establishment without triggering bot challenges.

### CAPTCHA Fallback Guardrail (`G-ACT-04`)
If a hard CAPTCHA challenge or Cloudflare Turnstile block appears, the automated browser immediately stops, captures a full-page screenshot, sends an emergency Telegram alert to the user, and releases execution to a human.

---

## 3. Polling, Networking & Resiliency

### Adaptive Daily Scheduler
A time-aware scheduler that alters the polling frequency based on historical appointment cancellation dynamics:
- **Peak Hours (07:00–08:30, 11:30–13:00, 23:30–00:30)**: Fast polling every 35s–50s with random jitter.
- **Regular Hours (08:30–18:00)**: Standard monitoring every ~2 minutes.
- **Evening Hours (18:00–23:00)**: Low-frequency monitoring every ~5 minutes.
- **Night Repose (01:00–06:00)**: Sleep mode (~15 minutes) protecting IP reputation when clinics are closed.

### Jitter (Anti-Fingerprinting Delay)
A randomized micro-delay ($\pm 5\text{s}$ to $\pm 15\text{s}$) added to polling intervals. By converting regular clock-like request cadences into non-deterministic distributions, it avoids bot pattern detection algorithms on edge firewalls.

### Circuit Breaker Pattern (`G-NET-03`)
An automated safety mechanism: if the Qanty API returns HTTP `429` (Rate Limited) or `403` (Forbidden), the HTTP client immediately pauses all outgoing requests for a 10-minute cooldown (600,000 ms) to prevent IP blocking.

### Mutex Lock (Concurrency Lock, `G-ACT-02`)
A mutual exclusion boolean lock in `PlaywrightBooker` preventing parallel browser sessions from running concurrently. Ensures only one booking process occupies resources and memory at any given time.

---

## 4. Messaging & Security

### Human-in-the-Loop (HITL)
An operational philosophy where the robot continuously monitors and evaluates data, but critical life/health decisions (selecting which family member books the slot) remain under explicit human control via 1-click mobile prompts.

### Inline Keyboard (`InlineKeyboard`)
Interactive Telegram message buttons embedded directly beneath availability alerts, allowing users to trigger instant booking callbacks (`book:<slotId>:<profileId>`) with a single screen tap.

### Personally Identifiable Information (PII) Masking (`G-SEC-02`)
The cryptographic/string obfuscation of sensitive personal identification (national identity card numbers, phone numbers) in Telegram messages and system logs (e.g., `******7890`).

### OpenSpec Guardrails
The collection of 11 architectural invariants governing security (`G-SEC`), networking (`G-NET`), business integrity (`G-BIZ`), browser action (`G-ACT`), and developer workflows (`G-DEV`).
