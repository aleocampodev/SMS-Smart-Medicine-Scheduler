# 💊 SMS - Smart Medicine Scheduler

Sistema inteligente para la monitorización continua de disponibilidad de citas en **Qanty**, alertas enriquecidas e interactivas vía **Telegram Bot**, y automatización de reserva con **Playwright** multi-perfil.

---

## 🚀 Características

- 🔍 **Polling Inteligente a Qanty**: Consulta periódica a `https://qanty.com/p/appointments/list_day_schedule` con headers de navegador reales y anti-bloqueo.
- 📐 **Motor de 3 Reglas de Negocio**:
  1. **Regla 1**: Valida que la respuesta traiga más de dos items (`slots > 2`).
  2. **Regla 2**: Filtra únicamente los turnos con estado `free` / disponible.
  3. **Regla 3**: Excluye citas del día actual (`date != today`), priorizando fechas futuras.
- 🛡️ **Deduplicación de Alertas**: Evita enviar mensajes repetidos por la misma cita cada ciclo de sondeo.
- 📱 **Telegram Bot Interactivo**:
  - Notifica con fecha, hora, sede y especialidad.
  - **Inline Keyboard con 1-click por persona**: botones dedicados para cada perfil configurado (`[👤 Reservar Juan]`, `[👤 Reservar María]`).
- 🤖 **Automatización con Playwright**:
  - Inyección de datos personales (cédula, nombres, teléfono, correo, etc.).
  - Captura y envío del pantallazo (screenshot) del comprobante de agendamiento directamente a Telegram.

---

## 📁 Estructura del Proyecto

```text
sms-smart-medicine-scheduler/
├── src/
│   ├── automation/
│   │   └── playwrightBooker.ts  # Automatización de formularios y capturas
│   ├── bot/
│   │   └── telegramBot.ts       # Bot de Telegram y manejo de botones inline
│   ├── config/
│   │   ├── env.ts               # Validación de variables de entorno (Zod)
│   │   └── profiles.ts          # Carga y validación de perfiles
│   ├── poller/
│   │   ├── qantyClient.ts       # Cliente HTTP hacia Qanty
│   │   └── rulesEngine.ts       # Motor de las 3 reglas + deduplicación
│   ├── tests/
│   │   └── testRules.ts         # Pruebas unitarias de las reglas de negocio
│   ├── types/
│   │   └── index.ts             # Tipos e interfaces TypeScript
│   └── index.ts                 # Orquestador principal
├── profiles.example.json        # Plantilla de perfiles de usuarios
├── .env.example                 # Plantilla de configuración
├── package.json
└── tsconfig.json
```

---

## 🛠️ Configuración y Puesta en Marcha

### 1. Requisitos
- Node.js 18+ (o Node 20+)
- pnpm o npm

### 2. Configurar Variables de Entorno
Copia la plantilla y edita tus credenciales:
```bash
cp .env.example .env
```
Campos en `.env`:
- `TELEGRAM_BOT_TOKEN`: Token otorgado por [@BotFather](https://t.me/botfather).
- `TELEGRAM_CHAT_ID`: ID del chat o grupo de Telegram donde recibir las alertas.
- `POLL_INTERVAL_SECONDS`: Intervalo en segundos entre consultas (por defecto `45`).
- `PLAYWRIGHT_HEADLESS`: `true` para ejecución en segundo plano o `false` para ver el navegador abriéndose.

### 3. Configurar Perfiles de Personas
Copia la plantilla de perfiles:
```bash
cp profiles.example.json profiles.json
```
Edita `profiles.json` con los datos reales de cada persona que requiere citas:
```json
[
  {
    "id": "persona_1",
    "displayName": "Alex",
    "documentType": "CC",
    "documentNumber": "1234567890",
    "firstName": "Alex",
    "lastName": "Gómez",
    "birthDate": "1995-04-20",
    "phone": "3001234567",
    "email": "alex@example.com"
  }
]
```

---

## 🧪 Pruebas Unitarias

Ejecuta el conjunto de pruebas que valida las 3 reglas y el sistema de deduplicación:
```bash
npm run test:rules
```

---

## ▶️ Ejecución

Para iniciar el orquestador en modo desarrollo:
```bash
npm run dev
```

Para compilar e iniciar en producción:
```bash
npm run build
npm start
```
