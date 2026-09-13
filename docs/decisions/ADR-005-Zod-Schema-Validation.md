# ADR-005: Use Zod for Runtime Schema Validation & PII Transformations

## Status
Accepted

## Date
2026-09-13

## Context
The scheduler relies on external configuration inputs that are prone to user formatting errors or missing fields:
- Environment variables (`.env`) such as URLs, timeout integers, and comma-separated branch lists (`TARGET_BRANCH_IDS="6035,118"`).
- User profile documents (`profiles.json`) containing sensitive Personally Identifiable Information (PII) like national identity documents, names, emails, and phone numbers.

The system requires a validation layer that:
- Fails fast at startup if required configuration is missing or malformed, avoiding silent crashes mid-operation.
- Infers TypeScript types automatically from schemas without duplicating type definitions.
- Supports transformations (e.g., parsing comma-delimited strings into arrays).
- Facilitates PII masking (`G-SEC-02`) before displaying data to users or logs.

## Decision
Adopt **Zod (`zod`)** for all configuration validation, profile parsing, and schema transformations.

## Alternatives Considered

### Joi
- **Pros**: Mature, battle-tested schema validator.
- **Cons**: Designed for JavaScript; requires manual TypeScript type declarations or external plugins (`joi-to-typescript`) to derive types, leading to synchronization drift.
- **Rejected**: Lacks native TypeScript inference.

### Yup
- **Pros**: Popular in the React/frontend ecosystem.
- **Cons**: TypeScript type inference is less precise than Zod, with looser type inference on optional/nullable fields.
- **Rejected**: Zod provides cleaner type inference and native `.transform()` pipelines.

### Manual If-Else Validation
- **Pros**: Zero external dependencies.
- **Cons**: Brittle, repetitive, error-prone, and provides no static TypeScript type guarantees.
- **Rejected**: Insufficient for ensuring system reliability.

## Consequences
- **Positive**: Single source of truth for both runtime validation and static TypeScript types (`z.infer<typeof EnvSchema>`).
- **Positive**: Automated transformations seamlessly convert `"6035,118"` into `['6035', '118']` at application bootstrap.
- **Positive**: Hardens profiles against malformed documents, protecting national ID and phone data.
