# Таксономия Canvas-блоков LexFrame

Этап 16.2 фиксирует Canvas-блок как доменную no-code сущность LexFrame. Блок не равен React-компоненту, Activepieces step или произвольному technical piece: каждый тип блока описывает юридический смысл, IO-контракт, handles, validation, policy и runtime mapping.

## Категории

| Категория | Kind | Назначение | UI-смысл | Runtime mapping |
| --- | --- | --- | --- | --- |
| Start/Trigger | `trigger` | Запускает workflow и объявляет workflow-level inputs | Старт сценария | LexFrame backend или Activepieces trigger |
| Legal Action | `legal_action` | Выполняет юридически значимое действие через legal module registry | Юридическое действие, а не technical piece | LexFrame piece или internal worker |
| AI Action | `ai_action` | Выполняет AI-операцию только через AI gateway | AI-помощник с data policy | AI gateway |
| Document/Data Input | `document_input` | Запрашивает документы, профиль, шаблон и параметры запуска | Выбор источников данных | LexFrame backend |
| Condition/Router | `condition` | Ветвит сценарий по формальному условию | Да/Нет/Иначе | Runtime router |
| Loop/Batch | `loop` | Обрабатывает массив с лимитами и loop policy | Для каждого элемента | Runtime loop controller |
| Merge | `merge` | Объединяет результаты веток | Сбор веток | Runtime merge controller |
| Human Approval | `approval` | Запрашивает согласование пользователя | Юридическое подтверждение | Approval service |
| Wait/Pause | `wait` | Приостанавливает сценарий до события или timeout | Ожидание | Runtime pause service |
| Delivery | `delivery` | Отправляет результат наружу или адресату | Доставка после approval | LexFrame delivery service |
| Storage/Artifact | `storage` | Создаёт управляемый artifact/document record | Сохранить результат | Product DB artifact service |
| Subworkflow | `subworkflow` | Вызывает разрешённую automation/version в workspace | Под-сценарий | LexFrame automation runner |
| Error Handler | `error_handler` | Обрабатывает ошибки, retry/fallback/notify/stop | Обработка ошибки | Runtime error policy |
| Note/Group | `note`, `group` | Улучшает читаемость схемы | Заметка или группа | UI only |
| End/Output | `end` | Фиксирует workflow-level outputs и завершает ветку | Завершение | Workflow output mapping |

## MVP-блоки

MVP-набор registry должен содержать: `manual_start`, `select_documents`, `select_profile`, `case_law_search`, `case_material_analysis`, `condition`, `pretrial_claim_draft`, `document_template_apply`, `document_structure_check`, `human_approval`, `save_to_documents`, `email_delivery`, `error_handler`, `end_success`.

Дополнительные категории присутствуют в registry даже если включены как non-MVP или disabled: AI Action, Loop/Batch, Merge, Wait/Pause, Subworkflow, Note/Group.

## Инварианты

- Каждый блок имеет `code`, `kind`, `category`, display text, `inputSchema`, `outputSchema`, `configSchema`, `handles`, `defaultConfig`, `policies`, `runtime` и `validationRules`.
- Frontend использует registry для palette, inspector, node handles и no-code подсказок.
- Backend использует тот же registry для `/canvas/block-types`, validation, connection policy, preview и test contours.
- Normal mode скрывает Activepieces/n8n термины, raw JSONPath, provider keys, service role и signed URL.
