# ADR-17.3 - Activepieces License Boundary

Status: Conditionally Accepted; legal/license sign-off required before PASS
Date: 2026-04-28
Owners: technical, legal/license

## Context

Stage 17 may touch embedding, white-label, i18n, design patterns, and runtime
integration. Activepieces source includes MIT-covered areas and enterprise
areas under separate license terms.

## Decision

Stage 17 implementation must not copy, import, bundle, or depend on code,
components, or assets from `packages/ee` or
`packages/server/api/src/app/ee` unless legal/license review explicitly
approves it. Paid/enterprise-only features must not be required for MVP unless
the license decision is accepted.

## Consequences

- Use MIT/core surfaces where possible.
- Preserve notices and attribution.
- Treat Embed Builder paid-edition dependency as unresolved until legal/product
  decision.
- Keep white-label/debranding separate from license notice removal.

## Non-Goals

- This ADR does not grant permission to use enterprise code.
- This ADR does not decide commercial licensing.
- This ADR does not authorize removing legal notices.

## Evidence

- `activepieces-license-boundary.md`
- `artifacts/stage17.1/inventories/activepieces-source-files-sanitized.txt`
