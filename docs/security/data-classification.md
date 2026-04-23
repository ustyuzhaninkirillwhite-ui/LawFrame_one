# Data Classification

| Class | Meaning | Examples | Allowed in browser |
| --- | --- | --- | --- |
| `public` | Safe for public/template discovery | public library metadata | Yes |
| `internal` | Workspace operational metadata | run states, readiness | Yes with auth |
| `confidential` | Sensitive legal work product | analytics summaries, internal drafts | Only scoped and reviewed |
| `legal_secret` | Highly restricted legal data | privileged legal notes | No direct frontend fetch |
| `personal_data` | Person-identifying information | names, e-mails, phone numbers | Scoped only |
| `client_material` | Client source documents | uploaded evidence, claims | Signed URL / backend policy |

