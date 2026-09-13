# ADR-001: Use Node.js 20+ with TypeScript and TSX Runtime

## Status
Accepted

## Date
2026-09-13

## Context
The Smart Medicine Scheduler (SMS) must run continuous long-lived polling, manage concurrent network events (HTTP requests, Telegram webhooks/long polling, Playwright browser instances), and safely process user profiles with zero runtime type ambiguities. Key requirements include:
- High asynchronous I/O performance for continuous polling and event listeners.
- Strict static typing across domain models (slots, profiles, booking results) to avoid subtle runtime crashes.
- Fast local development cycle without tedious, slow compilation steps.
- Single unified programming language across scraper, bot, rules engine, and test suites.

## Decision
Adopt **Node.js (v20+ LTS)** as the execution engine, **TypeScript (v5.8+)** for static type safety, and **TSX (`tsx`)** powered by `esbuild` as the development and script runner.

## Alternatives Considered

### Python (with Playwright + AsyncIO)
- **Pros**: Strong ecosystem for automation and scripting; clean syntax.
- **Cons**: Asynchronous code in Python (`asyncio`) is more error-prone across multiple threads/tasks compared to Node's native event loop. Typing (Mypy) is an external bolt-on rather than a first-class language paradigm.
- **Rejected**: Multi-threaded concurrency and Telegram bot + Playwright integration in Node.js provides a smoother, unified asynchronous mental model.

### Pure JavaScript (Node.js ESM)
- **Pros**: No build or transpilation step required; immediate execution.
- **Cons**: Lacks compile-time safety. In an automated health-critical scheduling system handling personal identity documents and appointments, accidental `undefined` errors or typos in payload properties would cause silent failures during booking.
- **Rejected**: Static typing is non-negotiable for system reliability.

### Go (Golang)
- **Pros**: High performance, small memory footprint, single binary distribution.
- **Cons**: Browser automation ecosystem in Go (chromedp, rod) is significantly less mature than Playwright in TypeScript. Lacks official Playwright parity for advanced network routing and tracing.
- **Rejected**: Playwright's primary and most mature API is JavaScript/TypeScript.

## Consequences
- **Positive**: Complete end-to-end type safety from `.env` to Qanty API payloads. Zero transpilation lag thanks to `tsx`.
- **Positive**: Shared types across all modules (`src/types/index.ts`).
- **Negative**: Requires Node.js runtime environment and pnpm package management.
