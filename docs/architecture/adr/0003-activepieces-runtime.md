# ADR-0003: Activepieces Is Runtime And Embedded Builder

- Status: accepted
- Date: 2026-04-21

## Decision

Activepieces используется как self-hosted runtime и embedded builder для LexFrame, но не как система учёта продуктовой логики.

LexFrame backend остаётся единственным canonical owner для:

- automation templates и installed automations;
- workflow runs и step timeline;
- approvals, policy gates и audit trail;
- artifacts, documents и signed URL access.

Activepieces получает только executable projection, short-lived builder session и callback loop, ограниченный backend-issued токенами и allowlist pieces.

## Consequences

- Установка automation в LexFrame предшествует любому runtime binding.
- Builder access выдаётся только backend через short-lived embed token.
- Runtime sync, connection state и callback receipts аудитируются в LexFrame.
- Direct runtime drift из Activepieces не коммитится автоматически в canonical automation record.
- Activepieces разворачивается отдельными APP/WORKER контейнерами и не получает доступ к product DB или service-role secret-ам.
