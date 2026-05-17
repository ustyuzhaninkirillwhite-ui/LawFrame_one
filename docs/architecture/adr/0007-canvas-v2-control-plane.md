# ADR-0007: Canvas v2 Is The LexFrame Workflow Control Plane

- Status: accepted
- Date: 2026-04-25

## Decision

Canvas v2 edits `LexFrameWorkflowV2` stored by LexFrame backend. React Flow state is a view model only, and Activepieces JSON is a runtime projection only.

The default user experience is `guided_vertical`. `advanced_free_graph` and embedded Activepieces are advanced/admin modes guarded by backend permissions, feature flags, policy validation, audit, and short-lived backend-issued tokens.

Runtime import and reverse sync never write directly to the canonical workflow. They create snapshots, semantic diffs, policy findings, and reviewed draft candidates.

## Scope Lock

Stage 16.18-16.20 is complete only when these P0 gates are true:

- contracts expose stable `LexFrameWorkflowV2`, `CanvasOperation`, `ValidationIssue`, compile, test-run, runtime import, and AI patch shapes;
- Canvas state includes explicit rollout flags for `canvas_v2`, `canvas_ai_assistant`, `canvas_advanced_graph`, and `canvas_reverse_sync`;
- validation exposes `can_save`, `can_test`, `can_compile`, `can_publish`, `can_run`, and `can_sync`;
- frontend cannot persist raw graph blobs or call Activepieces admin APIs directly;
- publish requires backend validation, compile preview, security policy checks, and immutable version creation;
- external delivery requires an approval path by default;
- AI assistant proposes patches only and requires user confirmation before apply;
- reverse sync creates a reviewed draft or conflict instead of replacing canonical state.

## Consequences

- Canvas API changes must map to a `CanvasOperation` and write audit metadata.
- New node types require schema, UI schema, validation rules, runtime mapping, and production readiness coverage before appearing in the palette.
- Runtime sync and reverse sync can be disabled independently from the rest of Canvas through rollout flags.
- Release candidates must pass Canvas fixture, release gate, security, compiler, e2e, and performance checks.
