# Activepieces License Boundary

Status: BLOCKED pending legal/license sign-off
Date: 2026-04-28

## Observed License Files

- `E:\activepieces-main\LICENSE`
- `E:\activepieces-main\packages\ee\LICENSE`

The root license states that content outside the enterprise directories is under
MIT Expat, while content under `packages/ee/` and
`packages/server/api/src/app/ee` is governed by the enterprise license file.
The enterprise license restricts production use and redistribution without a
valid Activepieces Enterprise license or applicable agreement.

## Enterprise Paths Observed

- `packages/ee`
- `packages/ee/embed-sdk`
- `packages/server/api/src/app/ee`
- Notable `packages/server/api/src/app/ee` areas include API keys, audit logs,
  authentication, connection keys, custom domains, global connections,
  license keys, managed authn, OAuth apps, platform, SCIM, secret managers,
  signing key, templates, and users.

Full path evidence is in
`artifacts/stage17.1/inventories/activepieces-source-files-sanitized.txt`.

## Decision

- Do not copy, import, port, bundle, or depend on code/assets/components from
  `packages/ee` or `packages/server/api/src/app/ee` unless legal/license
  review explicitly approves it.
- Do not use paid/enterprise-only embedding, white-label, predefined/global
  connections, platform admin, or API-key features as required MVP behavior
  until the license decision is recorded.
- Preserve legal notices and third-party attribution. Debranding may remove
  user-facing product strings where allowed, but must not remove license notices.
- For MVP planning, prefer MIT/core surfaces and LexFrame-owned wrapper/proxy
  behavior over importing enterprise code.

## Blockers

- Activepieces checkout lacks git metadata, so license findings cannot be tied
  to a precise upstream commit.
- Legal/license reviewer sign-off is pending.
- Embed Builder paid-edition risk is unresolved and must be decided before
  17.2/17.5/17.7 implementation relies on it.
