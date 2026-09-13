# OpenSpec: Qanty Availability Poller & Rules Engine (AP-SPEC)

**ID**: `availability-poller`  
**Version**: `1.0.0`  
**Status**: `Active`  
**Related Guardrails**: `G-NET-01`, `G-NET-02`, `G-NET-03`, `G-BIZ-01`, `G-BIZ-02`

---

## 1. Propósito y Alcance

Este módulo es el sensor primario del sistema. Su responsabilidad exclusiva es consultar la API de horarios de Qanty de forma resiliente y determinar, mediante la aplicación determinista de 3 reglas de negocio, si existen turnos legítimos disponibles para alertar al usuario.

---

## 2. Contrato de Integración de la API Qanty

### 2.1. Especificación del Endpoint
- **URL**: `https://qanty.com/p/appointments/list_day_schedule`
- **Método HTTP**: `POST`
- **Headers Obligatorios**:
  - `Content-Type`: `application/json`
  - `Accept`: `application/json, text/plain, */*`
  - `User-Agent`: Navegador de escritorio verificado (Chrome en Linux/Windows)
  - `Referer`: `https://qanty.com/`
  - `Referrer-Policy`: `strict-origin-when-cross-origin`
- **Payload Base**:
  ```json
  {
    "branch_id": "string | number",
    "service_id": "string | number",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD"
  }
  ```

---

## 3. Motor de Validación de las 3 Reglas

El motor de reglas actúa como el primer filtro de integridad antes de emitir cualquier evento:

```mermaid
flowchart TD
    Raw[JSON Response de Qanty] --> R1{¿items.length > 2?\nRegla 1}
    R1 -- No --> Reject1[Rechazar: Respuesta vacía o insuficiente]
    R1 -- Sí --> Loop[Iterar cada slot]
    Loop --> R2{¿status == 'free'?\nRegla 2}
    R2 -- No --> SkipSlot[Descartar slot ocupado]
    R2 -- Sí --> R3{¿date != currentDate?\nRegla 3}
    R3 -- No --> SkipToday[Descartar: Cita es de hoy]
    R3 -- Sí --> Match[Agregar a slots válidos]
    Match --> Dedupe{¿Slot ya notificado?\n(State Store)}
    Dedupe -- Sí --> Ignored[Ignorar: Evitar spam]
    Dedupe -- No --> Alert[Emitir evento hacia Telegram]
```

### 3.1. Definición Formal de las Reglas
1. **Regla 1 (Multiplicidad de Datos)**: La API debe retornar más de 2 objetos JSON (`rawItems.length > 2`). Si retorna 0, 1 o 2 objetos, se interpreta como respuesta vacía, plantilla estática o error no estructurado.
2. **Regla 2 (Estado Libre)**: El campo `status` o `state` debe ser explícitamente `'free'`, `'disponible'` o `'available'`.
3. **Regla 3 (Fecha Futura / Diferente a Hoy)**: El campo `date` o `day` no debe coincidir con la fecha actual del sistema (`slot.date !== currentDate`). Esto evita intentar agendar citas del mismo día que suelen tener restricciones de horario límite o ya están cerradas.

---

## 4. Guardrails Aplicados en esta Capa

- **`G-NET-01`**: Frecuencia mínima de sondeo de 30 segundos.
- **`G-NET-02`**: Jitter pseudo-aleatorio de $\pm 5$ a $15$ segundos en cada ciclo.
- **`G-NET-03`**: Circuit Breaker que pausa el sondeo por 10 minutos si la API responde con códigos `429` o `403`.
- **`G-BIZ-02`**: Deduplicación con State Store para garantizar $0$ mensajes duplicados en Telegram.
