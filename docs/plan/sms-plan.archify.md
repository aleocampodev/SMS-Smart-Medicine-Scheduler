# ¿Qué se va a construir en SMS y en qué orden? {#plan-sms}

SMS ya monitorea Qanty y alerta por Telegram. El siguiente ciclo cierra cuatro huecos P0 y después construye el dashboard, en cinco PRs encadenados.

- El booker actual solo rellena el formulario: no elige el turno, no envía y no confirma la cita.
- Cualquier chat de Telegram puede suscribirse y lanzar una reserva con los perfiles del dueño.
- El scheduler no guarda alertas ni citas en Postgres; el historial se pierde al reiniciar.
- El repositorio solo tiene Docker para el dashboard; faltan Postgres, API y scheduler para correr 24/7.

@answer scope="SMS · estado actual y plan de 5 PRs · noviembre 2026"
@meta locale=es

## ¿Cómo está armado el sistema hoy? {#arquitectura}

@architecture id=sms-architecture title="Componentes de SMS"
| web | Dashboard Next.js | frontend |
| api | API tRPC + Auth | backend |
| db | Postgres | database |
| scheduler | Scheduler + Poller | backend |
| qanty | Portal Qanty | external |
| bot | Bot Telegram | frontend |
| booker | PlaywrightBooker | backend |
| harvest | SessionHarvester | backend |
| web > api | tRPC |
| api > db | Drizzle |
| scheduler > db | perfiles y citas |
| scheduler > qanty | disponibilidad |
| scheduler > bot | alertas |
| bot > booker | book |
| booker > qanty | formulario |
| scheduler > harvest | sesión |
| harvest > qanty | cookies |

El scheduler es el proceso que corre siempre. El dashboard es una app Next.js aparte, y la API tRPC es la única puerta a Postgres para el usuario.

## ¿Qué pasa hoy cuando hay un turno? {#flujo}

@sequence id=booking-flow title="De la alerta a la reserva"
| actor user | Usuario | frontend |
| actor bot | Bot Telegram | frontend |
| actor sched | Scheduler | backend |
| actor qanty | Portal Qanty | external |
| actor booker | Playwright | backend |
| actor db | Postgres | database |
| phase | Hoy: alerta y prefill |
| sched | qanty | consulta horarios |
| qanty | sched | slots disponibles | return |
| sched | bot | alerta con botones |
| bot | user | mensaje + botones |
| user | bot | toca book |
| bot | booker | bookAppointment() |
| booker | qanty | abre formulario |
| booker | bot | success: true sin confirmar |
| phase | Plan PR #25: reserva real |
| booker | qanty | selecciona turno + submit | dashed |
| qanty | booker | confirmación | return |
| booker | db | cita booked | dashed |
| bot | user | confirmación real | emphasis |

Hoy el mensaje de éxito llega antes de que exista una cita. El PR de booking real mueve la confirmación al final del flujo y la guarda en Postgres.

## ¿Qué falta y por qué importa? {#vacios}

| Prioridad | Vacío | Evidencia | Efecto |
| --- | --- | --- | --- |
| P0 · reserva | La reserva no se completa | `playwrightBooker.ts` rellena y retorna `success: true` sin submit | El usuario cree que tiene cita y no la tiene |
| P0 · bot | Bot sin allowlist | `telegramBot.ts` agrega cualquier chat con `/start` | Cualquiera ve perfiles y puede reservar |
| P0 · datos | Sin persistencia | El scheduler no escribe en `appointment` | Historial y deduplicación se pierden al reiniciar |
| P0 · deploy | Despliegue incompleto | `docker-compose.yml` solo tiene `web` | No se puede correr 24/7 con Postgres y scheduler |
| P1 · zona | Zona horaria del host | `todayLocalString` usa la hora local | En UTC se pierden alertas válidas unas 5 h |
| P1 · estado | Estado en memoria | Dedup, circuit breaker y sesiones viven en RAM | Reinicio re-notifica y resetea el cooldown |
| P1 · logs | Sin observabilidad | Solo `console.log` | Un fallo silencioso no se detecta |
| P2 · UI | Dashboard scaffold | 21 líneas, solo `privateData` | No hay CRUD ni historial en la UI |

@callout level=warning title="Antes de producción"
El sistema actual no completa reservas reales. No lo uses como producción hasta cerrar el PR de booking real.

## ¿En qué orden se va a hacer? {#plan}

@workflow id=delivery-plan title="Plan de 5 PRs"
| lane now | Ahora: cerrar P0 |
| lane next | Después: producto y calidad |
| merge | Mergear PR #23 | backend | now |
| secure | Bot seguro | security | now |
| booking | Booking real | backend | now |
| deploy | Deploy real | cloud | now |
| dashboard | Dashboard | frontend | next |
| harden | Hardening | backend | next |
| merge > booking | perfiles en DB |
| secure > booking | |
| booking > deploy | |
| deploy > dashboard | |
| dashboard > harden | |

El orden protege el flujo: primero se cierra la seguridad y la reserva real, luego se despliega, y solo entonces se construye la UI sobre datos confiables.

## ¿Qué se verifica al cerrar cada PR? {#checklist}

- [ ] PR #23 mergeado y CI verde en `main`
- [ ] `bun run test`, `check-types` y `build` pasan
- [ ] Un chat no autorizado no recibe alertas ni puede reservar
- [ ] Una reserva de prueba termina con confirmación y fila `booked` en Postgres
- [ ] `docker compose up` levanta web, API, scheduler y Postgres
- [ ] El dashboard lista perfiles y citas del usuario
- [ ] Reiniciar el scheduler no reenvía alertas ya vistas
