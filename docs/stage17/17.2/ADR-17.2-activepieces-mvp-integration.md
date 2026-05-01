# ADR-17.2 - Activepieces MVP Integration Architecture

Status: Draft implemented; owner sign-off pending
Date: 2026-04-28
Owners: product, technical, security, legal/license, frontend/design

## Context

Stage 17 makes Activepieces Canvas the primary MVP automation editor. LexFrame
already contains Stage 4 and Stage 16 integration primitives: an
`ActivepiecesModule`, legacy `/activepieces/embed-token`, runtime bindings,
runtime snapshots, an Activepieces bridge package and iframe wrapper.

Stage 17.2 must formalize the bridge without moving canonical product state out
of LexFrame.

## Decision

LexFrame opens Activepieces through a route-level wrapper and session bridge:

1. User clicks `Автоматизация` in LexFrame.
2. Frontend opens `/app/projects/:projectId/automations/:automationId/automation`.
3. Frontend requests `POST /api/activepieces/session`; in the current Nest app
   the physical route is `POST /activepieces/session`, while `/api` is an
   edge/proxy prefix.
4. Backend authenticates LexFrame user, checks workspace/RBAC/feature gates,
   ensures AP project/user/flow bindings, stores only token hashes and issues a
   short-lived provisioning JWT.
5. Frontend mounts AP under `/automation-runtime/*` using memory-only token
   handling.
6. LexFrame receives AP snapshots, run events, reconciliation metadata and
   audit events without treating AP DB as canonical.

The legacy `/activepieces/embed-token` endpoint remains supported during the
migration. The Stage 17 session endpoint is the primary API for the MVP Canvas.

## Source Of Truth

LexFrame DB remains canonical for workspaces, users, automations, Canvas/DSL,
runs, approvals, documents, audit, permissions, security decisions and future
migration metadata. Activepieces project, user, flow, flow version and run ids
are external runtime references.

## Consequences

- `app.automation_runtime_bindings` remains the flow-binding table; do not add a
  duplicate `activepieces_flow_bindings` table.
- `app.activepieces_flow_snapshots` stores read-back evidence and drift hashes,
  but snapshots are not automatically promoted into LexFrame DSL.
- Browser code receives only short-lived provisioning JWTs and never receives AP
  API keys, signing private keys, provider API keys or Supabase service keys.
- AP Canvas stock layout/functions are not redesigned. Localization,
  debranding and technical glue may be added in later Stage 17 work subject to
  license boundaries.

## Non-Goals

- No direct AP login/signup/password reset in the user MVP path.
- No copying from Activepieces enterprise-only directories without legal
  approval.
- No direct provider-key use inside AP pieces; AI steps call LexFrame AI Gateway
  with scoped runtime tokens.
- No claim of seamless no-login PASS before the license/edition gate is closed.
