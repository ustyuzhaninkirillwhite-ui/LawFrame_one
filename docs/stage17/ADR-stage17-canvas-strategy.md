# ADR: Stage 17 Canvas Strategy

Status: Accepted

## Context

Stage 17.10-17.11 made the automation workspace open a real embedded Activepieces Canvas inside the LexFrame shell. LexFrame backend and product DB remain the source of truth for workspaces, users, roles, automations, workflow runs, documents, audit, recommendations, permissions and security.

Stage 15 and Stage 16 describe a long-term simplified LexFrame Canvas around legal actions and LexFrame Workflow DSL. That remains strategically valid, but it is not the Stage 17.12 task.

## Decision

On the MVP period, the primary Canvas mode in LexFrame opens embedded Activepieces Canvas. This is a temporary MVP solution.

The long-term architecture target is a proprietary simplified LexFrame Canvas built around legal actions and LexFrame Workflow DSL. Stage 17.12 does not implement that future Canvas and does not expand Stage 16 scope.

Activepieces flow state remains a runtime/builder projection. LexFrame backend/product DB remains the product source of truth. The old LexFrame canvas must not return as the main route and must not be used as a fallback.

## Consequences

- `/automation` remains the canonical MVP editor route.
- Workspace-scoped ensure/provisioning remains required before opening the builder.
- `/api/activepieces/session` remains the only frontend path to obtain short-lived builder session data.
- Frontend never receives Activepieces API key, signing private key, Supabase service role, Local Owner Key Vault values or AI provider keys.
- Any return to a LexFrame-owned simplified Canvas requires a separate Stage 16+ product/architecture decision.

## Non-Goals

- Build the future LexFrame simplified Canvas.
- Replace Activepieces Canvas layout or builder mechanics.
- Treat Activepieces as source of truth.
- Use enterprise/ee code or assets without a license decision.

## Revisit Criteria

- Stage 16+ explicitly approves LexFrame Workflow DSL Canvas implementation.
- Product needs require legal-action-first authoring rather than raw pieces authoring.
- Activepieces embedding/license boundary changes.
- Security policy requires removing embedded third-party builder surfaces from the MVP path.
