# 17.8 Accessibility Report

Status: STATIC UI CONTRACT IMPLEMENTED / LIVE AXE RUN PENDING
Date: 2026-04-28

## Implemented Controls

- Bridge recipes include visible `focus-visible` rings.
- Button, input, textarea, select, tabs, dialog, sheet, dropdown, tooltip and
  toast wrappers use semantic roles or native elements.
- Disabled controls retain a shared opacity token.
- Badge and status recipes avoid hue-only selected state by using borders and
  surfaces.

## Pending Live Evidence

Run the visual/a11y Playwright spec with `LEXFRAME_STAGE17_17_8_VISUAL=1`.
Formal PASS requires:

- zero critical/serious axe violations on migrated routes;
- visible keyboard focus across shell, forms, cards and tabs;
- AP Canvas wrapper has a meaningful label and fallback state;
- focus is not hidden by sticky headers or overlays.
