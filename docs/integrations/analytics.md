# Analytics Contract

## Stage 0 Position

Product events flow to PostHog/ClickHouse only after taxonomy and privacy rules are fixed.

## Rules

- Recommendation signals come from product events, not builder internals.
- Trace IDs must propagate frontend -> backend -> runtime.
- Consent gates govern non-operational analytics.

