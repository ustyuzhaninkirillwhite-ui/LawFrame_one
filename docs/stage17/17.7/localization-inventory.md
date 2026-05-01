# Stage 17.7 Localization Inventory

## Scope

- LexFrame session API: `POST /api/activepieces/session`.
- LexFrame Canvas route: `apps/web/src/features/automation-canvas`.
- Activepieces web locale: `E:/activepieces-main/packages/web/public/locales/ru/translation.json`.
- Activepieces forced resolver: `E:/activepieces-main/packages/web/src/lib/lexframe-locale-resolver.ts`.
- Embed route fallback: `E:/activepieces-main/packages/web/src/app/routes/embed/index.tsx`.

## Dictionary

- Flow / Automation: `Автоматизация`
- Builder: `Конструктор`
- Run: `Запуск`
- Connection: `Подключение`
- Settings: `Настройки`
- Debug: `Диагностика`
- Piece: `Модуль`

## Coverage Shape

- Locale: `ru`
- Base locale source: Activepieces `en/translation.json`
- Required parity: same key set, no missing keys, no empty values
- Runtime fallback policy: `resolveActivepiecesLocale()` returns `ru` before browser locale, localStorage and user settings.
