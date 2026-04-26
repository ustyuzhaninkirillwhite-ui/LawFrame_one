# Runtime mapping Canvas

Runtime mapping описывает, как доменный Canvas-блок будет исполняться или проецироваться в runtime. Это не compiler 16.2; mapping фиксирует безопасный контракт для следующих этапов.

| Kind | Provider | Mapping |
| --- | --- | --- |
| `trigger` | `activepieces` или `internal_worker` | LexFrame backend/Activepieces trigger |
| `legal_action` | `internal_worker` или `activepieces` | LexFrame legal piece/internal worker |
| `ai_action` | `ai_gateway` | AI gateway с data policy |
| `document_input` | `internal_worker` | Document/profile/template resolver |
| `condition` | `internal_worker` | Router/condition evaluator |
| `loop` | `internal_worker` | Loop controller with max item limit |
| `merge` | `internal_worker` | Branch merge controller |
| `approval` | `internal_worker` | Approval service |
| `wait` | `internal_worker` | Pause/resume service |
| `delivery` | `internal_worker` | LexFrame delivery service |
| `storage` | `internal_worker` | Artifact/document record service |
| `subworkflow` | `internal_worker` | Workspace-scoped automation runner |
| `error_handler` | `internal_worker` | Retry/fallback/notify/stop policy |
| `note`, `group` | `none` | UI only, excluded from runtime |
| `end` | `none` | Workflow output mapping |

Каждый mapping должен объявлять `supportsStepTest`, `supportsPartialExecution`, `supportsPinnedData` и notes/warnings. Preview/test contours не выполняют внешнюю доставку и не обходят approval policy.
