# Canvas v2 performance budget

Performance smoke is a release gate because real legal workflows may contain dozens or hundreds of nodes and many validation issues.

## Budgets

| Signal | Budget |
| --- | --- |
| Canvas initial load, 25 nodes | p95 < 1500ms |
| Canvas initial load, 100 nodes | p95 < 3000ms |
| Node drag interaction | no visible freeze |
| Operation apply local state | p95 < 200ms |
| Validation after small operation | p95 < 500ms |
| Autosave backend response | p95 < 1000ms |
| Compile preview, 50 nodes | p95 < 3000ms |
| Validation rail update | p95 < 500ms |

## Required fixtures

- `workflow-10-linear`
- `workflow-25`
- `workflow-50`
- `workflow-100`
- `workflow-100-invalid-many-errors`

## Release rule

Confirmed freeze, memory leak, or hard budget breach blocks release unless the release manager explicitly moves the build to degraded release review with rollback plan and disabled rollout flags.
