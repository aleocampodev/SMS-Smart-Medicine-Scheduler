# OpenSpec: Qanty Portal API Discovery & Traffic Sniffer (AD-SPEC)

**ID**: `api-discovery`  
**Version**: `1.0.0`  
**Status**: `Active`  
**Scope**: Infiltración pasiva, intercepción de tráfico de red y captura de esquemas reales de la API de Qanty desde el portal de dispensación (`?c=Lpds45xBMVIpsXiSxaTy`).

---

## 1. Propósito y Alcance

Para que el poller y el motor de reservas funcionen de forma determinista y sin errores de schema, se requiere una herramienta de ingeniería inversa y descubrimiento que:
1. Navegue al portal real de Qanty (`https://qanty.com/portals/appointments?c=Lpds45xBMVIpsXiSxaTy`).
2. Intercepte **todas las peticiones XHR / Fetch** emitidas por la aplicación Single Page Application (SPA).
3. Guarde los payloads exactos enviados y recibidos (headers, query params, cookies, body JSON).
4. Extraiga los IDs reales de sedes (`branch_id`), servicios (`service_id`) y el formato exacto de respuesta de `/p/appointments/list_day_schedule`.

---

## 2. Requerimientos Funcionales

```
+-------------------------------------------------------------+
|               Playwright Network Interceptor                |
+------------------------------+------------------------------+
                               |
               Navega a portal con c=Lpds45xBMVIpsXiSxaTy
                               |
                               v
            +------------------------------------+
            | Intercepta page.on('request')      |
            | Intercepta page.on('response')     |
            +------------------+-----------------+
                               |
               Filtra tráfico hacia https://qanty.com/*
                               |
                               v
             +----------------------------------+
             | Exporta dumps/api/<timestamp>/   |
             | - request_<endpoint>.json        |
             | - response_<endpoint>.json       |
             | - summary_discovered.json        |
             +----------------------------------+
```

### 2.1. Entradas
- `targetUrl`: URL completa del portal (`https://qanty.com/portals/appointments?c=Lpds45xBMVIpsXiSxaTy`).
- `mode`: Modo `headful` (para permitir al usuario seleccionar sede o resolver captcha si es necesario) o `headless`.

### 2.2. Salidas
- Directorio de volcados: `dumps/api/` (ignorado en git).
- Archivo consolidado: `dumps/api/discovered_endpoints.json` con:
  - Endpoints detectados (`POST /p/appointments/list_day_schedule`, `/p/regular_start`, etc.).
  - Headers de autenticación o tokens de sesión observados.
  - Parámetros necesarios en el body para consultar la disponibilidad.

---

## 3. Guardrails Aplicados

- **`G-SEC-01`**: Los volcados en `dumps/` deben estar en `.gitignore` para no filtrar tokens temporales en Git.
- **`G-NET-04`**: El sniffer debe usar User-Agent y flags stealth (`--disable-blink-features=AutomationControlled`) para que el portal cargue sin bloqueos de reCAPTCHA.
