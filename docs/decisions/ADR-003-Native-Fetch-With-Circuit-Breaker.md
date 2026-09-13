# ADR-003: Use Node.js Native Fetch with Circuit Breaker Resiliency

## Status
Accepted

## Date
2026-09-13

## Context
Once an active session or valid API contract is identified, polling the appointment schedule every 35–50 seconds via a full browser instance would be resource-wasteful, consuming excessive CPU and memory. The polling engine needs a fast, lightweight HTTP client that can:
- Execute `POST` requests to `https://qanty.com/p/appointments/list_day_schedule` in under 100ms.
- Maintain minimal memory footprint during 24/7 background execution.
- Implement protective circuit breakers to prevent IP rate-limiting or blocking (HTTP 429/403).

## Decision
Use Node.js **Native Fetch API** (standardized in Node 18+) combined with an in-memory **Circuit Breaker pattern** (`G-NET-03`).

## Alternatives Considered

### Axios
- **Pros**: Popular, rich interceptor ecosystem.
- **Cons**: Adds a 1.5MB+ external dependency with transitive packages. Requires maintenance and updates for security advisories without providing any functionality beyond native `fetch`.
- **Rejected**: Redundant overhead when modern Node.js provides a compliant, high-performance Fetch implementation natively.

### Got
- **Pros**: Robust HTTP client with advanced retry engines.
- **Cons**: Substantial dependency footprint with steep learning curve and complex stream handling not required for straightforward JSON RPC calls.
- **Rejected**: Added complexity without architectural advantage.

## Consequences
- **Positive**: Zero external npm dependencies for HTTP networking.
- **Positive**: Standard Web API `Request` and `Response` interfaces ensure portable code.
- **Positive**: Guardrail `G-NET-03` circuit breaker pauses requests for 10 minutes upon receiving 429/403 status codes, safeguarding the user's IP reputation.
- **Negative**: Manual configuration of timeouts and request headers required (encapsulated cleanly in `QantyClient`).
