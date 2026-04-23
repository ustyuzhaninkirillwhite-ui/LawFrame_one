# Activepieces Contract

## Stage 4 Boundary

- LexFrame backend остаётся canonical owner для automations, runs, approvals, artifacts и policies.
- Activepieces хранит только executable projection, embedded builder session и downstream runtime state.
- Все токены, callback-и, sync orchestration, connection provisioning и artifact ingest идут только через backend.

## Runtime Flow

1. Пользователь устанавливает automation в LexFrame.
2. Backend компилирует runtime projection и синхронизирует её в Activepieces.
3. Builder открывается по short-lived embed token, выданному backend.
4. Запуск создаётся в `app.workflow_runs`, а callbacks обновляют шаги и общий статус.
5. Артефакты сохраняются в canonical `documents`/`run_artifacts`, а не в Activepieces.

## Expected DTO

```json
{
  "instanceUrl": "https://activepieces.lexframe.local",
  "token": "short-lived-jwt",
  "expiresAt": "2026-04-21T18:30:00.000Z",
  "role": "builder",
  "piecesFilterType": "allowlist",
  "piecesTags": ["lexframe-core", "document-core"],
  "runtimeProjectId": "ap_project_01",
  "runtimeFlowId": "flow_01",
  "mode": "embedded-builder"
}
```

## Required Infra

- staging и production Activepieces разворачиваются отдельно от продуктовой БД LexFrame;
- APP и WORKER контейнеры разделены;
- execution mode зафиксирован как `AP_EXECUTION_MODE=SANDBOX_CODE_ONLY`;
- secret rotation и callback authorization документируются и аудитируются в LexFrame.
