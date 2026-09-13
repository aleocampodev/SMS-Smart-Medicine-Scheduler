# ADR-002: Use Playwright for Web Automation & Reactive Network Sniffing

## Status
Accepted

## Date
2026-09-13

## Context
The Qanty appointment portal utilizes dynamic client-side rendering (Vue/Vite single-page application) protected by Google reCAPTCHA v3. Direct HTTP scraping (such as Cheerio or Axios) fails immediately with `INVALID_SESSION` because the portal requires client-side JavaScript execution and anti-bot verification (`POST /p/regular_start`). The system needs a browser engine that can:
- Execute client JavaScript to pass reCAPTCHA v3 human scoring.
- Intercept network requests and responses directly (`POST /p/get_branches`, `/p/appointments/list_day_schedule`).
- Provide resilient form automation with low latency (<1s page interactions).
- Support forensic diagnostics (screenshots, traces) when booking fails.

## Decision
Adopt **Microsoft Playwright** as the primary browser automation and network discovery engine, paired with Chromium anti-detection flags (`--disable-blink-features=AutomationControlled`) and Addy Osmani web performance patterns.

## Alternatives Considered

### Puppeteer
- **Pros**: Mature, lightweight Chromium automation library by Google.
- **Cons**: Lacks built-in multi-context tracing, requires extensive third-party plugins (`puppeteer-extra-plugin-stealth`) to bypass modern bot scoring, and has less robust network request routing.
- **Rejected**: Playwright provides superior native request routing (`route.abort()`), built-in tracing, and modern selector ergonomics out of the box.

### Selenium WebDriver
- **Pros**: Cross-browser industry veteran; widely known.
- **Cons**: Heavy Java-oriented architecture, slower execution speed, complex WebDriver binary management, and weak asynchronous network interception APIs.
- **Rejected**: Inadequate for high-speed reactive network sniffing and lightweight automation.

### Pure HTTP Scraping (Cheerio / HTML Parsers)
- **Pros**: Extremely fast; no browser overhead.
- **Cons**: Cannot execute JavaScript. Qanty does not render appointments in server-side HTML; all appointments and branches are fetched dynamically via client-side XHR/fetch after reCAPTCHA verification.
- **Rejected**: Technically incapable of completing the session initialization handshake.

## Consequences
- **Positive**: Direct access to raw API JSON payloads via `page.on('response')` without brittle HTML parsing.
- **Positive**: Sub-second booking page loads achieved by aborting non-essential fonts, images, and analytics trackers.
- **Positive**: Trace archives (`.zip`) allow forensic playback of failed bookings.
- **Negative**: Chromium binaries require additional disk space (~200MB–300MB).
