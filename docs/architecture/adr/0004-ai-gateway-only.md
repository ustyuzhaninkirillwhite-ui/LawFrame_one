# ADR-0004: AI Calls Go Only Through LexFrame AI Gateway

- Status: accepted
- Date: 2026-04-20

## Decision

Frontend and arbitrary services never call model providers directly. Every AI request traverses `frontend -> backend -> ai-gateway -> provider`.

## Consequences

- Gateway owns provider routing, sensitivity policy, structured output validation, and audit traces.
- Browser bundle never contains provider keys.
- CometAPI can serve as cost/performance route, but never as policy authority.

