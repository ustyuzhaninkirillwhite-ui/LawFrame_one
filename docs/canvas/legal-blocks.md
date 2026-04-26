# Юридические блоки LexFrame

Legal Action blocks отображают юридические действия и связываются с legal module registry. Они не раскрывают пользователю technical piece, provider, webhook или queue details.

## MVP legal actions

| Block | Юридический смысл | Risk | Approval |
| --- | --- | --- | --- |
| `case_law_search` | Найти и отобрать судебную практику по вопросу | medium | нет |
| `case_material_analysis` | Проанализировать материалы дела, факты и риски | high | нет, но требует data policy |
| `pretrial_claim_draft` | Подготовить проект досудебной претензии | high | требуется перед внешней отправкой |
| `document_template_apply` | Применить шаблон к данным дела | medium | нет |
| `document_structure_check` | Проверить структуру и полноту документа | medium | нет |

## Правила

- Legal Action получает формальные inputs, обычно документы, профиль, факты, судебную практику или шаблон.
- Outputs являются юридическими артефактами: facts, risks, draft document, check report, recommended actions.
- Runtime mapping указывает LexFrame piece/internal worker, но UI не показывает Activepieces terminology.
- Высокорисковые outputs должны пройти approval перед Delivery.
