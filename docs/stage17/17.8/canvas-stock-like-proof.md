# 17.8 Activepieces Canvas Stock-like Proof

Status: STATIC GUARDAIL IMPLEMENTED / LIVE CONTROL CHECK PENDING
Date: 2026-04-28

## Implemented Guardrail

17.8 changed only the LexFrame route wrapper styling around the embedded
Activepieces Canvas. The wrapper still passes through the existing Stage 17
session/embed configuration and does not restyle internal Activepieces DOM.

The static gate fails if the wrapper introduces known stock-like drift flags:

- `hideFlowName: true`
- `disableNavigation: true`
- `hideExportAndImportFlow: true`

## Pending Live Evidence

Before PASS, capture a live Canvas screenshot and locator checks for:

- builder header
- palette
- inspector
- connections/settings
- runs/debug
- create/open/edit simple flow, if permissions allow
