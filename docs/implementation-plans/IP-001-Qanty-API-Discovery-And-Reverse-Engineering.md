# Implementation Plan: IP-001 — Qanty API Discovery & Reverse Engineering

**Plan ID**: `IP-001`  
**Related OpenSpec**: [`openspec/specs/api-discovery/spec.md`](../../openspec/specs/api-discovery/spec.md)  
**Status**: `Ready for Execution`  
**Target Portal**: `https://qanty.com/portals/appointments?c=Lpds45xBMVIpsXiSxaTy`

---

## 1. Contexto y Objetivos

Para que el bot consulte con exactitud los cupos de citas y no opere con parámetros hipotéticos, necesitamos descubrir la estructura real de la API de Qanty directamente desde el portal oficial de dispensación de medicamentos.

### Objetivos Principales:
1. **Capturar peticiones HTTP reales**: Interceptar todo el tráfico XHR/Fetch de `qanty.com` durante la carga del portal y la navegación de citas.
2. **Descubrir Parámetros Clave**:
   - `company_id` / `c`: Confirmar si `Lpds45xBMVIpsXiSxaTy` viaja en headers o body.
   - `branch_id` (Sedes disponibles para reclamar medicamentos).
   - `service_id` (Servicios de dispensación).
   - Estructura exacta del payload de `POST /p/appointments/list_day_schedule`.
3. **Validar Esquema de Respuesta**: Confirmar cómo viajan los turnos en el JSON (`data`, `items`, `schedules`, formato de fechas y status).

---

## 2. Tareas de Implementación (Task Breakdown)

- [ ] **Tarea 1 (Script Sniffer con Playwright)**:
  - Crear `src/tools/inspectQantyApi.ts` en TypeScript.
  - Escuchar eventos `page.on('request')` y `page.on('response')`.
  - Filtrar URLs pertenecientes a `qanty.com`.
  - Volcar requests y responses completos en `dumps/api/`.

- [ ] **Tarea 2 (Ejecución de Descubrimiento)**:
  - Añadir script en `package.json`: `"inspect:api": "tsx src/tools/inspectQantyApi.ts"`.
  - Ejecutar el sniffer navegando a `https://qanty.com/portals/appointments?c=Lpds45xBMVIpsXiSxaTy`.
  - Permitir modo con ventana visible (`headless: false`) para interactuar con la página si solicita seleccionar sede.

- [ ] **Tarea 3 (Análisis y Extracción de Esquema)**:
  - Analizar los volcados JSON capturados en `dumps/api/`.
  - Consolidar en un informe `dumps/api/discovered_schema.json` con los headers y payloads reales.

- [ ] **Tarea 4 (Actualización del Cliente HTTP)**:
  - Actualizar `src/poller/qantyClient.ts` con el payload exacto descubierto.
  - Validar que `npm test` pase al 100%.

---

## 3. Criterios de Aceptación

1. El script `npm run inspect:api` captura de forma limpia todas las peticiones XHR a Qanty.
2. Se genera al menos un volcado válido de las llamadas iniciales (`/p/regular_start` o `/p/appointments/list_day_schedule`).
3. El cliente `qantyClient.ts` utiliza los parámetros reales obtenidos.
