# Frontend Clickability Inventory

Scope: Block 2 covers the web shell, route navigation, settings entry, project sidebar, route layout and visual invariants. Visual recipes/classes/tokens were not changed; only tests, helpers, docs and accessibility/testability behavior were added.

## Route Inventory

| Route | Route family | Shell mode | Ready marker | Existing coverage | New Block 2 coverage |
| --- | --- | --- | --- | --- | --- |
| `/` | public entry | unauth/app redirect | body | smoke only | documented for route map; not clicked as app shell |
| `/dashboard` | app dashboard | ordinary panel | `app-shell-panel` | stage smoke | route family documented |
| `/app` | app entry | ordinary or redirect | body/app shell | stage smoke | route family documented |
| `/app/projects` | project index | ordinary panel | `app-shell-panel` | `projects-index.test.tsx` | route smoke, sidebar clickability, visual screenshot |
| `/app/projects/:projectId` | project workspace | immersive project | `project-workspace-shell` | `project-home.test.tsx`, `app-shell.test.tsx` | route smoke, clickability, keyboard rename, visual screenshot |
| `/app/projects/:projectId/chats` | project chat workspace | immersive chat | `chat-composer-input` | chat shell tests, stage19 e2e | route smoke, h-screen/body invariant |
| `/app/projects/:projectId/chats/:chatId` | project chat thread | immersive chat | `chat-composer-input` | chat shell tests, stage19 e2e | route smoke, visual screenshot |
| `/chat` | global chat workspace | immersive chat | `chat-composer-input` | partial sidebar global chat unit | route smoke, visual screenshot |
| `/chat/:chatId` | global chat thread | immersive chat | `chat-composer-input` | partial live smoke | route smoke with created thread |
| `/app/projects/:projectId/automations` | project automations landing | ordinary/degraded redirect | body or canvas redirect | `project-automations-landing.test.tsx`, stage17 e2e | route smoke, visual screenshot |
| `/app/projects/:projectId/automations/:automationId/automation` | automation canvas | bounded canvas | `activepieces-canvas-container` or `builder-unavailable-state` | stage17 activepieces e2e | helper support and AppShell unit coverage |
| `/documents` | documents root | ordinary panel | body text/documents | document component tests | route smoke, visual screenshot |
| `/documents/:id` | document detail | ordinary panel | body/document detail | stage2 storage e2e | route family documented |
| `/sources` | sources root | ordinary panel | body text/sources | legal source component tests | route smoke, visual screenshot |
| `/sources/:id` | source detail | ordinary panel | body/source detail | legal source tests | route family documented |
| settings dialog | modal shell | dialog overlay | role `dialog`, `settings-tab-*` | settings component tests | sidebar/settings e2e, SettingsShell unit |
| `/app/settings` | settings page fallback | ordinary panel | settings heading | settings components | SettingsShell unit route-query behavior |
| `/app/runs/:runId`, `/runs/:runId` | run detail | ordinary panel | run body | run/stage e2e | route family documented |

## Key Components

| Component | Current role | Covered by |
| --- | --- | --- |
| `AppShell` | selects ordinary panel vs immersive route shell, clears Activepieces browser tokens | `apps/web/src/components/app-shell.test.tsx`, route smoke |
| `ProjectSidebar` | shell navigation, chat history scope, project actions, settings/theme/sign out | `apps/web/src/components/shell/project-sidebar.test.tsx`, sidebar/settings e2e |
| `SettingsButton` | shared settings dialog trigger in expanded/collapsed sidebar | `settings-button.test.tsx`, sidebar/settings e2e |
| `SettingsShell` | profile/org/AI/diagnostics tabs | `settings-shell.test.tsx`, sidebar/settings e2e |
| `ProjectHome` | project immersive root, tabs, composer, plus menu | `project-home.test.tsx`, clickability/visual e2e |
| global chat workspace | global `LexFrameChatShell` | route smoke, keyboard e2e |
| project chat shell | project `LexFrameChatShell` | route smoke, stage19 e2e |
| upload dialog | document upload behavior | existing upload tests; route inventory only |
| automation canvas route | Activepieces embedded builder or degraded state | stage17 e2e, visual helper support |

## Primary Controls

| Control | Selector / role | Route | Expected visible outcome | Expected API/network outcome | State |
| --- | --- | --- | --- | --- | --- |
| Sidebar collapse | role button `Свернуть меню` | ordinary/project routes | rail replaces expanded sidebar | none | covered |
| Sidebar expand/preview | role button `Открыть меню` / `Развернуть меню` | collapsed rail | preview or expanded sidebar appears | none | unit covered |
| New chat | role button `Новый чат` | `/chat`, project chat routes | navigates to created chat | `POST /chat/threads` or `POST /projects/:id/chats` | unit/e2e covered |
| Search | role button `Поиск в чатах`, `#sidebar-chat-search` | shell routes | search panel opens | `GET /chat/search` on submit | covered |
| Project create | role button `Создать проект`, placeholder `Например, новый спор` | `/app/projects` | disabled when blank, navigates after valid submit | `POST /projects` | covered |
| Project open | role link by project name | sidebar/project index | route changes to project | none | covered by route smoke |
| Project rename | role button `/Переименовать проект/`, textbox `Название проекта` | project root/sidebar | inline input, Enter save, Escape cancel | `PATCH /projects/:id` | unit/e2e covered |
| Chat open | role link by chat title | sidebar/project root | route changes to chat thread | none | covered |
| Chat rename | role button `/Переименовать чат/`, textbox `Название чата` | sidebar chat list | inline input, Enter save, Escape cancel | `PATCH /chat/threads/:id` | unit covered |
| Tools accordion | role button `Инструменты` | sidebar | connector/pulse/sources links appear | none | covered |
| Settings | `data-testid=settings-entry-point`, role button `Настройки` | expanded/collapsed sidebar | dialog opens | `GET /settings/bootstrap` | covered |
| Theme toggle | role button `/Включить .* тему/` | sidebar | `html[data-theme]` changes | local storage update | covered |
| Sign out | role button `Выйти` | sidebar | reachable; e2e does not click | sign-out only in unit mock | covered |
| Project tabs | role tab `Чаты`, `Источники`, `Автоматизации` | project root | active tab changes | project data queries already loaded | covered |
| Composer add context | role button `Добавить контекст` | project root | plus menu opens | none until selection | covered |
| Composer attachment | role buttons `Добавить файлы`, `Добавить фото`, file inputs | chat/project composer | file picker opens; validation in component tests | upload intent later | documented |
| Composer send | role button `Отправить сообщение` | chat/project root | disabled until input/context, then sends | chat create/stream endpoints | covered by existing chat/project tests |
| Automation links | role link automation title | project automations/project root | opens automation canvas route | canvas readiness/session endpoints | covered by route smoke/stage tests |

## Coverage Classification

Unit/component:
- `AppShell`: ordinary vs immersive shell, token clearing/preservation, composer visibility on project/global chat.
- `ProjectSidebar`: global vs project history isolation, order, tools accordion, collapsed preview, create project, rename, settings/theme/sign out reachability.
- `SettingsShell` and settings subcomponents: tabs, profile save, org read-only, AI key metadata/write-only behavior.
- UI primitives: Button disabled/asChild/localized names, Tabs keyboard activation, Dialog accessible name.

Integration/E2E:
- `frontend-route-smoke.spec.ts`: critical route families, hydration/console guard, blocking overlay guard, shell composer duplication guard.
- `frontend-shell-clickability.spec.ts`: project tabs, plus menu, sidebar search/tools/project create.
- `frontend-sidebar-settings.spec.ts`: settings from expanded/collapsed sidebar, AI key DOM/storage safety, theme toggle.
- `frontend-keyboard-accessibility.spec.ts`: tab focus, Enter activation, settings Escape, project rename keyboard.
- `frontend-visual-invariants.spec.ts`: screenshot evidence and layout invariants.

Smoke-only:
- `/`, `/dashboard`, detail document/source/run routes are inventoried but not fully clicked in Block 2.
- Automation canvas deep route depends on runtime readiness and remains covered by existing stage17 live/degraded tests plus helper support.

## Gates

Root scripts added:
- `test:block2:web-unit`
- `test:block2:e2e`
- `test:block2`

Recommended focused commands:
- `corepack pnpm --filter @lexframe/web test -- app-shell project-sidebar settings project-home ui-primitives`
- `corepack pnpm --filter @lexframe/web typecheck`
- `corepack pnpm --filter @lexframe/web lint`
- `corepack pnpm --filter @lexframe/e2e typecheck`
- `corepack pnpm --filter @lexframe/e2e test frontend-shell-clickability.spec.ts frontend-sidebar-settings.spec.ts frontend-route-smoke.spec.ts frontend-keyboard-accessibility.spec.ts frontend-visual-invariants.spec.ts`

## Risks And Gaps

- Automation canvas currently still allows the floating composer on canvas routes. This is recorded as a defect because changing it would alter visible route behavior.
- Sidebar disabled controls expose native disabled state, but not every disabled state has a visible reason.
- Browser screenshot evidence is generated by Playwright into `artifacts/system-tests/block2-frontend/screenshots/`; CI should not auto-update these as visual baselines.
- Local Playwright execution requires an integrated backend DB. In this workspace, PostgreSQL on `127.0.0.1:54322` was not running, so the full e2e suite failed after partial evidence capture.
