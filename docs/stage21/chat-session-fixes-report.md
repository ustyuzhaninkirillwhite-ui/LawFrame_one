# Отчет по изменениям и исправленным багам в рамках чата Stage 21

Дата подготовки: 2026-05-09  
Рабочая ветка: `main`  
Итоговый коммит: `30c87d3 Стабилизирован интерфейс LexFrame Stage 21`  
Проект: LexFrame / Law Frame  

## 1. Краткое резюме

В этом чате был выполнен большой блок работ по доведению текущего состояния LexFrame до Stage 21. Работа включала:

- фиксацию и запуск текущего runtime-состояния проекта;
- создание `stage21-up` runtime script для запуска текущего проекта со всеми изменениями этапов 0-21;
- переработку AppShell, sidebar, проектов, placeholder-страниц и entry-redirect;
- добавление глобального компактного AI composer;
- переработку основного интерфейса чата из трехколоночной рабочей области в нормальный conversational UI;
- добавление создания проектов через backend/API/hooks;
- стабилизацию ActivePieces Canvas на уровне backend readiness, frontend session lifecycle, iframe health monitor и runtime compose;
- исправление нескольких разных причин бесконечной загрузки Canvas;
- финальную фиксацию изменений в `main` и push в `origin/main`.

Основная линия работ менялась по мере обнаружения проблем в браузере. Сначала были исправлены видимые UI-проблемы, затем стало ясно, что самая критичная часть - нестабильность ActivePieces Canvas. По Canvas были отдельно исправлены три разные категории проблем: raw `Invalid Access`, таймерное пересоздание iframe примерно через 90 секунд и зависание после перехода `Canvas -> Проекты -> Автоматизации`.

## 2. Редуцированная хронология пользовательских запросов

Ниже запросы сведены к сути, без дословного повторения всех комментариев:

1. Зафиксировать изменения в `main` и запустить проект.
2. Создать runtime script для текущего состояния Stage 21 и запускать проект не как старый Stage 17.
3. Переделать sidebar: бренд `LexFrame`, убрать `Главная`, добавить чаты, проекты, инструменты, автоматизации.
4. Добавить ChatGPT-подобный floating AI composer поверх интерфейса.
5. Исправить вход: убрать лишнее окно "Готовим контекст рабочего пространства", вернуть обычную авторизацию.
6. Уменьшить и упростить floating composer: белый, компактный, снизу, без selector рассуждения.
7. Переделать основной экран чата: убрать три колонки, контекст проекта, технические предупреждения; сделать читаемый чат.
8. Починить ActivePieces Canvas: убрать `Invalid Access`, сделать preflight/readiness, ускорить повторное открытие.
9. После повторных проблем провести полный аудит frontend/backend ActivePieces integration.
10. Исправить зависание Canvas через примерно 90 секунд после открытия.
11. Исправить зависание Canvas после сценария `Canvas -> Проекты -> Автоматизации`.
12. Зафиксировать все изменения в `main` и сделать push.
13. Подготовить подробный `.md` отчет по всем изменениям и исправлениям.

## 3. Runtime и запуск Stage 21

### Проблема

Проект запускался как старый Stage 17 runtime, хотя к этому моменту уже были выполнены Stage 18, Stage 19, Stage 20 и Stage 21. Из-за этого в UI появлялись устаревшие состояния, например "Сценарий автоматизации Stage 17", а поведение не соответствовало текущей ветке.

### Что сделано

Добавлен runtime script:

- `scripts/stage21-up.mjs`
- `scripts/stage21-up.test.mjs`

Скрипт поднимает текущий integrated runtime через существующий `docker-compose.stage17.local-integrated.yml`, но с Stage 21 переменными:

- `LEXFRAME_CONTRACTS_VERSION=stage21`
- `LEXFRAME_RELEASE_SHA=local-stage21`
- `LEXFRAME_RUNTIME_IMAGE_TAG=stage21-local`
- `NEXT_PUBLIC_CONTRACTS_VERSION=stage21`
- `ACTIVEPIECES_IMAGE_TAG=0.82.0`
- `ACTIVEPIECES_EMBED_SDK_VERSION=0.9.0`

Поддержанные команды:

- `up`
- `rebuild-web`
- `rebuild-backend`
- `restart-proxy`
- `reset-automation-runtime`
- `smoke-automation-runtime`
- `config`
- `ps`
- `logs`

### Почему так

Нужно было сохранить совместимость с уже существующим local-integrated окружением, но запускать актуальное состояние Stage 21. Поэтому runtime script переиспользует Stage 17 compose-файл и секреты, но задает новые Stage 21 переменные и ActivePieces версии.

## 4. Вход в приложение и route `/app`

### Проблема

После одного из изменений при открытии `/app` появлялся экран:

> Готовим контекст рабочего пространства. LexFrame проверяет сессию и права доступа...

Пользователь указал, что такой экран не запрашивался и ломает привычный вход. Ранее было окно авторизации с вводом пароля, организации и других данных.

### Что сделано

Изменена логика entry route:

- `/app` стал entry-redirect;
- если есть проект, пользователь направляется в проектный чат;
- если проектов нет, пользователь направляется на список проектов;
- лишний промежуточный экран проверки контекста убран из пользовательского потока.

Ключевые файлы:

- `apps/web/src/app/(app)/app/page.tsx`
- `apps/web/src/components/shell/app-entry-redirect.tsx`
- `apps/web/src/components/app-shell.tsx`

### Итог

Переход в приложение стал прямым: пользователь не видит дополнительный технический gate-screen, а попадает в рабочий интерфейс.

## 5. Sidebar: структура, навигация, проекты, чаты

### Исходные проблемы

По замечаниям пользователя:

- бренд был `Pravacontour`, нужно `LexFrame`;
- кнопки `Главная`, `Чаты`, `Проекты`, `Автоматизации` в старой верхней логике не соответствовали нужной структуре;
- `Главная` вообще не должна была существовать;
- в sidebar не хватало списка чатов;
- блок "Активный проект" был лишним;
- карточка проекта `Orlov & Partners 0 чатов / 1 автоматизаций` была лишней;
- `Инструменты` должны быть раскрываемым блоком;
- порядок инструментов должен быть: `Коннекторы`, `Пульс`, `Библиотека актов`;
- проекты должны отображаться компактным списком;
- `Автоматизации` должны оставаться отдельной кнопкой;
- иконка у заголовка/кнопки `Инструменты` выбивалась из общего дизайна.

### Что сделано

Sidebar переработан в `apps/web/src/components/shell/project-sidebar.tsx`.

Изменения:

- бренд заменен на `LexFrame`;
- удалена `Главная`;
- удалена подпись организации под брендом;
- удален footer-модуль "Активный проект";
- удален карточный вид активного проекта со счетчиками;
- добавлены быстрые действия:
  - `Новый чат`;
  - `Поиск в чатах`;
- добавлен блок `Чаты` до проектов;
- список чатов берется через существующий поиск чатов без фильтра по проекту;
- добавлен раскрываемый блок `Инструменты`;
- внутри инструментов порядок сделан таким:
  - `Коннекторы`;
  - `Пульс`;
  - `Библиотека актов`;
- добавлены placeholder-страницы:
  - `apps/web/src/app/(app)/app/connectors/page.tsx`;
  - `apps/web/src/app/(app)/app/pulse/page.tsx`;
- блок `Проекты` оставлен как:
  - `Все проекты`;
  - кнопка `+` / создать проект;
  - компактный список проектов вниз;
- блок `Автоматизации` оставлен отдельной кнопкой;
- иконка у строки `Инструменты` убрана, чтобы блок визуально соответствовал другим разделам.

### Проверки

Добавлены и обновлены тесты:

- `apps/web/src/components/shell/project-sidebar.test.tsx`
- `apps/web/src/components/app-shell.test.tsx`
- `apps/web/src/components/shell/projects-index.test.tsx`

Проверялось, что:

- `LexFrame` отображается;
- `Главная` отсутствует;
- `Orlov & Partners` не отображается в header как активная организация;
- "Активный проект" отсутствует;
- блоки идут в нужном порядке;
- `Инструменты` раскрываются;
- чаты и проекты рендерятся и ведут на нужные route.

## 6. Проекты: список, создание, API и миграция

### Проблема

Кнопка создания проекта была фактически заглушкой. Также `/app/projects` должен был стать настоящей страницей списка проектов.

### Что сделано

Frontend:

- добавлена страница `apps/web/src/app/(app)/app/projects/page.tsx`;
- добавлен компонент `apps/web/src/components/shell/projects-index.tsx`;
- добавлены тесты `apps/web/src/components/shell/projects-index.test.tsx`;
- добавлены hooks в `apps/web/src/hooks/domain/stage15.ts`;
- обновлены mocks в `apps/web/src/mocks/stage15-handlers.ts`.

Contracts/API client:

- `packages/contracts/src/stage15.ts`;
- `packages/api-client/src/stage15-client.ts`;
- `packages/api-client/src/index.ts`.

Backend:

- `apps/backend/src/modules/stage15-projects/stage15-projects.controller.ts`;
- `apps/backend/src/modules/stage15-projects/stage15-projects.service.ts`;
- `apps/backend/src/modules/stage15-projects/stage15-projects.service.spec.ts`.

DB:

- добавлена миграция `supabase/migrations/000054_stage21_projects_registry.sql`;
- добавлена таблица `app.projects`;
- сохранена совместимость default project `project_claim_001`, чтобы старые Stage 17-21 ссылки не ломались.

### Итог

`/app/projects` стал рабочим списком проектов, а создание проекта стало полноценной frontend/backend операцией.

## 7. Floating AI Composer

### Исходная реализация и замечания

Сначала был добавлен ChatGPT-подобный floating composer, но пользователь указал проблемы:

- черный фон не соответствует дизайн-коду LexFrame;
- элемент слишком большой;
- он расположен сверху, а должен быть снизу;
- selector "Продвинутое рассуждение" не нужен;
- видимый placeholder тоже не нужен.

### Что сделано

Компонент:

- `apps/web/src/components/shell/floating-ai-composer.tsx`
- тест: `apps/web/src/components/shell/floating-ai-composer.test.tsx`

Изменения:

- composer сделан белым через текущие CSS-токены проекта;
- размер уменьшен примерно на 50%;
- позиционирование переведено вниз;
- selector режима рассуждения удален;
- placeholder "Новый чат в проекте" убран из видимого UI;
- оставлены:
  - кнопка `+`;
  - поле ввода с `aria-label`;
  - mic icon;
  - кнопка отправки;
- глобальный composer отключается на chat routes, чтобы не было двух composer одновременно.

### Поведение

Submit из floating composer:

1. определяет project context по URL;
2. создает новый project chat;
3. отправляет первый prompt через streaming chat API;
4. ведет пользователя на `/app/projects/:projectId/chats/:chatId`.

## 8. Основной интерфейс чата

### Проблема

Старый chat workspace был трехколоночным и нечитаемым:

- слева был внутренний список тредов;
- по центру - предупреждение/рабочая область;
- справа - "Контекст проекта";
- присутствовали технические тексты вроде "Чат создан. История хранится в LexFrame DB";
- текст выглядел криво;
- пользователь не понимал, зачем нужен "Контекст проекта" внутри основного окна;
- история чатов уже должна была жить в sidebar.

### Что сделано

Переработаны компоненты:

- `apps/web/src/features/ai-chat/components/LexFrameChatShell.tsx`;
- `apps/web/src/features/ai-chat/components/LexFrameComposer.tsx`;
- `apps/web/src/features/ai-chat/components/LexFrameMessage.tsx`;
- `apps/web/src/features/ai-chat/components/LexFrameThread.tsx`;
- тест `apps/web/src/features/ai-chat/components/LexFrameChatShell.test.tsx`.

Изменения:

- убрана трехколоночная структура;
- убран внутренний список тредов;
- убран постоянный "Контекст проекта";
- убраны технические тексты про DB/history/route snapshots;
- новый чат отображает чистое состояние с вопросом `С чего начнем?`;
- активный чат отображает вертикальную ленту сообщений;
- сообщения пользователя и агента визуально различаются:
  - пользовательские сообщения выравниваются справа и имеют отдельный bubble style;
  - сообщения агента отображаются отдельным readable блоком/потоком;
- `white-space: pre-wrap` и читаемый line-height сохранены для ответов;
- локальный chat composer находится снизу;
- `Enter` отправляет сообщение, `Shift+Enter` переносит строку;
- running state показывает stop/cancel behavior;
- глобальный floating composer не дублируется на chat route.

### Итог

Чат стал ближе к ожидаемому паттерну ChatGPT/Gemini/Claude/Mistral: пустой чат с нижним prompt box и активный чат как последовательная лента сообщений.

## 9. ActivePieces Canvas: общий аудит интеграции

### Почему пришлось углубляться

Первые симптомы выглядели как проблема URL или binding, но дальнейший аудит показал, что нестабильность была многослойной:

- frontend слишком рано монтировал iframe;
- backend readiness был оптимистичным;
- версия SDK/runtime могла быть несовместима;
- iframe пересоздавался при плановом refresh;
- `Invalid Access` мог показываться прямо внутри ActivePieces;
- при уходе со страницы и возврате iframe мог зависать;
- websocket `/api/socket.io` нужно было проверять как часть runtime health.

### Ключевые зоны

Backend:

- `apps/backend/src/modules/activepieces/activepieces-canvas-readiness.service.ts`;
- `apps/backend/src/modules/activepieces/activepieces-session.service.ts`;
- `apps/backend/src/modules/activepieces/activepieces-flow-provisioning.service.ts`;
- `apps/backend/src/modules/activepieces/activepieces-canvas-provisioning.service.ts`;
- `apps/backend/src/modules/activepieces/activepieces-identity-bridge.ts`;
- `apps/backend/src/modules/activepieces/activepieces.controller.ts`;
- `apps/backend/src/modules/activepieces/activepieces.service.ts`;
- `apps/backend/src/modules/activepieces/activepieces.module.ts`.

Frontend:

- `apps/web/src/features/automation-canvas/use-activepieces-session.ts`;
- `apps/web/src/features/automation-canvas/activepieces-canvas-route.tsx`;
- `apps/web/src/features/automation-canvas/activepieces-canvas-wrapper.tsx`;
- `apps/web/src/components/shell/project-automations-landing.tsx`;
- `apps/web/src/lib/automation-canvas-route.ts`.

Contracts/API:

- `packages/contracts/src/domain.ts`;
- `packages/api-client/src/index.ts`.

Runtime/proxy:

- `infra/docker/docker-compose.stage17.local-integrated.yml`;
- `infra/docker/nginx.stage17.local-integrated.conf`;
- `scripts/stage21-up.mjs`.

## 10. ActivePieces Canvas: `Invalid Access` и missing binding

### Симптомы

Пользователь видел внутри Canvas raw ActivePieces ошибку:

> Invalid Access. You tried to access a project that you do not have access to.

Также появлялось controlled LexFrame состояние:

> FLOW_BINDING_MISSING

### Причины

Проблема была не только в URL. Нужно было проверять полный инвариант:

- существует ли workspace/project/automation в LexFrame;
- существует ли ActivePieces project;
- существует ли ActivePieces user;
- есть ли membership пользователя в ActivePieces project;
- существует ли ActivePieces flow;
- принадлежит ли flow ожидаемому ActivePieces project;
- есть ли flow version;
- соответствует ли runtime ActivePieces версии SDK;
- работает ли managed auth;
- доступен ли websocket/proxy.

### Что сделано

Добавлен `AutomationCanvasReadinessService`.

Readiness теперь проверяет до выдачи JWT:

- LexFrame project/automation;
- AP project;
- AP user;
- AP membership;
- AP flow;
- AP flow version;
- `flow.projectId`;
- runtime version;
- SDK version;
- websocket/proxy.

Если возможен безопасный repair, backend выполняет bounded repair:

- missing user;
- missing project;
- missing membership;
- missing/canonical flow binding.

Если обнаружен опасный mismatch, например flow принадлежит другому AP project, backend не выдает JWT молча, а блокирует с диагностикой.

### Новые/расширенные reason codes

Добавлены/использованы:

- `ACTIVEPIECES_VERSION_MISMATCH`
- `AP_PROJECT_MISSING`
- `AP_USER_MISSING`
- `AP_PROJECT_MEMBERSHIP_MISSING`
- `AP_FLOW_MISSING`
- `AP_FLOW_PROJECT_MISMATCH`
- `AP_MANAGED_AUTH_FAILED`
- `AP_WEBSOCKET_UNAVAILABLE`
- `AP_IFRAME_NAVIGATION_FAILED`
- `FLOW_BINDING_MISSING`

### Новые contract/API поля

В session/readiness response добавлены:

- `expectedRoute`;
- `refreshPolicy`;
- `openCheck`;
- `readinessVersion`;
- canonical ActivePieces ids.

### Новые endpoint'ы

Добавлен endpoint readiness:

```text
GET /projects/:projectId/automations/:automationId/canvas-readiness
```

Добавлен endpoint iframe health:

```text
POST /activepieces/session/:sessionId/iframe-health
```

Iframe health пишет audit events, но самовольно не чинит binding.

## 11. ActivePieces Canvas: несовместимость SDK/runtime

### Симптом

В ходе аудита был выявлен риск несовместимости:

- frontend использовал ActivePieces Embed SDK `0.9.0`;
- runtime должен быть ActivePieces `0.82.0`.

### Что сделано

В Stage 21 runtime закреплены:

- `ACTIVEPIECES_IMAGE_TAG=0.82.0`;
- `ACTIVEPIECES_EMBED_SDK_VERSION=0.9.0`.

ActivePieces app/worker запускаются на совместимом image tag.

### Где закреплено

- `scripts/stage21-up.mjs`;
- `infra/docker/docker-compose.stage17.local-integrated.yml`;
- `infra/docker/nginx.stage17.local-integrated.conf`.

## 12. ActivePieces Canvas: зависание через 90 секунд

### Симптом

Canvas открывался и был рабочим, но примерно через 90 секунд frontend делал:

- новый `canvas-readiness`;
- новый `POST /activepieces/session`;
- iframe `/embed` перезагружался;
- примерно к 105 секунде оставался на spinner.

### Причина

В `use-activepieces-session.ts` был foreground refresh по таймеру `expiresAt - 30s`. Для embedded ActivePieces это оказалось неправильной lifecycle-моделью: JWT нужен для первичной `configure()`, но здоровый iframe нельзя пересоздавать плановым refresh.

### Что сделано

В `apps/web/src/features/automation-canvas/use-activepieces-session.ts`:

- удален автоматический foreground refresh;
- операции разделены на:
  - `initial`;
  - `background_readiness`;
  - `recover`;
  - `retry`;
  - `invalid_access`;
- после `phase="available"` session/token не очищаются без реальной причины;
- background readiness не меняет UI state/session/token/container;
- deterministic idempotency key используется для initial open;
- добавлен memory cache session/JWT до expiry;
- session cache key строится как `workspaceId:projectId:automationId`.

В `activepieces-canvas-route.tsx`:

- убран refresh при смене темы;
- wrapper key стабилизирован по automation/flow;
- controlled recovery разрешен максимум один раз;
- повторная ошибка переводит UI в controlled LexFrame error.

В `activepieces-canvas-wrapper.tsx`:

- `configure()` и `navigate()` выполняются только при mount/recovery, а не при каждом обновлении props;
- readiness больше не считается по `visiblePayload.trim().length > 0`;
- CSS/style/script не считаются готовым Canvas;
- добавлен `CanvasHealthMonitor`.

### Проверка

Длинный browser smoke на 160 секунд показал:

- `createSessionCount: 1`;
- `readinessCount: 1`;
- `healthCount: 1`;
- на 20/95/160 секундах builder виден;
- `spinnerCount: 0`;
- iframe URL остается стабильным;
- `/api/socket.io` отвечает `101`, без постоянных `502`.

## 13. ActivePieces Canvas: зависание после `Canvas -> Проекты -> Автоматизации`

### Симптом

Пользователь указал новый сценарий:

1. нажать `Автоматизации`;
2. дождаться запуска Canvas;
3. перейти в `Проекты`;
4. снова перейти в `Автоматизации`;
5. появляется бесконечная загрузка.

### Воспроизведение

Headless test через прямой `page.goto()` сначала не воспроизвел проблему. После этого сценарий был проверен именно кликами по UI:

- открыть `/app/projects/project_claim_001/automations/f82b.../automation`;
- дождаться готового builder;
- кликнуть `Все проекты`;
- кликнуть `Автоматизации`;
- ждать 30-50 секунд.

Так баг воспроизвелся:

- после ухода на `/app/projects` iframe оставался жить в hidden DOM;
- пока iframe был скрыт, ActivePieces сам перезагружал `/embed`;
- iframe уходил в spinner;
- при возврате LexFrame вставлял обратно уже сломанный iframe и считал его готовым.

### Причина

Предыдущий оптимизационный механизм DOM parking был неверен для ActivePieces iframe. ActivePieces iframe нельзя надежно detached/reattached между route transitions. Он должен быть создан заново при возврате, даже если session/JWT кешируются.

### Что сделано

В `apps/web/src/features/automation-canvas/activepieces-canvas-wrapper.tsx`:

- удален `parkedCanvasHosts`;
- удален `parkCanvas`;
- удален `restoreParkedCanvas`;
- удален `useLayoutEffect`, который переносил iframe в hidden container;
- при route remount создается fresh iframe;
- session/JWT cache в hook остается, но DOM iframe не кешируется;
- health monitor и localization overlay ставятся только на реально смонтированный iframe.

В тестах:

- старый тест "parks the iframe..." заменен на тест, требующий fresh iframe на remount;
- проверяется, что `data-lexframe-canvas-parked` больше не появляется.

### Проверка

Browser smoke кликами после фикса:

- initial Canvas: builder виден, `spinnerCount: 0`;
- после клика `Все проекты`: `frameCount: 0`, iframe полностью исчезает;
- после клика `Автоматизации`: создается новый `/embed`;
- через 30 секунд builder виден, `spinnerCount: 0`;
- через 50 секунд builder виден, `spinnerCount: 0`.

## 14. Nginx/proxy и websocket

### Проблема

В логах ранее появлялись нестабильные `/api/socket.io` ответы, включая риск `502`. Для ActivePieces builder websocket важен, потому что realtime-часть может влиять на состояние Canvas.

### Что сделано

В runtime/proxy проверялось:

- websocket route `/api/socket.io`;
- proxy forwarding;
- compatibility ActivePieces runtime через nginx.

После исправлений в smoke-окнах проверялось:

- `/api/socket.io` отвечает `101`;
- постоянных `502` в проверочном окне нет.

## 15. Localization overlay ActivePieces

### Проблема

ActivePieces UI внутри iframe содержит собственные тексты, CSS, script/style nodes и иногда служебный текст. Агрессивный перевод DOM мог мешать readiness detection и создавать лишние мутации.

### Что сделано

В `activepieces-canvas-wrapper.tsx`:

- localization overlay стал best-effort;
- overlay ставится после readiness, а не до подтверждения готовности;
- mutation throttle увеличен до 500ms;
- `style`, `script`, `template`, `noscript`, hidden и aria-hidden элементы игнорируются;
- CSS-текст вроде `[data-sonner-toaster]...` больше не считается видимым payload;
- readiness требует реальный builder surface:
  - flow/canvas markers;
  - `react-flow`;
  - `Flow Builder`;
  - `Manual Trigger`;
  - `Publish`;
  - `Runs`;
  - `Versions`;
  - русские аналоги вроде `Сценар`, `Ручн`, `Запуск`.

## 16. Backend audit events

### Что добавлено

Backend теперь пишет события:

- `canvas.readiness.checked`;
- `canvas.readiness.repaired`;
- `canvas.session.blocked`;
- `canvas.iframe.ready`;
- `canvas.iframe.stuck_loading`;
- `canvas.iframe.invalid_access`;
- `canvas.iframe.recovered`.

Endpoint `iframe-health` валидирует:

- активный workspace;
- принадлежность session;
- expiry session;
- event type.

Он не выполняет repair самовольно. Его задача - дать backend-аудиту фактическое состояние iframe.

## 17. Тесты, которые были добавлены или обновлены

Backend:

- `apps/backend/src/modules/activepieces/activepieces-session.service.spec.ts`;
- `apps/backend/src/modules/activepieces/activepieces-flow-provisioning.service.spec.ts`;
- `apps/backend/src/modules/stage15-projects/stage15-projects.service.spec.ts`.

Frontend:

- `apps/web/src/components/app-shell.test.tsx`;
- `apps/web/src/components/shell/floating-ai-composer.test.tsx`;
- `apps/web/src/components/shell/project-sidebar.test.tsx`;
- `apps/web/src/components/shell/projects-index.test.tsx`;
- `apps/web/src/features/ai-chat/components/LexFrameChatShell.test.tsx`;
- `apps/web/src/features/automation-canvas/activepieces-canvas-wrapper.test.tsx`;
- `apps/web/src/features/automation-canvas/use-activepieces-session.test.tsx`.

Runtime:

- `scripts/stage21-up.test.mjs`.

## 18. Основные verification commands

В ходе работы выполнялись:

```powershell
corepack pnpm --filter @lexframe/web test -- activepieces-canvas-wrapper use-activepieces-session
corepack pnpm --filter @lexframe/backend test -- activepieces-session.service
corepack pnpm --filter @lexframe/contracts typecheck
corepack pnpm --filter @lexframe/web typecheck
corepack pnpm --filter @lexframe/backend typecheck
```

Также выполнялись browser smoke проверки через Playwright:

- прямое открытие Canvas на 160 секунд;
- сценарий `Canvas -> Все проекты -> Автоматизации`;
- проверка количества `/activepieces/session`;
- проверка `spinnerCount`;
- проверка текста builder внутри iframe;
- проверка nginx logs по `/api/socket.io`.

## 19. Итоговые результаты проверок

### 160-секундный Canvas smoke

Результат:

- Canvas открыт на `/app/projects/project_claim_001/automations/f82b5716-7aa7-4ad2-9fcc-f4b6799d7c38/automation`;
- за 160 секунд был только один первичный `POST /api/activepieces/session`;
- builder был виден на 20, 95 и 160 секундах;
- `spinnerCount: 0`;
- iframe не ушел в бесконечную загрузку.

### Smoke `Canvas -> Проекты -> Автоматизации`

Результат:

- initial builder виден;
- после перехода в проекты iframe полностью исчезает;
- после возврата в автоматизации создается новый iframe;
- через 30 секунд builder виден;
- через 50 секунд builder виден;
- `spinnerCount: 0`.

### Git/commit

Изменения зафиксированы:

```text
30c87d3 Стабилизирован интерфейс LexFrame Stage 21
```

Push выполнен:

```text
origin/main
```

Pre-commit secret check:

```text
Local secret safety check passed (staged files).
```

## 20. Измененные ключевые файлы

Ниже не полный diff, а группировка по смыслу.

### Runtime

- `scripts/stage21-up.mjs`
- `scripts/stage21-up.test.mjs`
- `package.json`
- `infra/docker/docker-compose.stage17.local-integrated.yml`
- `infra/docker/nginx.stage17.local-integrated.conf`

### Backend ActivePieces

- `apps/backend/src/modules/activepieces/activepieces-canvas-readiness.service.ts`
- `apps/backend/src/modules/activepieces/activepieces-canvas-provisioning.service.ts`
- `apps/backend/src/modules/activepieces/activepieces-flow-provisioning.service.ts`
- `apps/backend/src/modules/activepieces/activepieces-identity-bridge.ts`
- `apps/backend/src/modules/activepieces/activepieces-session.service.ts`
- `apps/backend/src/modules/activepieces/activepieces.controller.ts`
- `apps/backend/src/modules/activepieces/activepieces.module.ts`
- `apps/backend/src/modules/activepieces/activepieces.service.ts`

### Frontend ActivePieces

- `apps/web/src/features/automation-canvas/use-activepieces-session.ts`
- `apps/web/src/features/automation-canvas/activepieces-canvas-route.tsx`
- `apps/web/src/features/automation-canvas/activepieces-canvas-wrapper.tsx`
- `apps/web/src/components/shell/project-automations-landing.tsx`
- `apps/web/src/lib/automation-canvas-route.ts`

### Sidebar/AppShell/projects

- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/components/shell/project-sidebar.tsx`
- `apps/web/src/components/shell/projects-index.tsx`
- `apps/web/src/components/shell/app-entry-redirect.tsx`
- `apps/web/src/app/(app)/app/page.tsx`
- `apps/web/src/app/(app)/app/projects/page.tsx`
- `apps/web/src/app/(app)/app/connectors/page.tsx`
- `apps/web/src/app/(app)/app/pulse/page.tsx`

### Chat UI

- `apps/web/src/features/ai-chat/components/LexFrameChatShell.tsx`
- `apps/web/src/features/ai-chat/components/LexFrameComposer.tsx`
- `apps/web/src/features/ai-chat/components/LexFrameMessage.tsx`
- `apps/web/src/features/ai-chat/components/LexFrameThread.tsx`

### Projects API/contracts

- `apps/backend/src/modules/stage15-projects/stage15-projects.controller.ts`
- `apps/backend/src/modules/stage15-projects/stage15-projects.service.ts`
- `packages/contracts/src/stage15.ts`
- `packages/contracts/src/domain.ts`
- `packages/api-client/src/index.ts`
- `packages/api-client/src/stage15-client.ts`
- `supabase/migrations/000054_stage21_projects_registry.sql`

## 21. Что важно помнить дальше

1. ActivePieces остается embedded iframe, а не собственным редактором LexFrame.
2. JWT нужен для первичной настройки embed, но здоровый iframe нельзя пересоздавать плановым refresh.
3. DOM parking iframe для ActivePieces использовать нельзя: после detach/reattach iframe может уйти в spinner.
4. При route remount лучше создавать fresh iframe, переиспользуя session/JWT cache только на уровне данных.
5. Raw ActivePieces ошибки не должны попадать пользователю напрямую; LexFrame должен показывать controlled states.
6. Localization внутри ActivePieces должна быть best-effort и не должна агрессивно мутировать DOM.
7. Websocket `/api/socket.io` нужно держать в runtime smoke checks, потому что Canvas зависит от realtime-части ActivePieces.
8. `project_claim_001` остается compatibility default project для старых ссылок Stage 17-21.

## 22. Оставшиеся потенциальные улучшения

Это не блокеры, но их можно рассмотреть отдельно:

- уменьшить количество повторных `canvas-readiness` при переходе через automation landing;
- добавить отдельный визуальный статус "Canvas восстанавливается" только для controlled recovery;
- добавить browser e2e test в постоянный CI для сценария `Canvas -> Проекты -> Автоматизации`;
- вынести Playwright smoke для ActivePieces в отдельный npm script;
- расширить diagnostics UI для readiness checks, чтобы админ видел конкретный failed check;
- постепенно заменить best-effort DOM localization на официальный i18n/runtime-level подход, если ActivePieces позволит.

