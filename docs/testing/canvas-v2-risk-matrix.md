# Canvas v2 risk matrix

## Severity P0

Blocks release immediately:

- Secret appears in frontend bundle, network payload, localStorage or sessionStorage.
- Viewer can edit Canvas or publish.
- External delivery is possible without approval.
- Cross-workspace document, connection or runtime-flow leak.
- Published workflow is corrupted.
- Production run uses pinned/mock data.
- Direct AI provider call is possible from frontend.
- Activepieces signing private key leaks.

## Severity P1

Blocks release candidate:

- Compile preview is unstable.
- Unsafe reverse sync is accepted.
- Validation rail hides critical errors.
- Dry-run performs risky side effect.
- Autosave loses changes.
- Undo/redo corrupts graph.
- Runtime sync misses conflict.
- Publish gate uses stale validation result.

## Severity P2

Can release only with documented workaround and owner:

- Visual layout defect outside blocking/security states.
- Minor accessibility issue with alternative path.
- Long label overflow that does not hide controls or errors.
- Non-critical visual state regression.
- Performance degradation below hard threshold.

## Severity P3

Backlog:

- Copy text issue.
- Minor tooltip issue.
- Optional shortcut broken.
- Minor visual inconsistency.

## Triage rules

- P0 and P1 require explicit release-manager decision after fix verification.
- P2 requires workaround, owner and follow-up ticket before release.
- P3 must not be used for security, data isolation, publish, runtime sync, dry-run or approval defects.
