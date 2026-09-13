# OpenSpec: Guardrails & Safety Policies (G-SPEC)

**ID**: `guardrails`  
**Version**: `1.0.0`  
**Status**: `Active`  
**Scope**: Seguridad, Resiliencia de Red, Privacidad de Datos y Control de Ejecución para `sms-smart-medicine-scheduler`.

---

## 1. Visión General

Este documento establece los **guardrails obligatorios** (barreras de contención y seguridad) que gobiernan el ciclo de vida del Smart Medicine Scheduler. Ningún cambio de código o comportamiento en producción puede violar estas políticas.

```
                    ┌──────────────────────────────────────────────┐
                    │            OPENPEC GUARDRAILS                │
                    └──────────────────────┬───────────────────────┘
                                           │
         ┌──────────────────┬──────────────┴─────┬──────────────────┐
         ▼                  ▼                    ▼                  ▼
  [🛡️ Privacidad & PII]  [🌐 Red & Anti-Ban]   [⚙️ Reglas Negocio]  [🤖 Playwright & Ops]
  - No commit PII        - Rate Limit >= 30s   - 3 Reglas Qanty     - Human-in-the-loop
  - Enmascarar cédulas   - Jitter aleatorio    - Deduplicación      - Lock de concurrencia
  - .gitignore estricto  - Circuit Breaker     - Anti-spam          - Timeouts & Screenshots
```

---

## 2. Categorías de Guardrails

### 2.1. Seguridad y Privacidad (PII & Credentials)

| ID | Nombre | Severidad | Regla |
| :--- | :--- | :--- | :--- |
| **G-SEC-01** | **No PII en Repositorios** | `CRITICAL` | `profiles.json` y archivos con nombres, cédulas o teléfonos reales **NUNCA** deben ser rastreados en Git. Solo se permite versionar `profiles.example.json`. |
| **G-SEC-02** | **Enmascaramiento de Datos (Data Masking)** | `HIGH` | Todo log y mensaje de Telegram que muestre documentos debe ofuscar los primeros dígitos (ej. `*******7890`). |
| **G-SEC-03** | **Aislamiento de Tokens** | `CRITICAL` | `TELEGRAM_BOT_TOKEN` y llaves de acceso deben inyectarse exclusivamente por variables de entorno (`.env`), nunca hardcodeados. |

### 2.2. Red y Anti-Bloqueo (WAF & Rate Limiting)

| ID | Nombre | Severidad | Regla |
| :--- | :--- | :--- | :--- |
| **G-NET-01** | **Rate Limit Mínimo** | `HIGH` | El intervalo de consulta hacia `qanty.com` no debe ser inferior a **30 segundos** por defecto. |
| **G-NET-02** | **Jitter Aleatorio Anti-Fingerprint** | `MEDIUM` | Cada petición debe añadir un retardo aleatorio de $\pm 5$ a $\pm 15$ segundos para no generar un patrón estático detectable por WAF / Cloudflare. |
| **G-NET-03** | **Circuit Breaker (429 / 403)** | `HIGH` | Si la API de Qanty responde con código `429 (Too Many Requests)` o `403 (Forbidden)`, el poller debe detenerse inmediatamente por **10 minutos** con backoff exponencial. |
| **G-NET-04** | **Headers Realistas de Navegador** | `MEDIUM` | Toda solicitud HTTP debe incluir `User-Agent`, `Referer`, `Origin` y `Accept` idénticos a los enviados por un navegador Chrome en Linux/Windows. |

### 2.3. Validación e Integridad de Negocio

| ID | Nombre | Severidad | Regla |
| :--- | :--- | :--- | :--- |
| **G-BIZ-01** | **Validación Estricta de las 3 Reglas** | `CRITICAL` | Ninguna cita puede ser reportada como disponible si no satisface simultáneamente:<br>1. Cantidad de items retornados $> 2$<br>2. Estado del slot igual a `free`<br>3. Fecha del slot estrictamente diferente a la fecha actual (`slot.date != currentDate`). |
| **G-BIZ-02** | **Deduplicación Anti-Spam** | `HIGH` | Un slot ya notificado al usuario en Telegram no puede volver a emitir una notificación repetida a menos que expire su TTL en el State Store. |
| **G-BIZ-03** | **Validación de Schema Zod** | `HIGH` | Toda entrada externa (JSON de Qanty, perfiles de usuario, variables de entorno) debe ser validada en tiempo de ejecución con esquemas Zod antes de su uso. |

### 2.4. Automatización y Seguridad en Playwright

| ID | Nombre | Severidad | Regla |
| :--- | :--- | :--- | :--- |
| **G-ACT-01** | **Human-in-the-Loop Obligatorio** | `CRITICAL` | La acción de reservar un turno requiere confirmación explícita mediante interacción humana (clic en botón inline de Telegram con el perfil asignado). No se permiten reservas desatendidas sin consentimiento. |
| **G-ACT-02** | **Concurrencia Unitaria (Single Lock)** | `HIGH` | Solo se permite una única sesión activa de Playwright para agendamiento simultáneo para evitar colisiones de sesión o bloqueos de IP. |
| **G-ACT-03** | **Timeout Máximo y Limpieza de Zombis** | `HIGH` | Cualquier acción en el navegador tiene un timeout máximo estricto de **30 segundos**. El bloque `finally` debe garantizar el cierre de la instancia de `Browser` en cualquier caso de error. |
| **G-ACT-04** | **Escalada Ante CAPTCHA** | `HIGH` | Si durante la navegación se detecta un CAPTCHA interactivo o bloqueo Cloudflare, el script debe abortar el llenado forzado, tomar captura de pantalla y notificar al usuario para intervención manual en lugar de generar bloqueos permanentes. |
| **G-ACT-05** | **Evidencia Auditada por Screenshot** | `MEDIUM` | Cada intento de reserva (éxito o fallo) debe generar un archivo `.png` en disco con marca de tiempo y enviarse como comprobante a Telegram. |

### 2.5. Git y Desarrollo (Políticas del Repositorio)

| ID | Nombre | Severidad | Regla |
| :--- | :--- | :--- | :--- |
| **G-DEV-01** | **Main Branch Protection** | `CRITICAL` | **PROHIBIDO** hacer push directo o merge directo a `main`. Todo el código se gestiona en ramas de características (`feat/*`, `fix/*`). |

---

## 3. Matriz de Cumplimiento Técnico en Código

| Guardrail | Archivo de Implementación | Estrategia Técnica |
| :--- | :--- | :--- |
| `G-SEC-01` | `.gitignore` | `profiles.json` ignorado por defecto; se provee `profiles.example.json`. |
| `G-SEC-02` | `src/config/profiles.ts` | Función `maskDocument()` que oculta dígitos sensibles. |
| `G-NET-01` / `02` | `src/index.ts`, `src/config/env.ts` | Validación Zod `min(30)` + retardo aleatorio (`jitter`). |
| `G-NET-03` | `src/poller/qantyClient.ts` | Detección de HTTP 429/403 con backoff y flag de pausa. |
| `G-BIZ-01` / `02` | `src/poller/rulesEngine.ts` | Evaluación secuencial de reglas + `Set<string>` para deduplicación. |
| `G-ACT-01` | `src/bot/telegramBot.ts` | Botones de Telegram con callback seguro (`book:<slotKey>:<profileId>`). |
| `G-ACT-02` / `03` | `src/automation/playwrightBooker.ts` | Mutex / flag de ejecución + `try/finally` para `browser.close()`. |
| `G-ACT-05` | `src/automation/playwrightBooker.ts` | Captura obligatoria `page.screenshot()` enviada a Telegram. |
