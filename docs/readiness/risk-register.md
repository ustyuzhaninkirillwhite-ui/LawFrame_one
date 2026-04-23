# Risk Register

| Risk | If violated | Mitigation in Stage 0 |
| --- | --- | --- |
| Activepieces treated as product DB | Lost versioning and ownership | ADR-0003, flow mapping tables |
| AI provider called directly from browser | Secret leakage and policy bypass | ADR-0004, frontend disabled state |
| No approval gate on external delivery | Unsafe client communication | ADR-0006, workflow approval contract |
| Recommendation mutates automations automatically | Self-amplifying errors | ADR-0005, advisory-only UI |
| RLS assumptions remain implicit | Cross-workspace leakage risk | draft RLS matrix and pgTAP plan |

