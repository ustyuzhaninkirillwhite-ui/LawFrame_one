# Canvas No-code Copywriting Guide

## Назначение

Этот документ фиксирует язык no-code слоя Canvas v2 для юристов. Basic mode должен объяснять сценарий через юридические действия, данные, риски, согласования и проверку результата. Он не должен требовать знания DSL, JSONPath, runtime mapping, Activepieces terminology, provider settings или секретов.

## Режимы

Basic mode:
- показывает: название шага, что шагу нужно, что он создаёт, статус настройки, риск, согласование, проверку, понятное исправление;
- скрывает: внутренние коды модулей, raw expression, provider, prompt, temperature, service role, runtime payload, technical binding path;
- формулирует ошибки в формате: что не так, почему важно, как исправить, что будет без исправления.

Advanced mode:
- может показывать диагностические причины, несовместимость типов, источник данных и превью;
- не показывает секреты и значения ключей;
- используется пользователями с правами `canvas.view_validation` или выше.

Developer mode:
- доступен только при `canvas.debug` или `canvas.view_raw_dsl`;
- может раскрывать служебные идентификаторы, runtime/provider metadata и debug JSON;
- не используется как fallback для Basic UI.

## Термины

Использовать в Basic:
- шаг;
- что нужно шагу;
- что создаёт шаг;
- источник данных;
- проверка шага;
- проверочный запуск;
- пример результата для настройки;
- согласование;
- внешнее действие;
- риск;
- готовая процедура;
- повторить для каждого.

Не использовать в Basic:
- JSONPath;
- raw expression;
- piece;
- runtime payload;
- module_code;
- service_role;
- provider key;
- temperature;
- prompt;
- binding path.

## Validation Messages

Каждое сообщение должно содержать:
- `title`: коротко, что нужно исправить;
- `plain_language_message`: что не так;
- `why_it_matters`: юридический или операционный риск;
- `how_to_fix`: 1-3 действия без технической терминологии;
- `what_happens_if_ignored`: какие действия будут заблокированы.

Пример:
- Title: `Не выбраны данные для поля «Факты дела»`
- Message: `Шаг не знает, какие факты использовать для анализа.`
- Why: `Без фактов результата нельзя доверять.`
- Fix: `Выберите источник данных из предыдущего шага или входа сценария.`
- Ignored: `Публикация и запуск будут заблокированы.`

## Data Binding

Чип привязки должен читаться как юридический источник данных:
- `Факты дела ← Анализ материалов / Факты`
- `Адресат ← Вход сценария / Email клиента`
- `Текст письма ← Указано вручную + Результат претензии`

Basic mode не показывает путь поля, JSONPath, expression body или raw transform config.

## AI, Secrets And External Actions

AI-шаг в Basic:
- показывает, что используется AI;
- объясняет чувствительность данных;
- не показывает provider, prompt, temperature или ключ.

External action:
- должен явно показывать риск внешней отправки;
- публикация блокируется без согласования, если политика требует approval gate.

Secrets:
- всегда описываются как `секрет хранится на сервере`;
- значения секретов не отображаются ни в одном режиме.

## Release Gate

Перед выпуском проверить:
- Basic presentation JSON не содержит forbidden terms из этого документа;
- ошибки missing input, external delivery without approval, incompatible binding и secret exposure имеют no-code explanation;
- viewer не может редактировать;
- Advanced/Developer доступен только через permission gate;
- publish checklist объясняет блокеры человеческим языком и предлагает исправление.
