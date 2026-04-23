# ADR-0006: External Delivery Requires Approval By Default

- Status: accepted
- Date: 2026-04-20

## Decision

Any e-mail, Telegram, publication, or client-facing file delivery is classified as an external action and requires human approval unless an explicit workspace policy says otherwise.

## Consequences

- Workflow DSL keeps approval nodes as first-class contract entities.
- Delivery modules cannot be marked production-ready before approval policy, audit, and security review are complete.
- AI planner cannot silently create external-send steps without approval metadata.

