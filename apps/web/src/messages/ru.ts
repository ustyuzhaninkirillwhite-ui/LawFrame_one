export const ruMessages: Record<string, string> = {
  "LexFrame Stage 1 sign in": "Вход в LexFrame",
  "Development mode issues deterministic local bearer tokens so the workspace, RBAC and audit flows can be exercised without a live Supabase project.":
    "В режиме разработки выдаётся локальный токен, чтобы проверить рабочее пространство, роли, права доступа и аудит без живого проекта Supabase.",
  "Browser identity stays limited to Supabase Auth. The application session context is resolved only through the LexFrame backend.":
    "Идентификация в браузере ограничена Supabase Auth. Контекст сессии приложения формируется только через backend LexFrame.",
  "Full name": "Полное имя",
  "Any password in demo mode": "Любой пароль в демо-режиме",
  Password: "Пароль",
  "Sign in": "Войти",
  "Create account": "Создать учётную запись",
  "Need an account?": "Нужна учётная запись?",
  "Already have an account?": "Уже есть учётная запись?",
  "Authentication failed.": "Не удалось выполнить вход.",
  "Create the first workspace": "Создать первое рабочее пространство",
  "A valid identity exists, but the application stays blocked until at least one workspace is attached to the actor.":
    "Пользователь подтверждён, но приложение остаётся закрытым, пока к нему не привязано хотя бы одно рабочее пространство.",
  "Workspace creation failed.": "Не удалось создать рабочее пространство.",
  "Create workspace": "Создать пространство",
  "Sign out": "Выйти",
  Actor: "Пользователь",
  "Unknown actor": "Пользователь не определён",
  "No authenticated email": "Email не подтверждён",
  Boundary: "Контур",
  "Stage 1 control surface for workspace security.":
    "Панель управления безопасностью рабочего пространства.",
  "Backend now owns the session context, workspace boundary, RBAC and audit trail.":
    "Backend управляет контекстом сессии, рабочим контуром, правами доступа и журналом аудита.",
  "Browser gets only publishable auth state. Workspace permissions and audit decisions stay on the backend.":
    "Браузер получает только публичное состояние авторизации. Права пространства и решения аудита остаются на backend.",
  open: "открыто",
  gate: "контур",
  "Loading dashboard snapshot": "Загружается обзор",
  "Snapshot-first dashboard stitches runs, approvals, recommendations and notifications from the backend aggregation endpoint.":
    "Обзор собирает запуски, согласования, рекомендации и уведомления через backend-агрегацию.",
  "Active runs": "Активные запуски",
  "Pending approvals": "Ожидают согласования",
  "Unread notifications": "Непрочитанные уведомления",
  "System status": "Состояние системы",
  "Realtime-updated execution surface for active automation runs.":
    "Оперативная панель активных запусков автоматизаций.",
  "No active runs right now.": "Сейчас нет активных запусков.",
  "Manual gates that currently block delivery or document flow.":
    "Ручные согласования, которые сейчас удерживают отправку или документооборот.",
  "No pending approvals.": "Нет ожидающих согласований.",
  "Recent artifacts": "Последние результаты",
  "Latest persisted outputs available for document surfaces.":
    "Последние сохранённые результаты, доступные в документном контуре.",
  "Artifacts will appear after runs persist outputs.":
    "Результаты появятся после сохранения выходных данных запуска.",
  Recommendations: "Рекомендации",
  "Advisory candidates surfaced into the dashboard snapshot.":
    "Рекомендательные предложения, показанные в общем обзоре.",
  "No recommendation candidates right now.": "Сейчас нет новых рекомендаций.",
  "Lightweight operational transparency on top of readiness data.":
    "Краткая операционная сводка на основе данных готовности.",
  "Failed runs": "Ошибочные запуски",
  "Operational follow-up surface for failed executions.":
    "Операционная зона для разбора неуспешных запусков.",
  "No failed runs in the current snapshot.": "В текущем обзоре нет неуспешных запусков.",
  "Readiness inputs": "Условия готовности",
  "No blocking requirements": "Нет блокирующих требований",
  "Current version does not require extra documents, profiles or approvals.":
    "Текущая версия не требует дополнительных документов, профилей или согласований.",
  "Backend issues these statuses and frontend only renders them.":
    "Backend формирует эти статусы, интерфейс только отображает их.",
  optional: "необязательно",
  requirements: "требования",
  state: "состояние",
  json: "json",
  Dashboard: "Обзор",
  Notifications: "Уведомления",
  Modules: "Модули",
  Library: "Библиотека",
  "My Templates": "Мои шаблоны",
  Automations: "Автоматизации",
  Documents: "Документы",
  Profile: "Профиль",
  "Doc Templates": "Шаблоны документов",
  Approvals: "Согласования",
  Sources: "Источники",
  Research: "Исследование",
  "AI Chat": "ИИ-чат",
  "Workspace Recs": "Рекомендации команды",
  "Admin / Modules": "Администрирование / модули",
  "Admin / Moderation": "Администрирование / модерация",
  "Admin / Security": "Администрирование / безопасность",
  "Admin / Recommendations": "Администрирование / рекомендации",
  "control room": "центр управления",
  "user inbox": "входящие пользователя",
  registry: "реестр",
  "contracts first": "сначала договоры",
  "workspace drafts": "черновики пространства",
  "workflow draft": "черновик процесса",
  "private artifacts": "закрытые результаты",
  "personal + team policy": "личные и командные правила",
  "typed placeholders": "типизированные поля",
  "manual gate": "ручное согласование",
  "semantic registry": "семантический реестр",
  "cited analysis": "анализ с источниками",
  "disabled by gate": "закрыто контуром",
  "advisory only": "только рекомендация",
  "team scope": "командный контур",
  "module registry": "реестр модулей",
  "publication queue": "очередь публикаций",
  "release gates": "контроль релиза",
  "process mining": "анализ процессов",
  runs: "запуски",
  approvals: "согласования",
  artifacts: "результаты",
  recommendations: "рекомендации",
  ops: "эксплуатация",
  incidents: "инциденты",
  "No authenticated workspace yet.": "Рабочее пространство ещё не выбрано.",
  "Switch workspace": "Сменить пространство",
  "Workspace": "Рабочее пространство",
  "Current workspace": "Текущее пространство",
  "loading": "загрузка",
  "unknown": "неизвестно",
  "unassigned": "не назначено",
  "created": "создано",
  "progress": "ход",
  "View source updates": "Проверить обновления источника",
  "Open builder": "Автоматизация",
  "Back to documents": "Назад к документам",
  "Back to runs": "Назад к запускам",
  "Open document": "Открыть документ",
  "Open Activepieces": "Открыть автоматизацию",
  "Sync runtime": "Синхронизировать runtime",
  "Run smoke": "Запустить проверку",
  "Start run": "Запустить",
  "Dry run": "Пробный запуск",
  "Full run": "Полный запуск",
  "Approve": "Согласовать",
  "Reject": "Отклонить",
  "Request changes": "Запросить правки",
  "Send": "Отправить",
  "Cancel": "Отменить",
  "Retry": "Повторить",
  "Mark read": "Отметить прочитанным",
  "Mark all read": "Отметить всё прочитанным",
};

export const ruPageMessages: Record<string, string> = {
  "access reviews": "пересмотр доступа",
  "Privileged access gets reviewed on a campaign cadence.":
    "Привилегированный доступ пересматривается по плановой кампании.",
  "Access review campaigns are part of the same control plane, so privilege hygiene no longer sits in a disconnected admin corner.":
    "Кампании пересмотра доступа находятся в общей панели управления, поэтому контроль привилегий не отделён от администрирования.",
  compliance: "соответствие",
  "Retention and DSR posture stay next to security operations, not outside them.":
    "Retention и запросы субъектов данных находятся рядом с операциями безопасности.",
  "Processing activities, retention policies and subject-rights workload are presented as operational controls with the same admin rigor as incidents.":
    "Processing activities, политики хранения и запросы субъектов данных отображаются как операционные контроли с тем же уровнем строгости, что и инциденты.",
  "moderation queue": "очередь модерации",
  "Public library publication requests remain explicit review objects.":
    "Заявки на публикацию в публичной библиотеке остаются отдельными объектами рассмотрения.",
  "Moderation review is a dedicated route, not an overloaded workspace template screen.":
    "Модерация вынесена в отдельный раздел и не перегружает экран шаблона рабочего пространства.",
  review: "рассмотрение",
  "moderation detail": "детали модерации",
  "Approve, reject or request changes without mutating the workspace draft.":
    "Согласуйте, отклоняйте или запрашивайте правки без изменения черновика рабочего пространства.",
  "Approval creates the public library projection while preserving the workspace-owned template branch.":
    "Согласование создаёт публичную проекцию библиотеки, сохраняя ветку шаблона рабочего пространства.",
  decision: "решение",
  "admin modules": "администрирование модулей",
  "Legal module administration stays on the backend and remains version-aware.":
    "Администрирование юридических модулей остаётся на backend и учитывает версии.",
  "Module management visibility is separated from workspace draft editing and public moderation.":
    "Управление модулями отделено от редактирования черновиков и публичной модерации.",
  admin: "администрирование",
  "admin module detail": "детали модуля",
  "Module versions, validation and publication remain explicit.":
    "Версии модуля, проверка и публикация остаются явными.",
  "This admin view is bound to the same registry contract used by template validation.":
    "Административный экран использует тот же контракт реестра, что и проверка шаблонов.",
  versioned: "версионно",
  "admin recommendations": "администрирование рекомендаций",
  "Process mining and recommendation health stay in admin-only surfaces.":
    "Анализ процессов и состояние рекомендаций доступны только администраторам.",
  "Analytics view exposes mined patterns, process cases, module mapping and quality signals without turning recommendations into runnable automation.":
    "Аналитика показывает найденные паттерны, кейсы процессов, привязку модулей и сигналы качества без автоматического запуска рекомендаций.",
  "admin only": "только администратор",
  "admin security": "администрирование безопасности",
  "Release gates stay visible to the team long before the first beta.":
    "Контрольные условия релиза видны команде задолго до первой beta-версии.",
  "Р—РґРµСЃСЊ СЃС…РѕРґСЏС‚СЃСЏ security assumptions LexFrame: backend-only secrets, approval-first external delivery, traceability, reauth РґР»СЏ risk actions Рё browser access С‚РѕР»СЊРєРѕ Рє RLS-safe РґР°РЅРЅС‹Рј.":
    "Здесь сходятся допущения безопасности LexFrame: секреты только на backend, внешняя отправка через согласование, трассируемость, повторная авторизация для рискованных действий и доступ браузера только к RLS-safe данным.",
  "owner / admin / security_admin": "владелец / администратор / администратор безопасности",
  activepieces: "Автоматизация",
  "Builder access is short-lived, scoped and incident-aware.":
    "Доступ к конструктору краткосрочный, ограниченный и учитывает инциденты.",
  "The control plane shows token TTL, incident locks and runtime connection posture without ever exposing backend credentials.":
    "Панель показывает срок действия токена, блокировки инцидентов и состояние runtime-подключений без раскрытия backend-секретов.",
  "ai security": "безопасность ИИ",
  "AI routing becomes policy, not guesswork.":
    "Маршрутизация ИИ становится политикой, а не догадкой.",
  "Provider allowlists, ZDR requirements and sensitive-data posture are exposed in the same admin plane as the rest of the security controls.":
    "Списки разрешённых провайдеров, требования ZDR и политика чувствительных данных отображаются в общей панели безопасности.",
  alerts: "оповещения",
  "Alerts stay actionable instead of becoming background noise.":
    "Оповещения остаются рабочими задачами, а не фоновым шумом.",
  "Acknowledgement and resolution flow through explicit admin actions and land in the same audit trail that drives incident response.":
    "Принятие в работу и решение проходят через явные действия администратора и попадают в общий журнал аудита.",
  audit: "аудит",
  "One immutable audit stream, richer context.":
    "Единый неизменяемый журнал аудита с расширенным контекстом.",
  "Stage 11 keeps the canonical audit store intact and extends each event with category, session and data-class detail for investigations.":
    "Этап 11 сохраняет канонический журнал аудита и дополняет события категорией, сессией и классом данных.",
  "Containment decisions are visible before they become outages.":
    "Решения по локализации инцидентов видны до того, как они станут простоями.",
  "Incident mode, assignee state and status transitions live in the same admin surface as sessions, secrets and delivery controls.":
    "Режим инцидента, ответственный и переходы статусов находятся в одной панели с сессиями, секретами и контролями отправки.",
  "security policies": "политики безопасности",
  "Workspace guardrails stop being tribal knowledge and become explicit configuration.":
    "Ограничения рабочего пространства становятся явной конфигурацией, а не устным знанием команды.",
  "MFA, SSO, AI sensitivity and delivery approval rules are surfaced as workspace policy instead of being buried in backend defaults.":
    "MFA, SSO, политика чувствительных данных ИИ и согласование отправки отображаются как настройки пространства.",
  secrets: "секреты",
  "Secret state is inspectable without leaking secret material.":
    "Состояние секретов можно проверить без раскрытия их значений.",
  "Inventory, rotation cadence and compromise handling remain backend-only but visible enough for admins to operate securely.":
    "Инвентаризация, ротация и обработка компрометации остаются на backend, но достаточно видимы администраторам.",
  "security sessions": "сессии безопасности",
  "Every privileged session stays visible, attributable and revocable.":
    "Каждая привилегированная сессия видима, атрибутируема и может быть отозвана.",
  "Session inventory is now a first-class admin surface: current device, recent activity, revocation flow and reauth boundary all live in one place.":
    "Инвентаризация сессий стала полноценным административным разделом: устройство, активность, отзыв и контур повторной авторизации находятся в одном месте.",
  "Approval routes and tasks gate risky document actions.":
    "Маршруты и задачи согласования удерживают рискованные действия с документами.",
  "Finalization and external delivery no longer pass around approval state implicitly; they create explicit inbox tasks.":
    "Финализация и внешняя отправка создают явные задачи во входящих вместо неявной передачи состояния.",
  automations: "автоматизации",
  "Installed automation is a product record first, runtime projection second.":
    "Установленная автоматизация сначала является продуктовой записью и только потом runtime-проекцией.",
  "Stage 3 keeps installed automations as workspace-owned records pinned to a source template version, with explicit sync and compatibility states.":
    "Этап 3 хранит установленные автоматизации как записи пространства, закреплённые за версией шаблона, с явной синхронизацией и совместимостью.",
  "automation detail": "детали автоматизации",
  "Stage 4 binds install, sync, builder, and execution into one runtime contour.":
    "Этап 4 связывает установку, синхронизацию, конструктор и выполнение в единый runtime-контур.",
  "The detail card keeps the pinned automation, runtime binding, connections, pieces, warnings, and run history in one place. Activepieces stays downstream runtime, not the source of truth.":
    "Карточка деталей объединяет закреплённую автоматизацию, runtime-привязку, подключения, модули, предупреждения и историю запусков. Конструктор остаётся исполнительным runtime, а не источником истины.",
  runtime: "runtime",
  builder: "конструктор",
  "Builder session РєРѕСЂРѕС‚РєРѕР¶РёРІСѓС‰Р°СЏ, backend-issued Рё РїСЂРёРІСЏР·Р°РЅР° Рє runtime binding.":
    "Сессия конструктора краткосрочная, выдана backend и привязана к runtime-связке.",
  "Stage 4 РѕС‚РєСЂС‹РІР°РµС‚ СЂРµР°Р»СЊРЅС‹Р№ embedded builder РїРѕСЃР»Рµ sync: backend СЃРѕР·РґР°С‘С‚ project/user binding, РІС‹РґР°С‘С‚ short-lived token Рё СѓРїСЂР°РІР»СЏРµС‚ allowed pieces С‡РµСЂРµР· runtime boundary.":
    "Этап 4 открывает встроенный конструктор после синхронизации: backend создаёт привязку project/user, выдаёт краткосрочный токен и управляет разрешёнными pieces через runtime-контур.",
  embedded: "встроено",
  "source updates": "обновления источника",
  "Installed automations update only when the workspace explicitly applies a new source version.":
    "Установленные автоматизации обновляются только после явного применения новой версии источника.",
  "This page compares the pinned source version with the latest template version and applies the diff on demand.":
    "Страница сравнивает закреплённую версию источника с последней версией шаблона и применяет отличия по запросу.",
  pinned: "закреплено",
  "stage 10": "этап 10",
  "Realtime control room for executions, approvals and inbox load.":
    "Оперативный обзор запусков, согласований и нагрузки входящих.",
  "Snapshot endpoint stays canonical, realtime only accelerates delta delivery, and recovery still flows through server-owned sequence logs.":
    "Snapshot endpoint остаётся каноническим, realtime только ускоряет доставку изменений, а восстановление идёт через серверный журнал последовательностей.",
  "operational transparency": "операционная прозрачность",
  documents: "документы",
  "Document domain owns versions, storage rules and workflow artifacts.":
    "Документный домен управляет версиями, правилами хранения и результатами процессов.",
  "Stage 2 РґР°С‘С‚ СЂРµР°Р»СЊРЅСѓСЋ Р±РёР±Р»РёРѕС‚РµРєСѓ РґРѕРєСѓРјРµРЅС‚РѕРІ: immutable versions, signed URL boundary, run artifacts, processing queue Рё С€Р°Р±Р»РѕРЅС‹ РІРЅСѓС‚СЂРё РѕРґРЅРѕРіРѕ РєР°РЅРѕРЅРёС‡РµСЃРєРѕРіРѕ СЃР»РѕСЏ.":
    "Этап 2 даёт реальную библиотеку документов: неизменяемые версии, контур подписанных ссылок, результаты запусков, очередь обработки и шаблоны в одном каноническом слое.",
  "documents / generation": "документы / формирование",
  "Preview, validation and approval converge in one generation job.":
    "Предпросмотр, проверка и согласование сходятся в одной задаче формирования.",
  "Generation detail keeps preview state, validation blockers and approval gate status in a single Stage 7 record.":
    "Детали формирования хранят предпросмотр, блокеры проверки и состояние согласования в одной записи этапа 7.",
  "document detail": "детали документа",
  "Each document stays canonical even when storage objects and previews multiply.":
    "Документ остаётся каноническим, даже когда объектов хранения и предпросмотров становится больше.",
  "The document detail page keeps versions, processing jobs, relations, and signed URL flows attached to one canonical entity.":
    "Страница документа связывает версии, задачи обработки, связи и подписанные ссылки с одной канонической сущностью.",
  "immutable versions": "неизменяемые версии",
  library: "библиотека",
  "Product templates remain canonical long before runtime is production-ready.":
    "Продуктовые шаблоны остаются каноническими задолго до готовности runtime.",
  "Р—РґРµСЃСЊ РєР°С‚Р°Р»РѕРі С€Р°Р±Р»РѕРЅРѕРІ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚ РєР°Рє С‡Р°СЃС‚СЊ product model: ownership, readiness, module requirements Рё permission vocabulary РІРёРґРЅС‹ РґРѕ СЂРµР°Р»СЊРЅРѕРіРѕ Activepieces execution.":
    "Каталог шаблонов уже существует как часть продуктовой модели: владение, готовность, требования модулей и словарь прав видны до реального runtime-выполнения.",
  "contract driven": "по контракту",
  "my templates": "мои шаблоны",
  "Workspace drafts stay separate from product and public templates.":
    "Черновики пространства отделены от продуктовых и публичных шаблонов.",
  "This view renders workspace/private scope templates and their publication state.":
    "Этот раздел показывает шаблоны пространства и частного контура вместе с состоянием публикации.",
  "workspace scope": "контур пространства",
  "template detail": "детали шаблона",
  "Template detail owns install, readiness and related-library context.":
    "Детали шаблона отвечают за установку, готовность и связанные элементы библиотеки.",
  "The page renders backend-issued availability, requirements, version history and a workspace install flow.":
    "Страница показывает доступность, требования, историю версий и установку в пространство, выданные backend.",
  modules: "модули",
  "Legal modules are versioned product contracts, not builder-local actions.":
    "Юридические модули — версионные продуктовые контракты, а не локальные действия конструктора.",
  "Stage 3 exposes the module registry with IO schemas, requirements and runtime mapping placeholders.":
    "Этап 3 показывает реестр модулей со схемами ввода/вывода, требованиями и runtime-привязками.",
  "module detail": "детали модуля",
  "Each module publishes canonical IO and risk metadata before runtime orchestration exists.":
    "Каждый модуль публикует канонические ввод/вывод и риск-метаданные до появления runtime-оркестрации.",
  "This screen is wired to the stage 3 registry, including versions, requirements and runtime mapping placeholders.":
    "Экран связан с реестром этапа 3: версии, требования и runtime-привязки.",
  "db backed": "из базы данных",
  notifications: "уведомления",
  "Inbox for user-scoped operational events.":
    "Входящие для пользовательских операционных событий.",
  "Read, clear and follow notification actions without leaving the protected workspace shell.":
    "Читайте, очищайте и открывайте действия уведомлений без выхода из защищённого контура пространства.",
  "Recommendations stay advisory-only until a human converts them into a workflow draft.":
    "Рекомендации остаются советом, пока человек не превратит их в черновик процесса.",
  "The inbox now shows repeat count, explainability, workflow skeleton and explicit approval-safe delivery rules. Accept only creates a draft and never syncs runtime by itself.":
    "Входящие показывают повторяемость, объяснение, каркас процесса и правила безопасной отправки. Принятие создаёт только черновик и не синхронизирует runtime.",
  advisory: "рекомендательно",
  research: "исследование",
  "Hybrid search and citation-validated analysis now live inside one research surface.":
    "Гибридный поиск и анализ с проверенными ссылками объединены в одном исследовательском разделе.",
  "The research route keeps legal search, source basket selection and RAG on the backend, then renders only product-safe JSON results with stable citations.":
    "Раздел исследования держит правовой поиск, подбор источников и RAG на backend, а в интерфейс выводит только безопасные результаты с устойчивыми ссылками.",
  runs: "запуски",
  "Execution core snapshot": "Срез исполнительного контура",
  "Run-centric view of approvals, artifacts and delivery for the email-first MVP.":
    "Запуско-центричный просмотр согласований, результатов и отправки для email-first MVP.",
  "settings / clauses": "настройки / оговорки",
  "Clause library and phrase rules control drafting language.":
    "Библиотека оговорок и фразовые правила управляют языком документов.",
  "Reusable text blocks stay in schema-driven rich text while forbidden and preferred phrases remain separately auditable.":
    "Переиспользуемые текстовые блоки хранятся в schema-driven rich text, а запрещённые и предпочтительные фразы аудитируются отдельно.",
  "settings / documents": "настройки / документы",
  "Document types and structures define the canonical drafting skeleton.":
    "Типы и структуры документов задают канонический каркас подготовки.",
  "Sections, required blocks and placeholder-ready slots are stored in Stage 7 rather than inferred ad hoc during generation.":
    "Разделы, обязательные блоки и поля placeholders хранятся на этапе 7, а не выводятся ad hoc при формировании.",
  "settings / templates": "настройки / шаблоны",
  "Template library binds DOCX sources to typed placeholders and lifecycle.":
    "Библиотека шаблонов связывает DOCX-источники с типизированными полями и жизненным циклом.",
  "Stage 7 keeps template metadata, placeholder mappings and publish status above the existing document binary domain.":
    "Этап 7 хранит метаданные шаблонов, привязки placeholders и статус публикации поверх бинарного документного домена.",
  "settings / audit": "настройки / аудит",
  "Profile and approval changes stay visible in one audit stream.":
    "Изменения профиля и согласований видны в едином журнале аудита.",
  "Stage 7 writes profile publish, snapshot, template and approval actions into the shared backend audit log.":
    "Этап 7 пишет публикации профиля, срезы, шаблоны и действия согласования в общий backend-аудит.",
  "settings / effective": "настройки / действующий профиль",
  "Effective profile is always backend-derived.":
    "Действующий профиль всегда рассчитывается backend.",
  "Preview and run execution use the same effective snapshot logic rather than duplicating merge policy in the client.":
    "Предпросмотр и выполнение используют одну backend-логику действующего среза без дублирования merge-policy в клиенте.",
  "settings / import": "настройки / импорт",
  "Imported documents create draft profile suggestions only.":
    "Импортированные документы создают только предложения для черновика профиля.",
  "Import pipeline extracts hints and prepares a draft job without auto-publishing or replacing the active profile.":
    "Импорт извлекает подсказки и готовит черновик без автопубликации и замены активного профиля.",
  "settings / profile": "настройки / профиль",
  "Personal profile overrides stay explicit, versioned and mergeable.":
    "Личные переопределения профиля остаются явными, версионными и объединяемыми.",
  "Stage 7 adds personal legal-work profiles above the existing identity layer, with immutable publish and effective snapshot preview.":
    "Этап 7 добавляет личные юридические профили поверх identity-слоя с неизменяемой публикацией и предпросмотром действующего среза.",
  "settings / team profile": "настройки / командный профиль",
  "Workspace profile defines locked defaults for the team.":
    "Профиль пространства задаёт заблокированные правила по умолчанию для команды.",
  "Team rules remain authoritative and personal overrides cannot remove locked sections silently.":
    "Командные правила остаются главными, а личные переопределения не могут скрыто удалить заблокированные разделы.",
  "settings / versions": "настройки / версии",
  "Published profile versions remain immutable.":
    "Опубликованные версии профиля остаются неизменяемыми.",
  "Restoring an older profile state creates a new draft version instead of mutating published history.":
    "Восстановление старого состояния создаёт новый черновик вместо изменения опубликованной истории.",
  sources: "источники",
  "Source registry, import jobs and semantic indexing now form the legal research backbone.":
    "Реестр источников, импорт и семантическая индексация формируют основу правового исследования.",
  "Stage 6 keeps legal sources separate from file storage, attaches lifecycle and access state to each source, and prepares them for search and citation-validated RAG.":
    "Этап 6 отделяет правовые источники от файлового хранения, добавляет жизненный цикл и доступ, готовит их к поиску и RAG с проверенными ссылками.",
  "source detail": "детали источника",
  "Every legal source now carries its own import, extraction and chunking audit trail.":
    "У каждого правового источника есть собственный след импорта, извлечения и разбиения на фрагменты.",
  "The detail page exposes how one workspace source moved from document storage into the legal semantic layer used by search, workflow runtime and RAG.":
    "Страница показывает, как источник пространства перешёл из документного хранения в семантический слой для поиска, runtime и RAG.",
  "template edit": "редактирование шаблона",
  "Template root metadata and version payloads evolve independently.":
    "Корневые метаданные шаблона и содержимое версий изменяются независимо.",
  "Metadata updates stay on the template root while new draft versions snapshot workflow and requirements.":
    "Обновления метаданных остаются на корне шаблона, а новые черновые версии фиксируют процесс и требования.",
  "draft editor": "редактор черновика",
  "publication status": "статус публикации",
  "Workspace draft and public projection keep separate lifecycles.":
    "Черновик пространства и публичная проекция имеют разные жизненные циклы.",
  "The route shows publication state and the latest visible moderation record for the selected template.":
    "Раздел показывает состояние публикации и последнюю видимую запись модерации для выбранного шаблона.",
  status: "статус",
  publication: "публикация",
  "Publishing and moderation are explicit product flows, not hidden side effects.":
    "Публикация и модерация являются явными продуктовыми процессами, а не скрытыми побочными эффектами.",
  "This route exposes internal draft publication and public-library submission as separate actions.":
    "Раздел показывает публикацию внутреннего черновика и заявку в публичную библиотеку как разные действия.",
  moderation: "модерация",
  "workspace recommendations": "рекомендации пространства",
  "Team-level recommendations stay visible only to recommendation managers.":
    "Командные рекомендации видны только управляющим рекомендациями.",
  "Workspace view exposes shared patterns, but accepting them still creates a draft first and keeps every external action behind approval.":
    "Раздел пространства показывает общие паттерны, но принятие сначала создаёт черновик и оставляет внешние действия за согласованием.",
  "stage 2": "этап 2",
  "stage 3": "этап 3",
  "stage 4": "этап 4",
  "stage 6": "этап 6",
  "stage 7": "этап 7",
  "stage 8": "этап 8",
  "stage 11.1": "этап 11.1",
  "stage 11.3": "этап 11.3",
  "stage 11.4": "этап 11.4",
  "stage 11.5": "этап 11.5",
  "stage 11.7": "этап 11.7",
  "stage 11.8": "этап 11.8",
  "stage 11.9": "этап 11.9",
  "stage 11.10": "этап 11.10",
  "stage 11.1 / 11.2": "этап 11.1 / 11.2",
  "Auth / RBAC / RLS": "Авторизация / RBAC / RLS",
  "Stage 2 Documents / Storage": "Этап 2: документы / хранилище",
  "Stage 4-8 Runtime / AI / Delivery": "Этапы 4-8: runtime / ИИ / отправка",
  "Stage 9 Recommendations / Mining": "Этап 9: рекомендации / анализ процессов",
  "Stage 10 Realtime / Dashboard": "Этап 10: realtime / обзор",
  "Stage 11 Security Control Plane": "Этап 11: контур безопасности",
  "Stage 12 Release Readiness": "Этап 12: релизная готовность",
};

export const ruStatuses: Record<string, string> = {
  ready: "готово",
  degraded: "ограничено",
  blocked: "заблокировано",
  healthy: "исправно",
  ok: "исправно",
  success: "успешно",
  warning: "предупреждение",
  error: "ошибка",
  draft: "черновик",
  not_started: "не начато",
  design_ready: "готов дизайн",
  contract_ready: "готов контракт",
  backend_ready: "готов backend",
  frontend_ready: "готов интерфейс",
  integration_ready: "готово к интеграции",
  production_ready: "готово к production",
  unauthenticated: "не авторизован",
  email_unconfirmed: "email не подтверждён",
  needs_workspace: "нужно рабочее пространство",
  needs_mfa: "требуется MFA",
  published: "опубликовано",
  deprecated: "устарело",
  valid: "корректно",
  invalid: "некорректно",
  compatible: "совместимо",
  runtime_sync_pending: "ожидает синхронизации runtime",
  missing_requirements: "не хватает условий",
  policy_blocked: "заблокировано политикой",
  not_requested: "не запрошено",
  submitted: "отправлено на рассмотрение",
  approved: "согласовано",
  rejected: "отклонено",
  changes_requested: "запрошены правки",
  pending: "ожидает",
  synced: "синхронизировано",
  failed: "ошибка",
  queued: "в очереди",
  created: "создано",
  precheck_failed: "предпроверка не пройдена",
  ready_to_start: "готово к запуску",
  starting: "запускается",
  running: "выполняется",
  waiting_approval: "ожидает согласования",
  waiting_delivery_approval: "ожидает согласования отправки",
  delivering: "отправляется",
  completed: "завершено",
  completed_with_warnings: "завершено с предупреждениями",
  cancel_requested: "запрошена отмена",
  cancelled: "отменено",
  retrying: "повторяется",
  expired: "истекло",
  not_required: "не требуется",
  sending: "отправляется",
  sent: "отправлено",
  failed_retryable: "ошибка, можно повторить",
  failed_permanent: "окончательная ошибка",
  skipped: "пропущено",
  waiting_external_callback: "ожидает внешнего callback",
  low: "низкий",
  medium: "средний",
  high: "высокий",
  critical: "критический",
  open: "открыт",
  acknowledged: "принят в работу",
  resolved: "решён",
  contained: "локализован",
  closed: "закрыт",
  active: "активно",
  archived: "в архиве",
  suspended: "приостановлено",
  upload_pending: "ожидает загрузки",
  uploaded: "загружено",
  processing: "обрабатывается",
  soft_deleted: "мягко удалено",
  hard_delete_pending: "ожидает окончательного удаления",
  clean: "чисто",
  infected: "обнаружена угроза",
  manual_review_required: "нужна ручная проверка",
  not_configured: "не настроено",
  requires_ocr: "требуется OCR",
  private_bucket: "закрытое хранилище",
  signed_url_only: "только подписанная ссылка",
  quarantined: "карантин",
  candidate: "предложение",
  accepted: "принято",
  dismissed: "скрыто",
  snoozed: "отложено",
  enabled: "включено",
  beta: "beta",
  idle: "ожидает",
  loading: "загрузка",
  yes: "да",
  "missing bindings": "не хватает привязок",
  "n/a": "н/д",
  all: "все",
  product: "продукт",
  public: "публично",
  internal: "внутренний контур",
  confidential: "конфиденциально",
  legal_secret: "адвокатская тайна",
  personal_data: "персональные данные",
  client_material: "материалы клиента",
  ai_forbidden_external: "ИИ запрещён для внешней обработки",
  anonymized: "обезличено",
  product_private: "продуктовый закрытый контур",
  workspace_private: "закрытый контур пространства",
  user_private: "личный закрытый контур",
  restricted_provider: "ограниченный провайдер",
  case_material: "материалы дела",
  evidence: "доказательства",
  legal_source: "юридический источник",
  document_template: "шаблон документа",
  generated_document: "сформированный документ",
  draft_document: "черновик документа",
  delivery_attachment: "вложение отправки",
  profile_clause: "профильная оговорка",
  other: "другое",
  court_decision: "судебное решение",
  statute: "закон",
  regulation: "нормативный акт",
  contract_template: "шаблон договора",
  user_document: "документ пользователя",
  internal_memo: "внутренняя записка",
  analysis_result: "результат анализа",
  automation_result: "результат автоматизации",
  workflow_output: "выходные данные процесса",
  user_upload: "загрузка пользователя",
  manual: "вручную",
  original: "оригинал",
  preview_pdf: "предпросмотр PDF",
  thumbnail: "миниатюра",
  indexed: "проиндексировано",
  requires_indexing: "требуется индексация",
  text_only: "только текст",
  embeddings_ready: "векторы готовы",
  facts: "факты",
  court_reasoning: "мотивировка суда",
  operative_part: "резолютивная часть",
  claims: "требования",
  citations: "ссылки на источники",
  global_chat: "общий чат",
  document_chat: "документный чат",
  automation_chat: "чат автоматизации",
  create_workflow: "создание процесса",
  modify_workflow: "изменение процесса",
  explain_workflow: "объяснение процесса",
  extract_fields: "извлечение полей",
  validation_failed: "проверка не пройдена",
  provider_selected: "провайдер выбран",
  response_received: "ответ получен",
  user: "пользователь",
  assistant: "ассистент",
  system: "система",
  legal_research: "юридическое исследование",
  document_generation: "генерация документов",
  filing: "подача",
  advisory: "рекомендация",
  available: "доступно",
  source_update_available: "доступно обновление источника",
  "B_INTERNAL_WORKSPACE": "внутренние данные пространства",
  "A_PUBLIC": "публичные данные",
  "A_TEMPLATE_NON_SENSITIVE": "нечувствительный шаблон",
  "B_ANONYMIZED_LEGAL": "обезличенные юридические данные",
  "C_CONFIDENTIAL_CLIENT": "конфиденциальные данные клиента",
  "C_LEGAL_SECRET": "адвокатская тайна",
  "D_AI_EXTERNAL_FORBIDDEN": "внешний ИИ запрещён",
};

export const ruRoles: Record<string, string> = {
  owner: "Владелец",
  admin: "Администратор",
  lawyer: "Юрист",
  assistant: "Ассистент",
  viewer: "Наблюдатель",
  security_admin: "Администратор безопасности",
  billing_admin: "Администратор расчётов",
  custom: "Настраиваемая роль",
};

export const ruRoleDescriptions: Record<string, string> = {
  owner: "Полное управление рабочим пространством.",
  admin: "Администрирование пространства и участников.",
  lawyer: "Работа с юридическими документами, согласованиями и исследованиями.",
  assistant: "Подготовка документов и сопровождение рабочих процессов.",
  viewer: "Доступ только на чтение.",
  security_admin: "Управление безопасностью, аудитом и инцидентами.",
  billing_admin: "Управление расчётами и финансовыми настройками.",
};

export const ruPermissionScopes: Record<string, string> = {
  workspace: "пространство",
  profile: "профиль",
  document: "документы",
  module: "модули",
  ai: "ИИ",
  automation: "автоматизации",
  activepieces: "Автоматизация",
  approval: "согласования",
  connection: "подключения",
  moderation: "модерация",
  recommendation: "рекомендации",
  billing: "расчёты",
  audit: "аудит",
};

export const ruPermissions: Record<string, { readonly label: string; readonly description: string }> = {
  "dashboard.view": {
    label: "Просмотр обзора",
    description: "Просмотр сводки, входящих событий и данных восстановления realtime.",
  },
  "workspace.read": {
    label: "Просмотр пространства",
    description: "Чтение контекста и метаданных рабочего пространства.",
  },
  "workspace.update": {
    label: "Изменение пространства",
    description: "Обновление настроек и сведений рабочего пространства.",
  },
  "workspace.switch": {
    label: "Смена пространства",
    description: "Переключение между доступными рабочими пространствами.",
  },
  "workspace.invite": {
    label: "Приглашение участников",
    description: "Создание и отзыв приглашений в рабочее пространство.",
  },
  "workspace.member.read": {
    label: "Просмотр участников",
    description: "Просмотр состава команды и назначенных ролей.",
  },
  "workspace.member.update_role": {
    label: "Изменение ролей участников",
    description: "Назначение и изменение ролей участников пространства.",
  },
  "workspace.member.remove": {
    label: "Удаление участников",
    description: "Исключение участников из рабочего пространства.",
  },
  "workspace.security.read": {
    label: "Просмотр безопасности",
    description: "Просмотр политик безопасности, сессий и контрольных состояний.",
  },
  "workspace.security.manage": {
    label: "Управление безопасностью",
    description: "Изменение политик безопасности рабочего пространства.",
  },
  "session.read": {
    label: "Просмотр сессий",
    description: "Просмотр активных пользовательских сессий.",
  },
  "session.revoke": {
    label: "Отзыв сессий",
    description: "Принудительное завершение пользовательских сессий.",
  },
  "profile.read": {
    label: "Просмотр профиля",
    description: "Просмотр юридического профиля и действующих правил.",
  },
  "profile.update": {
    label: "Изменение профиля",
    description: "Создание и изменение черновиков юридического профиля.",
  },
  "profile.publish": {
    label: "Публикация профиля",
    description: "Публикация неизменяемых версий юридического профиля.",
  },
  "profile.override_personal": {
    label: "Личные переопределения профиля",
    description: "Разрешение личных правил поверх командного профиля.",
  },
  "document.read": {
    label: "Просмотр документов",
    description: "Чтение документов, версий и связанных результатов.",
  },
  "document.upload": {
    label: "Загрузка документов",
    description: "Добавление новых документов и версий.",
  },
  "document.generate": {
    label: "Формирование документов",
    description: "Запуск подготовки документов по шаблонам.",
  },
  "document.delete": {
    label: "Удаление документов",
    description: "Архивация и мягкое удаление документов пространства.",
  },
  "document.restore": {
    label: "Восстановление документов",
    description: "Восстановление архивных или мягко удалённых документов.",
  },
  "document.template.read": {
    label: "Просмотр шаблонов документов",
    description: "Чтение канонических шаблонов и их привязок.",
  },
  "document.template.publish": {
    label: "Публикация шаблонов документов",
    description: "Публикация черновиков шаблонов в рабочее использование.",
  },
  "document.template.map_fields": {
    label: "Настройка полей шаблонов",
    description: "Настройка placeholders и привязок полей.",
  },
  "document.template.manage": {
    label: "Управление шаблонами документов",
    description: "Создание и обновление шаблонов документов.",
  },
  "document.validation.read": {
    label: "Просмотр проверок документов",
    description: "Просмотр отчётов проверки и блокирующих замечаний.",
  },
  "document.validation.resolve": {
    label: "Устранение замечаний проверки",
    description: "Отметка замечаний как устранённых и повторный запуск проверки.",
  },
  "legal_sources.manage": {
    label: "Управление правовыми источниками",
    description: "Создание, повторный запуск, архивация и управление источниками.",
  },
  "module.manage": {
    label: "Управление юридическими модулями",
    description: "Создание, версионирование, публикация и вывод модулей из эксплуатации.",
  },
  "legal_search.use": {
    label: "Использование правового поиска",
    description: "Запуск поисковых запросов и открытие найденных источников.",
  },
  "automation.read": {
    label: "Просмотр автоматизаций",
    description: "Просмотр библиотеки, установленных автоматизаций и runtime-состояний.",
  },
  "automation.install": {
    label: "Установка автоматизаций",
    description: "Установка шаблонов в рабочее пространство.",
  },
  "automation.edit": {
    label: "Редактирование автоматизаций",
    description: "Создание и изменение черновиков автоматизаций.",
  },
  "automation.fork": {
    label: "Ответвление автоматизаций",
    description: "Создание рабочей копии из существующего шаблона или установки.",
  },
  "automation.update_source": {
    label: "Обновление источника автоматизации",
    description: "Применение новой версии исходного шаблона.",
  },
  "automation.approve_external": {
    label: "Согласование внешней отправки",
    description: "Согласование рискованных внешних отправок перед выполнением.",
  },
  "automation.publish": {
    label: "Публикация автоматизации",
    description: "Публикация шаблона автоматизации.",
  },
  "automation.submit_publication": {
    label: "Заявка на публикацию",
    description: "Отправка шаблона рабочего пространства в очередь модерации.",
  },
  "automation.run": {
    label: "Запуск автоматизаций",
    description: "Создание и выполнение запусков автоматизаций.",
  },
  "ai.chat.use": {
    label: "Использование ИИ-чата",
    description: "Начало и продолжение сессий планирования через ИИ.",
  },
  "ai.workflow.create": {
    label: "Создание процесса через ИИ",
    description: "Создание черновиков автоматизаций через ИИ-планировщик.",
  },
  "ai.workflow.patch": {
    label: "Изменение процесса через ИИ",
    description: "Изменение процессов с помощью ИИ-патчей.",
  },
  "ai.policy.read": {
    label: "Просмотр ИИ-политик",
    description: "Просмотр правил маршрутизации и ограничений ИИ.",
  },
  "ai.policy.manage": {
    label: "Управление ИИ-политиками",
    description: "Изменение правил маршрутизации и защиты ИИ.",
  },
  "legal_rag.use": {
    label: "Использование правового RAG",
    description: "Запуск анализа с обязательными ссылками через ИИ-шлюз.",
  },
  "ai.use_confidential": {
    label: "Доступ к конфиденциальному ИИ-маршруту",
    description: "Разрешение конфиденциальных материалов в утверждённых ИИ-маршрутах.",
  },
  "ai.use_legal_secret": {
    label: "Доступ к ИИ-маршруту с адвокатской тайной",
    description: "Разрешение материалов с юридической тайной в утверждённых маршрутах.",
  },
  "ai.admin.playground": {
    label: "Доступ к ИИ-песочнице",
    description: "Использование внутреннего стенда проверки ИИ и подсказок.",
  },
  "activepieces.open_builder": {
    label: "Открытие конструктора автоматизаций",
    description: "Открытие встроенного конструктора с ограниченным токеном.",
  },
  "activepieces.sync_flow": {
    label: "Синхронизация конструктора автоматизаций",
    description: "Синхронизация runtime-проекта и автоматизации.",
  },
  "approval.route.manage": {
    label: "Управление маршрутами согласования",
    description: "Создание и обновление маршрутов согласования.",
  },
  "approval.task.read": {
    label: "Просмотр задач согласования",
    description: "Открытие входящих задач и контекста решения.",
  },
  "approval.task.decide": {
    label: "Решение задач согласования",
    description: "Согласование, отклонение или запрос правок.",
  },
  "connections.manage": {
    label: "Управление подключениями",
    description: "Создание, проверка и отзыв runtime-подключений.",
  },
  "moderation.review": {
    label: "Модерация публикаций",
    description: "Согласование, отклонение или запрос правок по заявкам публикации.",
  },
  "recommendation.read": {
    label: "Просмотр рекомендаций",
    description: "Открытие персональных рекомендаций и предварительных просмотров.",
  },
  "recommendation.accept": {
    label: "Принятие рекомендации",
    description: "Преобразование рекомендации в черновик процесса.",
  },
  "recommendation.manage": {
    label: "Управление командными рекомендациями",
    description: "Просмотр командных паттернов, подавлений и аналитики.",
  },
  "secret.read_metadata": {
    label: "Просмотр метаданных секретов",
    description: "Просмотр состояния секретов без раскрытия значений.",
  },
  "secret.rotate": {
    label: "Ротация секретов",
    description: "Запуск и завершение ротации секретов.",
  },
  "billing.read": {
    label: "Просмотр расчётов",
    description: "Просмотр расчётной информации.",
  },
  "billing.manage": {
    label: "Управление расчётами",
    description: "Изменение расчётных настроек.",
  },
  "audit.read": {
    label: "Просмотр аудита",
    description: "Чтение неизменяемого журнала аудита.",
  },
  "audit.export": {
    label: "Экспорт аудита",
    description: "Экспорт событий аудита.",
  },
  "incident.read": {
    label: "Просмотр инцидентов",
    description: "Просмотр инцидентов безопасности.",
  },
  "incident.manage": {
    label: "Управление инцидентами",
    description: "Создание и изменение инцидентов безопасности.",
  },
  "compliance.read": {
    label: "Просмотр соответствия",
    description: "Просмотр retention, DSR и processing activity.",
  },
  "compliance.manage": {
    label: "Управление соответствием",
    description: "Управление retention и DSR-процессами.",
  },
  "access_review.manage": {
    label: "Управление пересмотром доступа",
    description: "Создание и ведение кампаний пересмотра привилегий.",
  },
  "support.bundle.create": {
    label: "Создание support-пакета",
    description: "Формирование диагностического пакета для поддержки.",
  },
};
