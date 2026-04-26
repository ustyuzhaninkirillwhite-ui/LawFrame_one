create table if not exists app.module_no_code_labels (
  id uuid primary key default public.app_uuid_v7(),
  module_version_id uuid null references app.legal_module_versions(id) on delete cascade,
  module_code text not null,
  locale text not null check (locale in ('ru-RU', 'en-US')),
  title text not null,
  short_description text not null,
  long_description text null,
  input_labels jsonb not null default '{}'::jsonb,
  output_labels jsonb not null default '{}'::jsonb,
  risk_explanation text null,
  examples jsonb not null default '[]'::jsonb,
  help_text jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (module_code, locale)
);

create table if not exists app.canvas_validation_message_templates (
  code text not null,
  locale text not null check (locale in ('ru-RU', 'en-US')),
  severity text not null check (severity in ('info', 'warning', 'error', 'policy_block')),
  title_template text not null,
  message_template text not null,
  why_it_matters_template text not null,
  how_to_fix_template text not null,
  what_happens_if_ignored_template text null,
  quick_fix_operation_type text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (code, locale)
);

create index if not exists idx_module_no_code_labels_module_locale
  on app.module_no_code_labels (module_code, locale);

create index if not exists idx_canvas_validation_message_templates_locale
  on app.canvas_validation_message_templates (locale, severity);

alter table app.module_no_code_labels enable row level security;
alter table app.canvas_validation_message_templates enable row level security;

drop policy if exists module_no_code_labels_select_viewer on app.module_no_code_labels;
create policy module_no_code_labels_select_viewer
  on app.module_no_code_labels
  for select
  to authenticated
  using (true);

drop policy if exists canvas_validation_message_templates_select_viewer
  on app.canvas_validation_message_templates;
create policy canvas_validation_message_templates_select_viewer
  on app.canvas_validation_message_templates
  for select
  to authenticated
  using (true);

grant select on app.module_no_code_labels to authenticated;
grant select on app.canvas_validation_message_templates to authenticated;

insert into app.module_no_code_labels (
  module_code,
  locale,
  title,
  short_description,
  long_description,
  input_labels,
  output_labels,
  risk_explanation,
  examples,
  help_text
)
values
  (
    'manual_start',
    'ru-RU',
    'Запустить вручную',
    'Сценарий запускается пользователем из LexFrame.',
    'Используйте этот старт, когда юрист сам выбирает момент запуска сценария.',
    '{}'::jsonb,
    '{"run_context":"Контекст запуска","input_documents":"Материалы дела","profile_snapshot":"Профиль юридической работы"}'::jsonb,
    'Низкий риск: запуск не выполняет внешних действий.',
    '["Ручной запуск подготовки претензии"]'::jsonb,
    '{"when_to_use":"Когда сценарий должен запускаться юристом вручную."}'::jsonb
  ),
  (
    'case_law_search',
    'ru-RU',
    'Найти судебную практику',
    'Подбирает судебные акты и источники по вопросу дела.',
    'Шаг ищет релевантные правовые источники и создаёт подборку для анализа или документа.',
    '{"query":"Правовой вопрос","profile_snapshot":"Профиль юридической работы"}'::jsonb,
    '{"selected_sources":"Выбранные судебные акты","search_report":"Отчёт поиска"}'::jsonb,
    'Средний риск: результат влияет на правовую позицию и требует проверки юристом.',
    '["Поиск практики перед подготовкой претензии"]'::jsonb,
    '{"when_to_use":"Когда документу нужны ссылки на судебную практику."}'::jsonb
  ),
  (
    'case_material_analysis',
    'ru-RU',
    'Проанализировать материалы дела',
    'Выделяет факты, риски и недостающие доказательства из документов.',
    'Шаг анализирует выбранные материалы дела и готовит структурированный результат для следующих шагов.',
    '{"documents":"Материалы дела","profile_snapshot":"Профиль юридической работы","case_law":"Подобранная практика"}'::jsonb,
    '{"facts":"Факты дела","risks":"Риски","recommended_actions":"Рекомендованные действия"}'::jsonb,
    'Высокий риск: шаг работает с конфиденциальными материалами и юридическими выводами.',
    '["Анализ материалов перед подготовкой претензии"]'::jsonb,
    '{"when_to_use":"Когда нужно понять факты, риски и пробелы в доказательствах."}'::jsonb
  ),
  (
    'pretrial_claim_draft',
    'ru-RU',
    'Подготовить претензию',
    'Создаёт проект досудебной претензии по фактам, практике и шаблону.',
    'Шаг подготавливает проект документа, который должен быть проверен перед внешней отправкой.',
    '{"facts":"Факты дела","profile_snapshot":"Профиль юридической работы","case_law":"Подобранная практика","template":"Шаблон претензии"}'::jsonb,
    '{"draft_document":"Проект претензии","draft_summary":"Краткое описание проекта"}'::jsonb,
    'Высокий риск: создаётся юридически значимый документ для дальнейшей отправки.',
    '["Анализ материалов → Подготовить претензию → Согласовать → Сохранить"]'::jsonb,
    '{"when_to_use":"Когда нужно быстро подготовить первый проект претензии."}'::jsonb
  ),
  (
    'human_approval',
    'ru-RU',
    'Согласовать результат',
    'Останавливает сценарий до решения ответственного пользователя.',
    'Шаг создаёт задачу согласования и возвращает решение: одобрено, отклонено или нужны правки.',
    '{"artifact":"Что согласовать","approval_context":"Контекст согласования"}'::jsonb,
    '{"decision":"Решение","comment":"Комментарий","approved_artifact":"Одобренный результат"}'::jsonb,
    'Средний риск: согласование снижает риск внешней отправки неподтверждённого результата.',
    '["Согласование перед отправкой письма клиенту"]'::jsonb,
    '{"when_to_use":"Перед внешней отправкой, публикацией или высокорисковым документом."}'::jsonb
  ),
  (
    'email_delivery',
    'ru-RU',
    'Отправить письмо после подтверждения',
    'Отправляет результат по email только при выполнении policy и согласований.',
    'Шаг выполняет внешнюю доставку результата и должен иметь approval gate перед публикацией сценария.',
    '{"artifact":"Что отправить","recipients":"Получатели","message":"Текст письма"}'::jsonb,
    '{"delivery_receipt":"Подтверждение отправки"}'::jsonb,
    'Критический риск: внешняя отправка может раскрыть документы или юридическую позицию.',
    '["Согласовать результат → Отправить письмо"]'::jsonb,
    '{"when_to_use":"Когда итоговый документ нужно отправить внешнему адресату."}'::jsonb
  )
on conflict (module_code, locale) do update
set
  title = excluded.title,
  short_description = excluded.short_description,
  long_description = excluded.long_description,
  input_labels = excluded.input_labels,
  output_labels = excluded.output_labels,
  risk_explanation = excluded.risk_explanation,
  examples = excluded.examples,
  help_text = excluded.help_text,
  updated_at = timezone('utc', now());

insert into app.canvas_validation_message_templates (
  code,
  locale,
  severity,
  title_template,
  message_template,
  why_it_matters_template,
  how_to_fix_template,
  what_happens_if_ignored_template,
  quick_fix_operation_type
)
values
  (
    'WF_TYPE_001_REQUIRED_INPUT_MISSING',
    'ru-RU',
    'error',
    'Не выбраны данные для обязательного поля',
    'Шаг не знает, какие данные использовать.',
    'Без обязательных данных шаг не сможет подготовить юридически корректный результат.',
    'Выберите источник данных или укажите значение вручную.',
    'Публикация и запуск могут быть заблокированы.',
    'bind_input'
  ),
  (
    'WF_POLICY_001_EXTERNAL_ACTION_REQUIRES_APPROVAL',
    'ru-RU',
    'policy_block',
    'Перед внешней отправкой нужно согласование',
    'Сценарий выполняет внешнее действие без approval gate.',
    'Внешняя отправка может раскрыть документы или юридическую позицию.',
    'Добавьте шаг «Согласовать результат» перед внешним действием.',
    'Публикация и запуск будут заблокированы.',
    'insert_node_before'
  ),
  (
    'WF_POLICY_005_SECRET_VALUE_IN_CONFIG',
    'ru-RU',
    'policy_block',
    'Секрет нельзя хранить в настройках',
    'В настройках шага найдено значение, похожее на ключ или токен.',
    'Секреты должны оставаться на backend и не попадать в DSL, audit или frontend.',
    'Удалите значение и выберите серверное подключение.',
    'Сохранение, публикация или запуск могут быть заблокированы.',
    'remove_secret'
  ),
  (
    'WF_TYPE_004_TYPE_INCOMPATIBLE',
    'ru-RU',
    'error',
    'Источник данных не подходит',
    'Выбранный источник не совпадает с типом данных, который нужен шагу.',
    'Несовместимые данные приводят к ошибкам запуска или неправильным документам.',
    'Выберите другой источник данных или добавьте допустимое преобразование.',
    'Проверка, публикация или запуск могут быть заблокированы.',
    'bind_input'
  )
on conflict (code, locale) do update
set
  severity = excluded.severity,
  title_template = excluded.title_template,
  message_template = excluded.message_template,
  why_it_matters_template = excluded.why_it_matters_template,
  how_to_fix_template = excluded.how_to_fix_template,
  what_happens_if_ignored_template = excluded.what_happens_if_ignored_template,
  quick_fix_operation_type = excluded.quick_fix_operation_type,
  updated_at = timezone('utc', now());
