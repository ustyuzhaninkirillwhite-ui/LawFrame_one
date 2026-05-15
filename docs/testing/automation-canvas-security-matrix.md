# Automation Canvas Security Matrix

| Boundary | Threat | Expected Control | Test File | Status |
| --- | --- | --- | --- | --- |
| Browser to AI provider | Direct provider call from Canvas/browser | Block direct provider host calls; route through LexFrame AI Gateway | `browser-secret-scan.ts`, `automation-ai-builder-runtime.spec.ts` | covered |
| Browser to AP admin/internal | AP admin key exposed in browser call | No AP API key in DTO/storage/network | `automation-activepieces-session-security.spec.ts` | covered |
| Session request | Client attempts role/token/config override | Denylisted fields return `INVALID_CLIENT_FIELD` | `automation-activepieces-session-security.spec.ts` | covered |
| Embed JWT | Long-lived or raw token stored in audit | Short TTL, hash/JTI only in DB/audit | `activepieces-jwt-signer.spec.ts`, `activepieces-audit-writer.spec.ts` | covered |
| AP login regression | Iframe opens login/invalid access | Controlled auth failure and retry path | `activepieces-canvas-wrapper.test.tsx`, `automation-activepieces-canvas-full.spec.ts` | covered |
| External delivery | Delivery without approval | Validation/policy block | `canvas-validation.service.spec.ts`, `delivery.service.spec.ts` | covered |
| AI node | Direct provider runtime mapping | `ai_gateway` required | `canvas-validation.service.spec.ts` | covered |
| Document refs | Cross-workspace document binding | Policy block before compile/run | `canvas-validation.service.spec.ts` | covered |
| Runtime callback | Forged callback bearer | Reject before receipt/timeline mutation | `activepieces.service.spec.ts` | covered |
| Builder planner | Auto-publish or auto-run from AI | Human approval and runtime gates | `automation-ai-builder-runtime.spec.ts` | covered |
