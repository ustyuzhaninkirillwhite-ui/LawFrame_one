# IO-контракты Canvas-блоков

IO-контракт блока состоит из JSON Schema для входов, выходов и настроек, typed input/output fields, handles и bindings. Runtime получает формальные ключи данных, а пользователь видит юридические названия.

## Binding model

`StepInputBinding` связывает вход блока с одним из источников:

- `workflow_input`: параметр запуска workflow.
- `step_output`: output предыдущего блока.
- `document`: документ или версия документа в текущем workspace.
- `profile_snapshot`: зафиксированный профиль работы.
- `literal`: значение из inspector.

Разрешённые transforms: `none`, `map`, `filter`, `format`, `join`. В normal mode пользователь не вводит raw JSONPath; UI показывает chip вида `Факты дела ← Анализ материалов / Факты`.

## MVP IO summary

| Block | Inputs | Outputs | Handles |
| --- | --- | --- | --- |
| `manual_start` | нет | `run_context`, `input_documents`, `profile_snapshot` | `main_output` |
| `select_documents` | нет | `selected_documents` | `main_input`, `main_output` |
| `select_profile` | нет | `profile_snapshot` | `main_input`, `main_output` |
| `case_law_search` | `query`, `profile_snapshot` | `selected_sources`, `search_report` | `main_input`, `main_output`, `error_output` |
| `case_material_analysis` | `documents`, `profile_snapshot`, `case_law` | `facts`, `risks`, `recommended_actions` | `main_input`, `main_output`, `error_output` |
| `condition` | `value` | `matched_branch` | `main_input`, `true_branch`, `false_branch`, `otherwise` |
| `pretrial_claim_draft` | `facts`, `profile_snapshot`, `case_law`, `template` | `draft_document`, `draft_summary` | `main_input`, `main_output`, `error_output` |
| `document_template_apply` | `template`, `data` | `document_draft` | `main_input`, `main_output`, `error_output` |
| `document_structure_check` | `document_draft`, `profile_snapshot` | `check_report`, `passed` | `main_input`, `main_output`, `error_output` |
| `human_approval` | `artifact`, `approval_context` | `decision`, `comment`, `approved_artifact` | `main_input`, `approved`, `rejected`, `changes_requested`, `expired` |
| `save_to_documents` | `artifact`, `metadata` | `document_record`, `artifact_id` | `main_input`, `saved`, `error_output` |
| `email_delivery` | `artifact`, `recipients`, `message` | `delivery_receipt` | `main_input`, `sent`, `error_output` |
| `error_handler` | `error`, `context` | `error_resolution` | `error_input`, `retry`, `fallback`, `stop`, `notify` |
| `end_success` | `workflow_result` | `workflow_outputs` | `main_input` |

## Validation

- Required input без binding блокирует publish.
- Binding на downstream step запрещён.
- Binding из ветки без Merge должен давать warning/error по rule.
- Type compatibility проверяется по `CanvasDataFieldDefinition.type`.
- Cross-workspace document reference запрещён policy validation.
