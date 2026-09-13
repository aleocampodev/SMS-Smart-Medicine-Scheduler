# OpenSpec: Playwright Booker & Headless Browser Optimization (Addy Osmani Principles)

**ID**: `playwright-booker`  
**Version**: `1.0.0`  
**Author**: Basado en las guías de calidad web y automatización de navegador de Addy Osmani (`web-quality-skills`)  
**Status**: `Active`

---

## 1. Principios de Addy Osmani Aplicados al Agendamiento Web

La automatización de citas médicas de alta demanda requiere máxima velocidad de ejecución, confiabilidad determinista y mínimo consumo de recursos. Aplicamos 4 pilares fundamentales:

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

## 2. Directrices de Rendimiento (Performance Budgets)

1. **Presupuesto de Tiempo (Latency Budget)**:
   - Tiempo de carga y navegación inicial: $< 3.0\text{ s}$.
   - Tiempo de inyección de datos de formulario: $< 1.0\text{ s}$.
   - Tiempo total de ciclo de reserva: $< 6.0\text{ s}$.

2. **Bloqueo Inteligente de Recursos (Resource Routing)**:
   - Para acelerar la respuesta y reducir la huella de memoria en el runner, interceptar y abortar solicitudes de tipo:
     - `media` (videos/audios)
     - `font` (fuentes externas pesadas no críticas para interactuar)
     - `images` innecesarias (salvo capturas de comprobante)
     - Rastreadores de analítica de terceros (Google Analytics, Hotjar, etc.)

3. **Diagnóstico Forense con Tracing (DevTools Traces)**:
   - Iniciar `context.tracing.start({ screenshots: true, snapshots: true, sources: true })`.
   - Si la reserva es exitosa, descartar el trace para no consumir disco.
   - Si la reserva falla, exportar `trace-failure-<timestamp>.zip` para ser inspeccionado con `trace.playwright.dev` o Chrome DevTools MCP.

4. **Selectores Resilientes y Accesibles (a11y First)**:
   - Priorizar selectores basados en accesibilidad y semántica (`getByRole`, `getByLabel`, `getByPlaceholder`) antes que selectores frágiles basados en clases CSS dinámicas u ofuscadas.
