# Stage 17.12 Risk Register

| Risk | Impact | Mitigation | Owner / Next Check |
| --- | --- | --- | --- |
| Localization flicker regression | User sees English before Russian | Bundle-first locale, initial visible-paint guard, Playwright sampling | Stage 17.12 release gate |
| AP image/SDK upgrade breaks localization/debranding | English strings or AP brand returns | Manifest checks and runtime patch evidence | Upgrade checklist |
| AP logo/wordmark reappears | Trademark/white-label breach | Neutral local assets, visible scanner, browser scan | Debranding gate |
| Secrets leak into browser/network/storage | Security incident | Browser secret scan, no frontend long-lived keys | Security gate |
| Open-source pieces build failures | Palette/cache incomplete | Build report records built/failed/skipped/blockers | Pieces gate |
| Gmail missing or unusable | Email workflows misleading | Explicit Gmail inventory/build/auth report | Pieces gate |
| CometAPI missing or bypasses AI Gateway | AI policy breach | Explicit CometAPI report and production AI Gateway warning | AI policy review |
| Paid/enterprise feature used without license | Legal risk | License boundary docs; no ee code/assets copied | Legal/license review |
| Pieces policy overexposes dangerous integrations | Data exfiltration risk | Dev-only all-open-source profile; production allowlist remains | Policy review |
| Future Canvas strategy confusion | Scope creep | Accepted ADR separates MVP AP Canvas from future LexFrame DSL Canvas | Stage planning |
