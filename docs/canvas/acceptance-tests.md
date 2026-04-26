# Acceptance tests 16.2

## Registry

- Все MVP-блоки присутствуют в `/canvas/block-types`.
- Все 15 категорий представлены в registry, включая disabled/non-MVP блоки.
- Каждый block definition имеет schemas, handles, policies, runtime mapping и inspector tabs.
- Пользователь без permission не видит или не может добавить high-risk blocks.

## Connections

- `trigger -> trigger` denied.
- `end -> any` denied.
- `email_delivery` без approval даёт policy block.
- `approval.approved -> email_delivery` allowed.
- Branch без fallback даёт validation warning/error согласно rule.
- Loop без `max_items` invalid.

## Bindings и data picker

- Required input без binding блокирует publish.
- Downstream binding запрещён.
- Branch output без Merge не становится общим контекстом без validation issue.
- Normal mode не показывает raw JSONPath.

## Security

- AI block показывает data policy и не раскрывает provider key.
- Direct AI provider, service role, Activepieces admin API и unknown custom piece недоступны из frontend.
- Storage block не сохраняет signed URL как output.
- Full document text не попадает в telemetry.

## Runtime

- Note/Group не попадает в runtime mapping.
- End block не допускает outgoing connection.
- MVP-сценарий `manual_start -> select_documents -> select_profile -> case_law_search -> case_material_analysis -> pretrial_claim_draft -> human_approval -> save_to_documents -> email_delivery -> end_success` проходит validation после approval и End.
