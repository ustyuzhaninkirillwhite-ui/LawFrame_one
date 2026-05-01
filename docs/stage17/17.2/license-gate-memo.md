# License Gate Memo

Status: Pending legal/license decision
Date: 2026-04-28

## Gate

Activepieces Provision Users and Embed Builder may be paid-edition features.
The Stage 17 MVP cannot claim seamless no-login production readiness until the
edition/license decision is recorded.

## Current Findings

- Stage 17.1 found `E:\activepieces-main` but it lacked git metadata.
- Stage 17.1 observed local source as `activepieces@0.82.0`.
- Current `compose.yaml` uses `activepieces/activepieces:0.44.0`.
- Enterprise paths such as `packages/ee` and
  `packages/server/api/src/app/ee` remain blocked unless legal/license review
  approves their use.

## Decision Rule

- If official embed/provisioning is licensed and available, Stage 17 can mount
  AP builder through official iframe/SDK with backend-signed JWT.
- If it is not licensed or unavailable, `/activepieces/session` must return a
  structured unavailable/license-gate result. Reverse proxy alone is not a
  replacement for official seamless auth.
- Debranding does not remove license notices or third-party attribution.

## Required Evidence

- License/edition decision signed by product and legal/license owner.
- Activepieces source/runtime version pinned to a git commit or immutable image.
- Explicit approval before copying, importing, bundling or depending on any
  enterprise-only AP code/assets/components.
