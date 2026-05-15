# Clickability Matrix

| Route | Component | Control | Selector/Role | Expected Outcome | Test File | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/app/projects` | AppShell | ordinary shell panel | `data-testid=app-shell-panel` | rounded panel shell renders | `frontend-route-smoke.spec.ts` | Covered | visual classes not asserted beyond marker |
| `/app/projects` | ProjectSidebar | collapse | role button `Свернуть меню` | rail appears | `frontend-visual-invariants.spec.ts` | Covered | screenshot evidence |
| `/app/projects` | ProjectSidebar | settings | `data-testid=settings-entry-point` | settings dialog opens | `frontend-sidebar-settings.spec.ts` | Covered | expanded and collapsed |
| `/app/projects` | ProjectSidebar | theme toggle | role button `/Включить .* тему/` | `html[data-theme]` changes | `frontend-sidebar-settings.spec.ts` | Covered | no design token edits |
| `/app/projects` | ProjectSidebar | sign out | role button `Выйти` | visible/reachable | `frontend-sidebar-settings.spec.ts`, `project-sidebar.test.tsx` | Covered | e2e does not sign out |
| `/app/projects` | ProjectSidebar | search | role button `Поиск в чатах`, `#sidebar-chat-search` | search panel opens and accepts query | `frontend-shell-clickability.spec.ts` | Covered | Escape close is a defect/gap |
| `/app/projects` | ProjectSidebar | tools accordion | role button `Инструменты` | connector/pulse/sources links visible | `frontend-shell-clickability.spec.ts` | Covered | link click not forced |
| `/app/projects` | ProjectSidebar | create project blank | role button `Создать проект` submit | disabled while blank | `frontend-shell-clickability.spec.ts`, `project-sidebar.test.tsx` | Covered | visible disabled reason missing |
| `/app/projects` | ProjectSidebar | create project valid | placeholder `Например, новый спор` | navigates to new project route | `frontend-shell-clickability.spec.ts`, `project-sidebar.test.tsx` | Covered | MSW/backend dependent |
| `/app/projects/:projectId` | ProjectHome | project tabs | role tab `Чаты` | chats tab selected | `project-home.test.tsx` | Covered | existing |
| `/app/projects/:projectId` | ProjectHome | sources tab | role tab `Источники` | sources tab selected | `frontend-shell-clickability.spec.ts` | Covered | |
| `/app/projects/:projectId` | ProjectHome | automations tab | role tab `Автоматизации` | automations tab selected | `frontend-shell-clickability.spec.ts` | Covered | |
| `/app/projects/:projectId` | ProjectHome | add context | role button `Добавить контекст` | plus menu opens | `frontend-shell-clickability.spec.ts`, `project-home.test.tsx` | Covered | |
| `/app/projects/:projectId` | ProjectHome | plus menu photo | role button `Добавить фото` | file picker action reachable | `frontend-shell-clickability.spec.ts` | Covered | no file chooser forced |
| `/app/projects/:projectId` | ProjectHome | plus menu files | role button `Фото или файлы` | file picker action reachable | `frontend-shell-clickability.spec.ts` | Covered | |
| `/app/projects/:projectId` | ProjectHome | plus menu web search | role button `Поиск по сети` | web search panel opens | `project-home.test.tsx` | Covered | backend call covered in unit |
| `/app/projects/:projectId` | ProjectHome | plus menu automation | role button `Автоматизации` | automation picker opens | `project-home.test.tsx` | Covered | |
| `/app/projects/:projectId` | ProjectHome | rename project | role button `/Переименовать проект/` | inline form opens | `frontend-keyboard-accessibility.spec.ts`, `project-home.test.tsx` | Covered | Enter/Escape |
| `/app/projects/:projectId/chats` | LexFrameChatShell | composer input | `data-testid=chat-composer-input` | visible and route ready | `frontend-route-smoke.spec.ts` | Covered | |
| `/app/projects/:projectId/chats/:chatId` | LexFrameChatShell | composer input | `data-testid=chat-composer-input` | visible and route ready | `frontend-route-smoke.spec.ts`, `frontend-visual-invariants.spec.ts` | Covered | |
| `/chat` | LexFrameChatShell | global composer | `data-testid=chat-composer-input` | visible; no project chat text leak | `frontend-route-smoke.spec.ts` | Covered | |
| `/chat/:chatId` | LexFrameChatShell | created global chat route | URL `/chat/:id` | opens created thread | `frontend-route-smoke.spec.ts` | Covered | API setup |
| `/documents` | Documents | route shell | body text `/documents|Document/` | route opens without overlay | `frontend-route-smoke.spec.ts`, `frontend-visual-invariants.spec.ts` | Covered | |
| `/sources` | Sources | route shell | body text `/sources|Source/` | route opens without overlay | `frontend-route-smoke.spec.ts`, `frontend-visual-invariants.spec.ts` | Covered | |
| `/app/projects/:projectId/automations` | ProjectAutomationsLanding | readiness/degraded route | body or canvas/degraded marker | route opens and screenshot captured | `frontend-route-smoke.spec.ts`, `frontend-visual-invariants.spec.ts` | Covered | runtime-dependent |
| settings dialog | SettingsShell | profile tab | `data-testid=settings-tab-profile` | profile form visible | `settings-shell.test.tsx` | Covered | |
| settings dialog | SettingsShell | organization tab | `data-testid=settings-tab-organization` | org form visible/read-only for non-admin | `settings-shell.test.tsx`, `frontend-sidebar-settings.spec.ts` | Covered | |
| settings dialog | SettingsShell | AI tab | `data-testid=settings-tab-ai` | AI model cards visible | `settings-shell.test.tsx`, `frontend-sidebar-settings.spec.ts` | Covered | |
| settings dialog | SettingsShell | diagnostics tab | `data-testid=settings-tab-diagnostics` | policy JSON visible without secrets | `settings-shell.test.tsx` | Covered | |
| settings dialog | SettingsShell | save | `data-testid=settings-save-button` | profile/org mutation called | `settings-shell.test.tsx` | Covered | |
| settings dialog | SettingsShell | API key field | label `/API key/` | typed secret not rendered in visible DOM/storage | `frontend-sidebar-settings.spec.ts`, settings unit tests | Covered | password input still holds value while editing |
| settings dialog | SettingsDialog | Escape | keyboard `Escape` | dialog closes | `settings-button.test.tsx`, `frontend-sidebar-settings.spec.ts` | Covered | |
| settings dialog | SettingsDialog | Tab | keyboard `Tab` | focus remains inside dialog | `SettingsDialog` behavior | Partial | implemented, no exhaustive e2e trap loop |
| all critical routes | Shell | blocking overlay | `elementFromPoint` guard | no stale modal/menu blocks center clicks | `frontend-route-smoke.spec.ts` | Covered | |
| all immersive chat routes | Shell | duplicate composers | `floating-ai-composer`, `chat-composer-input` | at most one visible shell composer | e2e helpers + route smoke | Covered | |
| project root | Visual invariant | old dashboard fragments | visible text scan | removed dashboard fragments absent | route/clickability/visual specs | Covered | |
