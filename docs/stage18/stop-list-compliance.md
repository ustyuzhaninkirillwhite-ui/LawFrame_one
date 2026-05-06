# Stage 18 Stop-list Compliance

| Stop-list item | Status | Evidence |
|---|---|---|
| Frontend direct provider calls | pass | `browser-secret-scan.json`, `direct-provider-call-scan.json` |
| Feature module direct provider calls | pass | gateway-only scanner allowlists adapter only |
| Provider key in Activepieces | pass | piece contract test and forbidden parser keys |
| Default legacy DeepSeek IDs | pass | route registry test expects `deepseek-v4-flash` |
| `automation_planner_high` default/use by chat | pass | disabled route test |
| Reference repos unchecked | pass | `reference-projects-analysis.json` |
| Borrowed code without provenance | pass | clean-room borrowed register |
| Release-gate evidence missing | pass after `stage18:release-gate` | `release-gate.json` |
