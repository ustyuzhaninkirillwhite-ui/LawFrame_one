# No-code поведение Canvas

Canvas 16.2 говорит на языке юридического сценария. Пользователь добавляет блоки вроде "Найти судебную практику", "Сформировать претензию", "Согласовать", "Отправить email", а не Activepieces steps, webhooks или raw API calls.

## Палитра

Палитра группирует блоки по предметным разделам: старт, документы и данные, правовой поиск, анализ, подготовка документов, проверка, шаблоны, условия, циклы, согласование, доставка, сохранение, под-сценарии, ошибки, заметки, завершение.

Карточка блока показывает:

- что нужно блоку;
- какой результат он создаёт;
- risk label;
- требуется ли approval;
- использует ли AI;
- какие connections доступны;
- доступен ли блок в текущем workspace/role/feature flag.

## Inspector

Общие tabs: Overview, Inputs, Settings, Data, Connections, Test, Outputs, Errors, Policies.

Специализированные tabs добавляются по kind:

- Legal Action: Legal module, authorities, legal risk.
- AI Action: Data policy, prompt boundary, AI gateway.
- Condition/Router: Branches, fallback.
- Human Approval: Approvers, decision handles, expiry.
- Delivery: Recipients, preview, approval path.

## Подсказки

- Draft claim предлагает анализ материалов, судебную практику и шаблон.
- Email delivery предлагает approval и preview.
- Workflow без End предлагает добавить End.
- Branch без fallback предлагает ветку "Иначе".
- External delivery без approval показывается как policy block, а не как техническая ошибка.
