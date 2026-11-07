# What will SMS build next, and in what order? {#sms-plan}

SMS already watches Qanty and alerts Telegram. The next cycle closes four P0 gaps, then builds the dashboard, in five PRs after the open profiles PR (#23).

- The booker only fills the form. It does not choose a slot, submit, or confirm the appointment.
- Any Telegram chat can subscribe and start a booking with the owner's profiles.
- The scheduler does not save alerts or appointments in Postgres, so history is lost on restart.
- Docker only runs the dashboard. Postgres, the API, and the scheduler are missing for 24/7 operation.

@answer scope="SMS · current state and five-PR plan · November 2026"
@meta locale=en

## What is SMS, in plain terms? {#what-is-sms}

SMS is a personal assistant for medicine-dispensing appointments. It watches the Qanty portal, applies three business rules, and sends a Telegram alert with one button per profile. A human taps a button, and a headless browser fills the booking form.

| Term | Meaning |
| --- | --- |
| Qanty | The portal where appointments are checked and booked. |
| Slot | A date and time that may be available. |
| Profile | A person the system can book for. |
| Scheduler | The always-running process that polls Qanty and sends alerts. |
| Booker | The Playwright component that fills the booking form. |
| Allowlist | The list of Telegram chats allowed to use the bot. |
| tRPC | The typed function call between the dashboard and the API. Explained in the next panel. |
| Postgres | The database for profiles and appointments. |
| P0 | A blocker that must be fixed before production. |

@callout level=warning title="Current limit"
The booker only fills the form. It does not select a slot, submit, or confirm. The system is not ready for production.

## What is tRPC, in one minute? {#trpc span=12}

tRPC is a typed function call between the dashboard and the API. The dashboard imports the router's TypeScript type, so a wrong input or output fails at compile time, not in production.

Think of the router as a restaurant menu: the kitchen defines the dishes, the menu lists them, and the waiter can only order what is on the menu.

@sequence id=trpc-call title="One tRPC call"
| actor web | Dashboard | frontend |
| actor api | API server | backend |
| actor router | profilesRouter | backend |
| actor db | Postgres | database |
| web | api | profiles.list.query() |
| api | router | check session + input |
| router | db | SELECT profiles |
| db | router | rows | return |
| router | api | Profile[] | return |
| api | web | typed JSON | return |

| Term | Meaning |
| --- | --- |
| Router | A group of procedures. `appRouter` combines `profiles`, `appointments`, and `privateData`. |
| Procedure | One callable function, such as `profiles.list` or `profiles.create`. |
| Query | A read procedure, such as `list`. |
| Mutation | A write procedure, such as `create`, `update`, or `delete`. |
| Context | Per-request data: `session` and `db`. |
| Middleware | Code that runs before a procedure. `protectedProcedure` rejects requests without a session. |

The API server mounts the router at `/trpc` in `apps/server/src/index.ts`. The dashboard calls it with `useTRPC()` in `apps/web/src/app/dashboard/dashboard.tsx`.

## How is the system built today? {#architecture}

- The scheduler is the always-running process.
- The dashboard is a separate Next.js app.
- The tRPC API is the only path from the dashboard to Postgres.
- The scheduler includes the poller, the rules engine, the session harvester, and the Playwright booker.

@architecture id=sms-architecture title="SMS components"
| web | Dashboard | frontend |
| api | API (tRPC) | backend |
| db | Postgres | database |
| scheduler | Scheduler | backend |
| qanty | Qanty portal | external |
| bot | Telegram bot | frontend |
| web > api | tRPC |
| api > db | Drizzle |
| scheduler > db | data |
| scheduler > qanty | poll and book |
| scheduler > bot | alerts |
| bot > scheduler | callback |

@callout level=note title="Design note"
The original Excalidraw sketch proposed a webhook and a Scheduler MCP. The current code uses Telegram long polling and direct Playwright. This plan does not add MCP. It closes the P0 gaps in the current design.

## What happens today when a slot appears? {#flow}

Today the success message arrives before an appointment exists. The real-booking PR adds submit, saves the appointment in Postgres, and moves confirmation to the end.

@workflow id=booking-flow title="From alert to booking"
| lane today | Today: alert and prefill |
| lane next | Next PR: real booking |
| poll | Check Qanty | backend | today |
| alert | Alert Telegram | frontend | today |
| tap | User taps Book | frontend | today |
| fill | Fill form | backend | today |
| submit | Select and submit | backend | next |
| save | Save appointment | database | next |
| confirm | Confirm to user | frontend | next |
| poll > alert | slot |
| alert > tap | button |
| tap > fill | callback |
| fill > submit | next PR |
| submit > save | confirmation |
| save > confirm | booked |

## What is missing, and why does it matter? {#gaps}

These gaps block production. P0 means fix before production, P1 means fix soon, and P2 means product work.

| Priority | Gap | Evidence | Effect |
| --- | --- | --- | --- |
| P0 · booking | Booking is not completed | `playwrightBooker.ts` fills the form and returns `success: true` without submitting | The user thinks they have an appointment when they do not |
| P0 · bot | Bot has no allowlist | `telegramBot.ts` adds any chat that sends `/start` | Anyone can see profiles and start a booking |
| P0 · data | No persistence | The scheduler does not write to the `appointment` table | History and deduplication are lost on restart |
| P0 · deploy | Incomplete deployment | `docker-compose.yml` only defines `web` | Cannot run 24/7 with Postgres and the scheduler |
| P1 · timezone | Host timezone | `todayLocalString` uses local time | In UTC, valid alerts are missed for about 5 hours |
| P1 · state | In-memory state | Dedup, circuit breaker, and sessions live in RAM | Restart re-notifies and resets the cooldown |
| P1 · logs | No observability | Only `console.log` | A silent failure goes unnoticed |
| P2 · UI | Dashboard scaffold | 21 lines, only `privateData` | No CRUD or history in the UI |

@callout level=warning title="Before production"
The current system does not complete real bookings. Do not use it in production until the real-booking PR is closed.

## In what order will we build it? {#plan}

The order protects the flow: close security and real booking first, then deploy, and only then build the UI on trusted data. The first step is the open profiles PR (#23). If it is already merged, start at Secure the bot.

@workflow id=delivery-plan title="Delivery plan: #23, then five PRs"
| lane now | Now: close P0 |
| lane next | Next: product and quality |
| merge | Profiles in DB | backend | now |
| secure | Secure the bot | security | now |
| booking | Real booking | backend | now |
| deploy | Real deployment | cloud | now |
| dashboard | Dashboard | frontend | next |
| harden | Hardening | backend | next |
| merge > booking | profiles in DB |
| secure > booking | |
| booking > deploy | |
| deploy > dashboard | |
| dashboard > harden | |

## What do we verify when each PR closes? {#checklist}

- [ ] PR #23 is merged and CI is green on `main`
- [ ] `bun run test`, `check-types`, and `build` pass
- [ ] An unauthorized chat receives no alerts and cannot book
- [ ] A test booking ends with a confirmation and a `booked` row in Postgres
- [ ] `docker compose up` starts web, API, scheduler, and Postgres
- [ ] The dashboard lists the user's profiles and appointments
- [ ] Restarting the scheduler does not resend alerts already seen
