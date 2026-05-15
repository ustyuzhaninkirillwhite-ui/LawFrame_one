# Evidence Manifest Spec

Date: 2026-05-13

The evidence manifest is generated at:

```text
artifacts/system-tests/evidence-manifest.json
```

Required top-level fields:

| Field | Meaning |
| --- | --- |
| `generatedAt` | ISO timestamp |
| `repo`, `branch`, `commit` | Git context |
| `runtimeBaseUrl` | Runtime under test |
| `commands[]` | Command ledger when run through `system-test-gate.mjs` |
| `artifacts[]` | path/type/sha256/safeForSharing records |
| `securityScans` | DOM/storage/network/bundle/secret-scan status |
| `performanceSummary` | passed/failed/degraded metric counts |
| `visualChangePolicy` | visual code/baseline update status |
| `defects[]` | defect IDs and evidence references |

Artifacts marked `safeForSharing=false` fail `check-system-test-artifacts.mjs`.
