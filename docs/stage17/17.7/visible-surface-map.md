# Stage 17.7 Visible Surface Map

## LexFrame

- Automation button opens `/automation` route.
- Session state, unavailable state, diagnostics and tabs are Russian.
- JWT is stored only in `tokenRef` memory state and removed after SDK configure.
- The embedded Canvas wrapper exposes `aria-label="Конструктор автоматизаций"`.

## Activepieces Embedded Canvas

- SDK receives `embedding.locale: "ru"`.
- Embed route also resolves locale through `resolveActivepiecesLocale()`.
- Document title and theme website name are white-labelled.
- Builder, inspector, connections, runs/debug, settings, navigation and dashboard controls remain enabled.

## Allowed English Tokens

Technical tokens may remain where they are user-relevant: `HTTP`, `API`, `JSON`, `OAuth`, `JWT`, `Webhook`, `ID`, package names and developer diagnostics.
