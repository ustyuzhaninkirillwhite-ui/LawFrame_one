# Project Knowledge / Sources Test Matrix

| Scenario | Layer | Test File | Status | Notes |
| --- | --- | --- | --- | --- |
| Project knowledge create/list | Backend/E2E | `project-knowledge.service.spec.ts`, `project-sources-knowledge.spec.ts` | Covered | Manual note fixture inserted through LexFrame API |
| Project knowledge UI tab | Web/E2E | `project-home.test.tsx`, `project-sources-knowledge.spec.ts` | Covered | Sources tab visible on project root |
| Web search backend-only route | Backend/E2E | `project-web-search.service.spec.ts`, `project-sources-knowledge.spec.ts` | Covered | Accepts ok/unconfigured/failed as controlled non-5xx |
| Search result persistence | Backend | `project-web-search.service.spec.ts` | Covered | Save-results path covered in service layer |
| Legal source list/detail | Backend | `legal-sources.service.spec.ts` | Covered | Source ownership and safe metadata |
| Legal search citations | Backend | `legal-search.service.spec.ts` | Covered | Citation IDs safe; no provider key in audit |
| Legal RAG request policy | Backend | `legal-rag.service.spec.ts` | Covered | Blocks policy violation without provider call |
| Cross-workspace/project source block | Backend/E2E | service specs, `project-sources-knowledge.spec.ts` | Covered | Foreign project access returns controlled 4xx |
| Unsafe query/key leakage | Backend/E2E | service specs, network assertions | Covered | No provider/web-search key in response, audit or browser |
