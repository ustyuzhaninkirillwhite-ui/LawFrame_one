# ADR-0005: Recommendation Engine Is Advisory

- Status: accepted
- Date: 2026-04-20

## Decision

Recommendation candidates never create or mutate installed automations automatically. They produce a suggestion that the user must explicitly accept into a draft automation.

## Consequences

- Analytics and process mining remain separate from mutation commands.
- Recommendation acceptance becomes its own auditable product event.
- Unsafe self-automation loops are prevented by design.

