# ADR-17.2 - Activepieces-Like LexFrame Design Unification

Status: Accepted for Stage 17 design; frontend/design sign-off pending before PASS
Date: 2026-04-28
Owners: product, technical, frontend/design

## Context

Stage 17 makes Activepieces Canvas the primary MVP editor. Without visual
alignment, users would move between two unrelated product surfaces. The goal is
to reduce that visual break while preserving LexFrame legal domain behavior.

## Decision

LexFrame UI will move toward an Activepieces-like visual system in later Stage
17 work. Activepieces Canvas stock layout, functions, menu order, inspector,
runs/debug, settings, and builder mechanics are not redesigned as part of
design convergence.

LexFrame may adopt AP-like tokens and patterns for AppShell, cards, buttons,
forms, tables, panels, badges, status states, loading states, empty states, and
automation surfaces after 17.1 PASS.

## Consequences

- 17.8 must start from AP token inventory, LexFrame UI inventory, screenshots,
  accessibility checklist, and visual regression target.
- Design migration must preserve LexFrame legal labels, RBAC, documents, audit,
  AI Gateway, approvals, and product DB source of truth.
- Enterprise-only AP code/assets cannot be copied without ADR-17.3 sign-off.

## Non-Goals

- No Activepieces Canvas layout/function changes.
- No feature removal during debranding.
- No new UX features outside the freeze.
- No design implementation during 17.1.

## Evidence

- `activepieces-design-token-inventory.md`
- `lexframe-ui-design-inventory.md`
- `artifacts/stage17.1/screenshots/lexframe/`
