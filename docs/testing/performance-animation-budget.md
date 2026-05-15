# Performance And Animation Budget

Date: 2026-05-13

## Budgets

| Surface | Budget |
| --- | --- |
| Local UI click-to-visible | p95 <= 200 ms |
| Simple route transition | p95 <= 300 ms after webServer ready |
| Project tab switch | p95 <= 250 ms |
| Chat route switch | p95 <= 400 ms |
| Documents/sources route ready | p95 <= 500 ms |
| Optimistic chat append | <= 100 ms |
| Assistant placeholder | <= 200 ms after send request |
| Simple control long frames | max 1 frame over 50 ms |
| CLS-like layout shift | <= 0.1 |
| Activepieces iframe | good <= 2s, acceptable 2-5s, degraded 5-10s, fail or controlled unavailable > 10s |

## Measured Scenarios

- Project workspace boot.
- Project tabs.
- Settings open/close.
- Composer plus menu.
- Attachment chip render.
- Project chat route and optimistic append.
- Activepieces Canvas route/iframe surface readiness.
- Reduced-motion controls.

## Failure Policy

Performance failures must be recorded as defects with JSON metrics and traces/screenshots where available. This block does not change CSS, transitions, animation classes, blur, shadows or layout tokens to satisfy a budget.
