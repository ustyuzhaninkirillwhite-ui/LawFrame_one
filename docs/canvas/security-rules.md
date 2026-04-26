# Security и policy rules Canvas

Canvas 16.2 запрещает выводить опасные runtime детали в normal mode и закрепляет policy validation на backend.

## Запреты

- Direct AI provider call из frontend.
- Supabase service role или любые privileged keys во frontend bundle.
- Activepieces admin API из frontend.
- External delivery без approval.
- Cross-workspace document reference.
- Unknown custom piece в normal mode.
- Signed URL как output блока.
- Full document text telemetry в analytics/logs.
- Raw JSONPath editing в normal mode.

## Policy fields

Каждый `CanvasBlockDefinition` содержит:

- `riskLevel`: `low`, `medium`, `high`, `critical`.
- `dataClassification`: `public`, `workspace_internal`, `confidential`, `personal_data`, `legal_secret`, `client_material`.
- `requiresApproval`.
- `isExternalAction`.
- `canUseAi`.
- `canUseDocuments`.
- `allowedRoles`.
- `requiredPermissions`.

## Runtime isolation

AI Action проходит только через AI gateway. Delivery проходит только через LexFrame delivery service. Storage создаёт managed artifact/document record и не возвращает signed URL. Activepieces остаётся runtime/builder контуром, но Canvas registry остаётся источником истины.
