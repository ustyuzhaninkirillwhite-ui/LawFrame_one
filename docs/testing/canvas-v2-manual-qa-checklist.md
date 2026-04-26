# Canvas v2 manual QA checklist

Manual QA is required before enabling `canvas_v2_publish_enabled` outside internal workspaces.

## Keyboard and accessibility

- [ ] Toolbar is reachable by keyboard.
- [ ] Inspector tabs are reachable by keyboard.
- [ ] Dialogs and drawers trap focus.
- [ ] Escape closes dialogs/drawers predictably.
- [ ] Focus is visible on all actionable controls.
- [ ] Node cards have readable labels.
- [ ] Buttons have accessible labels.
- [ ] Validation errors are visible and announced.
- [ ] Color is not the only error/warning signal.
- [ ] Light and dark themes have acceptable contrast.

## Layout and Russian content

- [ ] Long Russian step names fit node cards.
- [ ] Long project and automation names do not overlap header actions.
- [ ] Validation rail remains usable with many errors.
- [ ] Step Inspector remains usable with long input/output labels.
- [ ] Browser zoom 100%, 125% and 150% are usable.
- [ ] 1024x768 laptop viewport remains usable.

## Workflow behavior

- [ ] Empty Canvas loads.
- [ ] Valid baseline workflow loads.
- [ ] Missing required input focuses the affected node and inspector field.
- [ ] Approval-before-delivery policy block appears and disappears correctly.
- [ ] Step test creates a redacted test history entry.
- [ ] Dry-run does not send email/Telegram or create production delivery attempts.
- [ ] Compile preview shows required pieces and connections.
- [ ] Runtime sync status updates after sync.
- [ ] Reverse sync safe change imports as a new draft.
- [ ] Reverse sync unsafe change is blocked.

## Failure states

- [ ] Viewer sees read-only controls.
- [ ] Permission denied states are explicit.
- [ ] Runtime unavailable state is explicit.
- [ ] Expired embed token is handled without storing token in localStorage.
- [ ] Draft lock expired disables editing.
- [ ] Autosave conflict prompts reload/review.
- [ ] Browser refresh during dirty state does not silently lose data.
- [ ] Offline/reconnect behavior does not mark stale state as synced.
- [ ] Workspace switch reloads Canvas context and clears previous workspace data.

## Sign-off

- QA owner:
- Date:
- Environment:
- Build/commit:
- Known P2/P3 issues:
- Release recommendation:
