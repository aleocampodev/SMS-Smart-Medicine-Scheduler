# OpenSpec: Playwright Booker & Headless Browser Optimization (Addy Osmani Principles)

**ID**: `playwright-booker`  
**Version**: `1.0.0`  
**Author**: Based on Addy Osmani's web quality and headless browser automation guidelines (`web-quality-skills`)  
**Status**: `Active`

---

## 1. Addy Osmani Principles Applied to Medicine Scheduling

Automating high-demand medicine pickup appointments requires maximum execution speed, deterministic reliability, and minimal resource footprints. We enforce 4 core pillars:

```
                  ┌──────────────────────────────────────────────┐
                  │      ADDY OSMANI WEB QUALITY PRINCIPLES      │
                  └──────────────────────┬───────────────────────┘
                                         │
         ┌──────────────────┬────────────┴─────────┬──────────────────┐
         ▼                  ▼                      ▼                  ▼
  [⚡ Fast Navigation]   [🛡️ Trace Evidence]   [🚫 Resource Route]   [🎯 Resilient Selectors]
  - domcontentloaded     - Playwright tracing  - Block heavy media    - aria/label first
  - Micro-benchmarks     - Export on failure   - Save CPU & data      - Progressive fallback
```

---

## 2. Performance Guidelines & Budgets

1. **Latency Budget**:
   - Initial navigation & load time: $< 3.0\text{ s}$.
   - Form data injection time: $< 1.0\text{ s}$.
   - Total round-trip booking time: $< 6.0\text{ s}$.

2. **Smart Resource Routing**:
   - To maximize speed and reduce memory consumption, intercept and abort:
     - `media` (video/audio streams)
     - `font` (heavy external web fonts non-critical for form interactions)
     - Third-party analytics trackers (Google Analytics, Hotjar, Facebook Pixel)

3. **Forensic Diagnosis with Tracing (DevTools Traces)**:
   - Launch `context.tracing.start({ screenshots: true, snapshots: true, sources: true })`.
   - On booking success: Discard trace in memory to save disk space.
   - On booking failure: Export `traces/trace_<id>_<timestamp>.zip` for deep inspection via `playwright show-trace` or Chrome DevTools MCP.

4. **Resilient Accessible Selectors (a11y First)**:
   - Prioritize semantic accessibility selectors (`getByRole`, `getByLabel`, `getByPlaceholder`) over fragile obfuscated CSS class names.
