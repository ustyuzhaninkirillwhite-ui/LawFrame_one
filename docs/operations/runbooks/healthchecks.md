# Runtime Healthchecks

## Backend

- `GET /health/live` confirms process liveness.
- `GET /health/ready` confirms storage, AI, Activepieces, search and realtime dependencies.
- `GET /health/dependencies` returns dependency-by-dependency status for degraded-mode UX.
- `GET /metrics` exposes Prometheus-style gauges for runtime and readiness state.

## Mining Worker

- `GET /health/live` confirms the worker process is alive.
- `GET /health/ready` confirms the last mining cycle completed within the expected interval.
- `GET /metrics` exposes cycle counters and readiness status.

## Smoke Procedure

- Run `node scripts/smoke-system-status.mjs` against the target environment before approving production deployment.
- Attach the smoke report path to the release manifest artifact.
- If any dependency reports `blocked`, stop rollout and use the rollback runbook.
