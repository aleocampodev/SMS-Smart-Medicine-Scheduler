# AGENTS.md — Agent & Developer Operating Manual

Welcome to **SMS (Smart Medicine Scheduler)**. This document provides the Level 1 operating context, architectural boundaries, tech stack specifications, and development rules governing this codebase.

---

## 1. Project Overview

SMS is a resilience-driven autonomous system that monitors healthcare dispensary appointment availability on the **Qanty** portal, applies deterministic business rules, delivers 1-click booking alerts to Telegram, and executes sub-second Playwright form completion with Addy Osmani performance patterns.

- **Primary Target Dispensaries**: Medellín Branch `6035` and Medellín Branch `118`.
- **Operating Methodology**: Organic-Driven Development (ODD), Human-in-the-loop, Zero-PII-leakage.

---

## 2. Technology Stack

- **Runtime**: Node.js v20+ LTS
- **Language**: TypeScript 5.8+ (Strict Mode)
- **Dev Runner**: TSX (`tsx`) via `esbuild` for instant execution without pre-compilation
- **Browser Automation**: Microsoft Playwright (Chromium with anti-detection flags)
- **HTTP Client**: Node.js Native Fetch API with in-memory Circuit Breaker
- **Messaging**: grammY (Telegram Bot framework with typed InlineKeyboards)
- **Validation**: Zod (Runtime schema validation and data transformations)
- **Monorepo & Build System**: Turborepo with Bun 1.4+ (Catalog & Workspaces)

---

## 3. Essential Commands

```bash
# Build & Compilation
npm run build              # Compile TypeScript via tsc (must have 0 errors)

# Automated Test Suite
npm test                   # Run all 4 test suites (rules, guardrails, scheduler, branches)
npm run test:rules         # Unit tests for the 3 business rules & state deduplication
npm run test:guardrails    # Automated checks for P-SEC, P-ACT, P-NET guardrails
npm run test:adaptive      # Verification of adaptive daily scheduling & jitter
npm run test:branches      # Unit tests for multi-branch 118 and 6035 resolution

# Runtime
npm start                  # Start production poller and Telegram bot
npm run dev                # Start with file watching (tsx watch)

# Discovery & Tools
npm run list:branches      # Launch stealth browser to discover all active Qanty branches
npm run inspect:api        # Network traffic sniffer (IP-001)
```

---

## 4. Immutable Project Guardrails & Boundaries

Every agent and human contributor must strictly adhere to the project guardrails:

### 🛑 Strict Push & Branch Policy (`P-DEV-01`)

- **NEVER push directly to `main` (`git push origin main` is prohibited).**
- **NEVER merge directly to `main` in local git.**
- All work (`feat`, `fix`, `docs`, `refactor`, `test`) must be conducted in dedicated branches (`<type>/<scope>/<description>`).
- All integrations into `main` must be performed through GitHub Pull Requests (`gh pr create` and `gh pr merge`).

### 🌐 Strict Language Policy

- All codebase elements—including source code, comments, logs, documentation, ADRs, commit messages, and PR descriptions—must be written strictly in **English**.

### 🔒 Privacy & PII Protection (`P-SEC-01`, `P-SEC-02`)

- Real identity documents, names, and phone numbers in `profiles.json` must **NEVER** be committed to Git (`.gitignore` enforced).
- All logs and Telegram messages displaying national IDs must mask leading digits (e.g. `******7890`).

### ⚡ Networking & Rate Limiting (`P-NET-01`, `P-NET-03`)

- Minimum polling cadence is 30 seconds with random jitter ($\pm 5\text{s}$ to $\pm 15\text{s}$).
- Outgoing requests must halt for 10 minutes upon receiving HTTP `429` or `403` (Circuit Breaker).

### 🤖 Action Safety & Human-in-the-Loop (`P-ACT-01`, `P-ACT-02`)

- The system must never book appointments autonomously without human confirmation. A user must tap a Telegram inline button.
- Strictly **one** Playwright browser instance may book at any time (concurrency mutex lock).

---

## 5. Development Workflow — Organic-Driven Development (ODD)

This repository follows **ODD** (Organic-Driven Development) from Gentle-AI:
- **Authorization First**: Never mutate code without explicit requirement or confirmation. Always explore dependencies before touching files.
- **Keep Small Work Small**: Small tasks and fixes do not require heavy planning files; execute directly with tests and reviewable diffs.
- **Substantial Work Tracking**: Substantial features create a tracking document in `odd/tasks/<feature-name>.md` and mirror progress in **Engram** (`odd/<feature-name>/tasks`).
- **TDD by Default**: Write failing tests before implementation for any deterministic behavior.
- **Work-Unit Commits**: Slice changes into focused commits with a ~400 lines budget, pairing tests, code, and documentation.

---

## 6. Architectural Context Pointers

For in-depth specifications and architectural context, consult:

- **ODD Guidelines & Task Directory**: [`odd/README.md`](odd/README.md) & [`odd/tasks/`](odd/tasks/)
- **Project Specifications**: [`docs/specs/`](docs/specs/)
  - Availability Poller: [`docs/specs/availability-poller/spec.md`](docs/specs/availability-poller/spec.md)
  - Telegram Notifier: [`docs/specs/telegram-notifier/spec.md`](docs/specs/telegram-notifier/spec.md)
  - Playwright Booker: [`docs/specs/playwright-booker/spec.md`](docs/specs/playwright-booker/spec.md)
  - Guardrails & Safety: [`docs/specs/guardrails/spec.md`](docs/specs/guardrails/spec.md)
  - API Discovery: [`docs/specs/api-discovery/spec.md`](docs/specs/api-discovery/spec.md)
- **Project Guardrails**: [`docs/guardrails.md`](docs/guardrails.md)
- **Domain & Technical Glossary**: [`docs/glossary.md`](docs/glossary.md)
- **Architecture Decisions**: [`docs/decisions/`](docs/decisions/)
  - `ADR-001`: TypeScript & Node.js Runtime
  - `ADR-002`: Playwright Browser Automation
  - `ADR-003`: Native Fetch & Circuit Breaker
  - `ADR-004`: grammY Telegram Framework
  - `ADR-005`: Zod Schema Validation
