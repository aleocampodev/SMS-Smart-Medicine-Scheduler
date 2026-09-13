# OpenSpec: Qanty Portal API Discovery & Traffic Sniffer (AD-SPEC)

**ID**: `api-discovery`  
**Version**: `1.0.0`  
**Status**: `Active`  
**Scope**: Passive traffic sniffing, network interception, and live schema extraction from the Qanty dispensary portal (`?c=Lpds45xBMVIpsXiSxaTy`).

---

## 1. Purpose & Scope

To ensure the poller and booking engine operate deterministically without schema guesswork, this module:
1. Navigates to the real Qanty portal (`https://qanty.com/portals/appointments?c=Lpds45xBMVIpsXiSxaTy`).
2. Intercepts **all XHR / Fetch network requests** emitted by the SPA.
3. Records full request and response payloads (headers, query params, cookies, JSON bodies).
4. Extracts actual dispensary branch IDs (`branch_id`), service IDs (`service_id`), and the exact response format of `/p/appointments/list_day_schedule`.

---

## 2. Functional Requirements

```
+-------------------------------------------------------------+
|               Playwright Network Interceptor                |
+------------------------------+------------------------------+
                               |
            Navigates to portal with c=Lpds45xBMVIpsXiSxaTy
                               |
                               v
            +------------------------------------+
            | Intercepts page.on('request')      |
            | Intercepts page.on('response')     |
            +------------------+-----------------+
                               |
               Filters traffic to https://qanty.com/*
                               |
                               v
             +----------------------------------+
             | Exports dumps/api/<timestamp>/   |
             | - req_<endpoint>.json            |
             | - res_<endpoint>.json            |
             | - discovered_summary.json        |
             +----------------------------------+
```

### 2.1. Inputs
- `targetUrl`: Portal URL (`https://qanty.com/portals/appointments?c=Lpds45xBMVIpsXiSxaTy`).
- `mode`: Headful mode (to allow interactive branch selection) or headless.

### 2.2. Outputs
- Dumps directory: `dumps/api/` (ignored in git).
- Summary file: `dumps/api/discovered_summary.json` containing:
  - Detected endpoints.
  - Active session tokens and headers.
  - Request body parameters for availability queries.

---

## 3. Enforced Guardrails

- **`G-SEC-01`**: Dumps in `dumps/` are strictly gitignored to prevent leaking temporary tokens.
- **`G-NET-04`**: The sniffer uses stealth flags (`--disable-blink-features=AutomationControlled`) to prevent reCAPTCHA blocks.
