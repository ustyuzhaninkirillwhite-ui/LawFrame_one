# Run Evidence Matrix

| Evidence | Source | Safety Contract | Test |
| --- | --- | --- | --- |
| Workflow run row | `app.workflow_runs` via run API/snapshot | IDs/status/mode/trace only in browser DTO | `automation-runtime-dry-run-full.spec.ts` |
| Runtime binding | `app.activepieces_run_bindings` | external flow/run IDs and callback token hash, no callback token value | `activepieces.service.spec.ts` |
| Runtime-scoped token | `app.activepieces_runtime_tokens` | JTI hash/token hash/expires/scope only | `activepieces.service.spec.ts` |
| Run timeline/events | `run_step_events`, live events | status/errors safe, no raw runtime key | dry-run E2E and live event service assertions |
| Audit event | audit service | IDs/status/mode/hash metadata only | `activepieces-audit-writer.spec.ts`, `activepieces.service.spec.ts` |
| Controlled failure | backend error taxonomy | `READINESS_GATE_BLOCKED`, `RUNTIME_MAPPING_MISSING`, no stack trace | `run-preflight.service.spec.ts`, E2E dry-run |
| Delivery gate | delivery request/task | external delivery blocked until approval | `delivery.service.spec.ts` |
