# Stage 17.7 Branding Inventory

## User-Facing Brand Payload

- `short_name`: `Автоматизация`
- `long_name`: `Конструктор автоматизаций`
- `document_title`: `Конструктор автоматизаций`
- `logo_alt`: `Автоматизация`
- `aria_label`: `Конструктор автоматизаций`

## White-Label Surfaces

- LexFrame session response includes `brand` and legacy `brand_display_name`.
- LexFrame wrapper sets `document.title` from `brand.documentTitle`.
- LexFrame wrapper applies `aria-label` from `brand.ariaLabel`.
- Activepieces default theme uses `websiteName: "Автоматизация"`.
- Activepieces default logo and favicon point to `/lexframe-automation-logo.svg` and `/lexframe-automation-icon.svg`.
- Activepieces HTML root uses `lang="ru"`.

## Preserved Internal Identifiers

Internal package names, imports, database identifiers, route names, enum codes and license text are not renamed.
