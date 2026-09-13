# Implementation Plan: IP-001 — Qanty API Discovery & Reverse Engineering

**Plan ID**: `IP-001`  
**Related OpenSpec**: [`openspec/specs/api-discovery/spec.md`](../../openspec/specs/api-discovery/spec.md)  
**Status**: `Ready for Execution`  
**Target Portal**: `https://qanty.com/portals/appointments?c=Lpds45xBMVIpsXiSxaTy`

---

## 1. Context & Objectives

To enable the scheduler to monitor appointment slots with 100% accuracy without relying on synthetic payloads, we must discover the live schema directly from the official Qanty medicine dispensing portal.

### Core Objectives:
1. **Intercept Genuine HTTP Traffic**: Record all XHR / Fetch network transactions from `qanty.com` during initial portal load and appointment navigation.
2. **Discover Key Operational Parameters**:
   - `company_id` / `c`: Verify transmission of company code `Lpds45xBMVIpsXiSxaTy`.
   - `branch_id`: Active clinic and dispensary branch IDs.
   - `service_id`: Medicine dispensing service identifiers.
   - Request payload structure for `POST /p/appointments/list_day_schedule`.
3. **Verify Response Schema**: Confirm envelope packaging (`data`, `items`, `schedules`, date formats, and status flags).

---

## 2. Implementation Tasks (Task Breakdown)

- [x] **Task 1 (Playwright Network Sniffer)**:
  - Create `src/tools/inspectQantyApi.ts` in TypeScript.
  - Listen to `page.on('request')` and `page.on('response')`.
  - Filter network requests targeting `qanty.com`.
  - Export full JSON request and response dumps to `dumps/api/`.

- [x] **Task 2 (Discovery Script Wiring)**:
  - Register script in `package.json`: `"inspect:api": "tsx src/tools/inspectQantyApi.ts"`.
  - Configure target navigation to `https://qanty.com/portals/appointments?c=Lpds45xBMVIpsXiSxaTy`.
  - Support visible browser window (`headless: false`) for interactive clinic selection.

- [ ] **Task 3 (Live Execution & Schema Extraction)**:
  - Run `npm run inspect:api`.
  - Inspect JSON dumps captured in `dumps/api/`.
  - Consolidate discovered schema in `dumps/api/discovered_schema.json`.

- [ ] **Task 4 (HTTP Client Parameter Alignment)**:
  - Update `src/poller/qantyClient.ts` with genuine parameter names and discovered IDs.
  - Verify that `npm test` passes with 100% coverage.

---

## 3. Acceptance Criteria

1. Running `npm run inspect:api` cleanly intercepts and outputs all XHR requests to Qanty.
2. Generates at least one valid dump of the portal initialization calls (`/p/regular_start` or `/p/appointments/list_day_schedule`).
3. The client `qantyClient.ts` leverages discovered parameters for live polling.
