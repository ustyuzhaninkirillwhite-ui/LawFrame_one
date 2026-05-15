# Accessibility Keyboard Plan

Date: 2026-05-13

## Covered Interactions

| Surface | Assertions |
| --- | --- |
| Sidebar/settings entry | Tab reachable, focus visible, activation opens dialog |
| Settings dialog | Focus remains in visible dialog, Escape closes where supported |
| Project tabs | Keyboard reachable and focus-visible |
| Chat composer | Textbox focusable |
| Attachment/menu controls | Covered by reduced-motion and performance specs where route state supports it |
| Automation route | Dry-run/canvas controls covered by Block4 route specs and Block5 smoke |

## Defect Policy

Accessibility failures are classified as:
- P1 if focus trap blocks a core route/action.
- P2 if overlay traps keyboard or prevents primary action.
- P3 if visible focus is absent on noncritical controls.

No styling changes are made in Block 5.
