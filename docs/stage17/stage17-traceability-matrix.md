# Stage 17.12 Traceability Matrix

| Requirement | Source | Implementation Surface | Tests | Evidence | Status | Residual Risk | Owner / Next Check |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 17.1 readiness/freeze | Stage 17.1 docs | `docs/stage17/17.1` | release gate G0/G8 | `readiness-stage17.json` | PASS with prior caveats | AP source not git | Stage 17.12 closure |
| AP Canvas primary MVP editor | Stage 17 Rev.3 | canonical `/automation` route | `stage17-activepieces-canvas.spec.ts` | runtime evidence | PASS | Paid embed license risk | License review |
| No old LexFrame canvas as main/fallback | User stop-list | route wrapper/fallback flags | canvas E2E, stop-list | stop-list compliance | PASS | Future scope confusion | ADR |
| Workspace-scoped ensure/provisioning | 17.10 report | ensure endpoint/service | canvas E2E | runtime evidence | PASS | Local AP runtime required | Release gate |
| `/api/activepieces/session` | 17.10 report | session service/controller | unit/integration | runtime evidence | PASS | AP unavailable blocks builder | G2/G7 |
| Short-lived JWT/role mapping | Security invariant | JWT signer/role mapper | unit tests | browser secret scan | PASS | Signing key config | G4 |
| Pieces policy | Security invariant | pieces policy service | unit tests | pieces reports | PASS | Dev profile must stay local | Policy review |
| Local Owner Key Vault | Stage 17 Rev.3 | backend module/status | unit/e2e | local-key report | PASS | Owner-machine dependent | Security review |
| AI Gateway runtime | Stage 17 Rev.3 | AI gateway endpoint | integration | runtime evidence | PASS/optional | AI degraded non-blocking | AI gate |
| Frontend canonical route | 17.10 report | `automation-canvas` feature | e2e | canvas evidence | PASS | Live runtime required | G3 |
| Iframe wrapper | 17.10 report | `ActivepiecesCanvasWrapper` | e2e | screenshots | PASS | AP SDK changes | G3/G5 |
| Pinned embed SDK | 17.10 report | `embed-sdk-0.9.0.js` | canvas E2E | audit start | PASS | SDK drift | Upgrade checklist |
| RU localization | Stage 17.7 | AP locale + wrapper | localization check | coverage report | PASS | Upstream keys change | G5 |
| No localization flicker | Stage 17.12 | bundle-first + first-paint guard | flicker E2E | flicker evidence | PASS target | Live visual proof requires runtime | G5/G3 |
| Debranding | Stage 17.7/17.12 | theme/assets/wrapper | debranding check | icon evidence | PASS target | AP brand could reappear on upgrade | G5 |
| Neutral generated icon | Stage 17.12 | local SVG assets | debranding check | icon evidence | PASS | Design can be refined later | UI review |
| Open-source pieces pack | Stage 17.12 | pieces scripts/profile | pieces verify | inventory/build/sync | PASS with blockers | Build prerequisites missing | Pieces gate |
| Gmail piece | Stage 17.12 | AP inventory | Gmail check | inventory/build report | FOUND | OAuth credentials absent | Connection policy |
| CometAPI piece | Stage 17.12 | AP inventory | CometAPI check | inventory/build report | FOUND | No ru.json; AI Gateway policy | AI policy |
| Browser secret scan | Security invariant | scan script | G4 | browser scan JSON | PASS target | Runtime evidence dependent | G4 |
| Runtime evidence | 17.10 report | collect runtime evidence | G7 | runtime evidence JSON | PASS target | Containers required | G7 |
| Release gate G0-G10 | Stage 17.12 | release-gate script | `pnpm stage17:release-gate` | release-gate JSON | PASS target | Live env required | Final check |
| Final closure | Stage 17.12 | closure docs/index | closure verify | evidence index | PASS target | Final commit hash in git log | Final response |
