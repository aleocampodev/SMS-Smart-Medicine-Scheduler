# ADR-004: Use grammY for Telegram Bot & Human-in-the-Loop Orchestration

## Status
Accepted

## Date
2026-09-13

## Context
When available appointments pass the 3 business rules, the system must immediately alert the user and present an intuitive 1-click booking interface on mobile devices. Key technical requirements include:
- First-class TypeScript support with typed Telegram API methods and payload types.
- High-performance, non-blocking asynchronous event handling for inline button callbacks (`callback_query:data`).
- Low runtime overhead and minimal latency during alert delivery.
- Clean separation between alert dispatch and interactive response handlers.

## Decision
Adopt **grammY (`grammy`)** as the Telegram Bot framework.

## Alternatives Considered

### Telegraf
- **Pros**: Established and widely used Telegram framework in the Node.js ecosystem.
- **Cons**: Slower TypeScript type definitions updates, historically inconsistent maintenance, heavier core bundle, and more complex middleware error handling.
- **Rejected**: grammY was created specifically by former Telegraf contributors to modernize the architecture with native TypeScript ergonomics.

### node-telegram-bot-api
- **Pros**: Longstanding library with simple callbacks.
- **Cons**: Legacy architecture, outdated callback-heavy patterns, unmaintained TypeScript definitions, and lacks built-in menu/inline-keyboard builders.
- **Rejected**: Incompatible with modern typed async/await standards.

## Consequences
- **Positive**: Complete autocomplete and strict compile-time validation for Telegram Bot API methods, message formats (`Markdown`), and inline buttons (`InlineKeyboard`).
- **Positive**: Lightweight, modern middleware architecture with robust error boundaries (`bot.catch`).
- **Positive**: Seamless integration of human-in-the-loop decisions (selecting between profiles directly from Telegram inline buttons).
