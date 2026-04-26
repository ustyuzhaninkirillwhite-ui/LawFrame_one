# Правила связей Canvas

Backend является источником истины для connection validation. Frontend `canConnect()` выполняет только UX-предвалидацию и обязан повторять backend-ответ, но не может ослаблять policy.

## Edge types

- `control_flow`: обычное управление порядком выполнения.
- `data_flow`: явная передача данных.
- `approval_flow`: результат согласования.
- `error_flow`: ошибка в error handler.
- `loop_flow`: тело loop/batch.
- `annotation_link`: связь заметок и групп, не попадает в runtime.

## ConnectionRule

`ConnectionRule` содержит `sourceKind`, `sourceHandle`, `targetKind`, `targetHandle`, `edgeType`, `allowed`, `reasonIfDenied` и опциональный `requiresApprovalPath`.

## Базовые запреты

- `trigger -> trigger` запрещён.
- `end -> any` запрещён.
- `delivery` без предшествующего approval запрещён policy validation.
- `note` и `group` не создают runtime edges.
- `error_output` соединяется только с `error_input` error handler или разрешённой fallback-схемой.
- `condition` должен иметь минимум две ветки; router требует fallback.
- Ветки, которые снова используются как общий контекст, должны сходиться через Merge.

## Acceptance checks

- `trigger -> trigger` возвращает denied.
- `end -> legal_action` возвращает denied.
- `legal_action -> email_delivery` без approval возвращает denied с кодом `EXTERNAL_DELIVERY_REQUIRES_APPROVAL`.
- `approval.approved -> delivery.main_input` разрешён как `approval_flow`.
