# C4 Context

```mermaid
flowchart LR
    user["Lawyer / Team User"] --> fe["LexFrame Web Frontend"]
    fe --> be["LexFrame Backend"]
    be --> sa["Supabase Auth"]
    be --> sp["Supabase Postgres"]
    be --> ss["Supabase Storage"]
    be --> sr["Supabase Realtime"]
    be --> ap["Activepieces API / Builder / Workers"]
    be --> ai["LexFrame AI Gateway"]
    ai --> xai["xAI"]
    ai --> comet["CometAPI"]
    be --> os["OpenSearch"]
    be --> ph["PostHog"]
    ph --> ch["ClickHouse"]
```

## Notes

- Frontend talks to backend for every privileged decision.
- Activepieces is outside the product core and receives only constrained runtime context.
- Analytics and search remain downstream of product events and document boundaries.

