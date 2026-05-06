# Stage 18 MIT Reference Intake

Stage 18 uses local reference repositories as clean-room architecture input only.

| Project | License evidence | Decision | Reason |
|---|---|---|---|
| assistant-ui | LICENSE / package=n/a | reference_only | MIT license present; Stage 18 needs only stream contract compatibility. |
| Chatbot UI | LICENSE / package=n/a | reference_only | Local license file present; use UX/settings lessons only. |
| AnythingLLM | LICENSE / package=MIT | reference_only | MIT package metadata; backend/runtime not imported. |
| LibreChat | LICENSE / package=ISC | direct_import_blocked | Local LICENSE is MIT but package metadata is ISC; use architecture/reference only until resolved. |
| OpenWebUI | n/a / package=n/a | blocked | Blocked for direct Stage 18 code/assets/dependency unless a separate future license review approves it. |
| Dify | n/a / package=n/a | blocked | Blocked for direct Stage 18 code/assets/dependency unless a separate future license review approves it. |
| LobeChat | n/a / package=n/a | blocked | Blocked for direct Stage 18 code/assets/dependency unless a separate future license review approves it. |
| Flowise | n/a / package=n/a | blocked | Blocked for direct Stage 18 code/assets/dependency unless a separate future license review approves it. |

No code, assets, backend subsystem, hosted runtime, or UI runtime was imported directly from the reference repositories.
