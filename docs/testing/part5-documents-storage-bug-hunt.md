# Part 5 Documents / Storage Bug Hunt

Дата: 2026-05-14

## Scope

Инспектированы:

- `apps/backend/src/modules/documents/documents.service.ts`
- `apps/backend/src/modules/documents/documents.controller.ts`
- `apps/backend/src/modules/documents/documents.service.spec.ts`
- `apps/web/src/components/upload-dialog.tsx`
- `apps/web/src/components/preview-panel.tsx`
- `apps/web/src/components/document-detail-panel.tsx`
- `apps/web/src/components/document-list.tsx`
- `apps/web/src/mocks/handlers.ts`
- `packages/contracts/src/errors/error-codes.ts`
- `tests/e2e/documents-upload-download-full.spec.ts`
- `tests/e2e/stage2-storage-integrated.spec.ts`
- `tests/e2e/documents-storage.spec.ts`
- `tests/e2e/utils/documents.ts`

Не повторялось как новая работа:

- basic upload happy path из Block 3 без новой оси риска;
- static secret scan как единственное доказательство security;
- chat attachment lifecycle из Part 3;
- Project Workspace file-chip сценарии из Part 2.

## Bugs Found

### P1 product bug: upload completion was allowed before content upload

Воспроизведение:

1. `POST /documents/upload-intents`.
2. Не вызывать `POST /documents/:documentId/versions/:versionId/content`.
3. Вызвать `POST /documents/:documentId/versions/:versionId/complete`.

Фактическое поведение до фикса: completion мог пройти дальше в pipeline в dev/backend-backed контуре и падал уже позднее либо создавал риск phantom completed version.

Фикс:

- `uploadVersionContent` теперь фиксирует `document_versions.status = 'uploaded'`, `sha256`, size и MIME после проверки bytes.
- `completeUpload` принимает только `uploaded` version.
- mismatch по MIME/size/hash возвращает controlled domain error.

Regression guard:

- `apps/backend/src/modules/documents/documents.service.spec.ts`
- `tests/e2e/documents-upload-failure-lifecycle.spec.ts`

### P1 product/security bug: upload content metadata could diverge from upload intent

Воспроизведение:

1. Создать intent для `application/pdf`.
2. Вызвать content upload с `text/plain` и тем же размером.

Фактическое поведение до фикса: content endpoint валидировал bytes, но не сверял с intent metadata.

Фикс:

- Добавлен `DOCUMENT_UPLOAD_METADATA_MISMATCH`.
- Content и complete сверяют MIME/size с версией из product DB.
- Verified storage metadata также сверяется с uploaded version metadata.

### P1 security/UX bug: signed URL leaked into browser DOM

Воспроизведение:

1. Открыть `/documents/:documentId`.
2. Нажать preview signed URL request.
3. Проверить `document.documentElement.outerHTML`.

Фактическое поведение до фикса: full signed URL был в `href`, включая `/storage/v1/object/sign/...token=...`.

Фикс:

- `PreviewPanel` больше не рендерит signed URL в `href`.
- Открытие выполняется через click handler `window.open(...)`.
- Усилен e2e helper `assertNoSignedUrlRendered`: проверяет body text, full DOM HTML и local/session storage.

Regression guard:

- `apps/web/src/components/preview-panel.test.tsx`
- `tests/e2e/documents-download-security.spec.ts`

### P2 test/runtime issue: legacy storage smoke required full readiness

Воспроизведение:

1. Запустить documents scoped e2e при готовых DB/storage/delivery, но без OpenSearch/release gates.
2. `stage2-storage-integrated.spec.ts` падал на full `local-integrated` readiness.

Фикс:

- Legacy storage smoke теперь проверяет scoped storage sandbox readiness (`http://127.0.0.1:54321/health`) вместо full readiness profile.

## Tests Added / Changed

Новые:

- `tests/e2e/documents-upload-failure-lifecycle.spec.ts`
- `tests/e2e/documents-download-security.spec.ts`
- `tests/e2e/documents-cross-scope-access.spec.ts`
- `tests/e2e/documents-msw-upload-lifecycle.spec.ts`

Изменённые:

- `tests/e2e/documents-upload-download-full.spec.ts` использован как backend-backed regression в финальном gate.
- `tests/e2e/stage2-storage-integrated.spec.ts`
- `tests/e2e/documents-storage.spec.ts`
- `tests/e2e/utils/documents.ts`
- `apps/web/src/mocks/handlers.ts`
- `apps/web/src/components/preview-panel.test.tsx`
- `apps/backend/src/modules/documents/documents.service.spec.ts`

## Results

Preflight:

- `node scripts/stage16-e2e-preflight.mjs --scope=documents --json --fail-on-required`
- Result: `READY`
- Artifact: `artifacts/system-tests/part5-preflight.documents.json`

Backend-backed e2e:

- Command: `corepack pnpm --filter @lexframe/e2e exec playwright test documents-upload-download-full.spec.ts documents-upload-failure-lifecycle.spec.ts documents-download-security.spec.ts documents-cross-scope-access.spec.ts stage2-storage-integrated.spec.ts documents-storage.spec.ts`
- Result: 6/6 PASS
- Results JSON: `artifacts/system-tests/part5-results.backend-documents-runtime.json`

MSW deterministic:

- Command: `corepack pnpm --filter @lexframe/e2e exec playwright test documents-msw-upload-lifecycle.spec.ts`
- Result: 1/1 PASS
- Results JSON: `artifacts/system-tests/part5-results.msw-documents-runtime.json`

Static/unit/backend:

- `corepack pnpm --filter @lexframe/contracts typecheck` PASS
- `corepack pnpm --filter @lexframe/api-client typecheck` PASS
- `corepack pnpm --filter @lexframe/web typecheck` PASS
- `corepack pnpm --filter @lexframe/web lint` PASS
- `corepack pnpm --filter @lexframe/web exec vitest run src/components/upload-dialog.test.tsx src/components/preview-panel.test.tsx src/components/document-list.test.tsx` PASS
- `corepack pnpm --filter @lexframe/backend typecheck` PASS
- `corepack pnpm --filter @lexframe/backend lint` PASS
- `corepack pnpm --filter @lexframe/backend test -- documents document-generation document-templates document-types document-validation` PASS
- `corepack pnpm --filter @lexframe/e2e typecheck` PASS
- `corepack pnpm --filter @lexframe/e2e lint` PASS

Security:

- `corepack pnpm validate:web-bundle-secrets` PASS
- `corepack pnpm secret-scan` PASS

Note: `corepack pnpm --filter @lexframe/web test -- upload-dialog preview-panel document-list` also ran, but its broad pattern picked up an unrelated automation-canvas test failure. The exact touched document tests were rerun by file path and passed.

## Evidence Summary

Console:

- New browser specs install console guards.
- Final backend-backed run had no console/pageerror assertion failures.

Network/request metrics:

- Upload lifecycle regression: 1 upload intent, 1 premature complete `409`, 1 metadata mismatch content `400`, 1 successful content, 1 wrong-hash complete `400`, 1 successful complete, 1 versions read.
- Download security regression: 1 signed-url POST; no browser DOM/storage signed URL after response.
- Cross-scope regression: foreign workspace detail GET blocked with `403/404`; foreign signed-url POST blocked with `403/404`; no AP/provider/direct storage browser call was needed.
- MSW deterministic: first content upload forced `503`, second submit recovered.

DOM/storage scan:

- `assertNoSignedUrlRendered` checks body text, full DOM HTML, localStorage, sessionStorage.
- Covered signed URL token pattern, storage sign path, `service_role`, `SUPABASE_SERVICE_ROLE`.
- Final covered DOM/storage scans PASS.

Artifacts:

- Final Playwright failure traces/videos/screenshots: none, final runs passed.
- Earlier RED run produced a transient signed-URL DOM leak failure; final passing runs overwrote current `tests/e2e/test-results` with no retained failure trace.

Runtime notes:

- Initial documents preflight was blocked because `storage-sandbox` and `delivery-sandbox` were stopped.
- Both were restarted with `docker compose --profile local-integrated up -d storage-sandbox delivery-sandbox`.
- Subsequent scoped documents preflight was `READY`.

## Changed Files

- `apps/backend/src/modules/documents/documents.service.ts`
- `apps/backend/src/modules/documents/documents.service.spec.ts`
- `apps/web/src/components/preview-panel.tsx`
- `apps/web/src/components/preview-panel.test.tsx`
- `apps/web/src/mocks/handlers.ts`
- `packages/contracts/src/errors/error-codes.ts`
- `tests/e2e/utils/documents.ts`
- `tests/e2e/documents-upload-failure-lifecycle.spec.ts`
- `tests/e2e/documents-download-security.spec.ts`
- `tests/e2e/documents-cross-scope-access.spec.ts`
- `tests/e2e/documents-msw-upload-lifecycle.spec.ts`
- `tests/e2e/stage2-storage-integrated.spec.ts`
- `tests/e2e/documents-storage.spec.ts`
- `artifacts/system-tests/part5-preflight.documents.json`
- `artifacts/system-tests/part5-results.backend-documents-runtime.json`
- `artifacts/system-tests/part5-results.msw-documents-runtime.json`

## Unresolved Risks

- `DocumentDetailPanel` still has a “new version” metadata form without a real file input. With the stricter backend lifecycle it will fail controlled instead of creating a phantom version. A real fix needs a UX/control addition and would be a visual/product-flow change, so it was not changed in this no-visual-change part.
- Signed URL still necessarily exists inside short-lived React state after backend response so the open action can work. It is no longer rendered into DOM/storage.
- Browser trace response bodies can still contain backend signed-url API responses if tracing captures network payloads on failures. Final runs had no failures; long-term hardening would be a backend-controlled download redirect route that never returns signed URLs to browser JavaScript.
