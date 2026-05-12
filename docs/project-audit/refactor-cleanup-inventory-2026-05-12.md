# Refactor Cleanup Inventory - 2026-05-12

## Scope

This inventory records repository noise candidates discovered during the safe cleanup/refactor pass. The second pass removed only generated visual/report outputs after link checks. Release evidence JSON, contracts, migrations, endpoints, package exports, and runtime compatibility files were left intact.

## Tracked Artifact Candidates

- Initial `artifacts/**`: 218 tracked files, including generated reports, rendered screenshots, release-gate evidence, Playwright output, and entrypoint inventories.
- Remaining `artifacts/**` after cleanup: 152 tracked files.
- Removed generated artifact files: 66 tracked files from presentation/report/playwright/debug visual output.
- Removed root visual evidence files: 9 tracked PNG files named `stage17-*.png` or `lexframe-light-theme-canvas-smoke.png`.

## Largest Files To Review Before Archiving

- `artifacts/stage18-20/remediation/e2e/playwright/results.json` - removed generated Playwright JSON output.
- `artifacts/stage18-20/remediation/e2e/playwright/html-report/index.html` - removed generated Playwright HTML output.
- `artifacts/stage19/chat-entrypoint-inventory.json` - about 3.9 MB.
- `artifacts/stage18/ai-entrypoint-inventory.json` - about 850 KB.
- `artifacts/stage17/pieces-inventory.json` - about 784 KB.

## Directory Buckets

- `artifacts/pravokontur-presentation`: removed generated presentation source, renders, scratch images, and output deck.
- `artifacts/stage17*`, `artifacts/stage18*`, `artifacts/stage19`, `artifacts/stage20`, `artifacts/stage21`: release/evidence outputs. Treat as historical evidence until owner approval.
- `artifacts/reports`: removed generated DOCX report and page renders.
- Root `stage17-*.png`: removed visual smoke/evidence screenshots.
- `artifacts/stage17.1/screenshots`: kept because `docs/stage17/17.1/evidence-manifest.json` references individual files.
- Stage 17-21 machine-readable JSON evidence: kept because readiness/gate scripts and docs reference it.

## Follow-Up Recommendation

Do a separate artifact policy pass after code cleanup is merged:

- decide which evidence is release-critical and must stay tracked;
- move generated or bulky evidence to external storage if it is not needed for source review;
- keep ignore rules for regenerated presentation/report/screenshots/playwright outputs current;
- fix the quoted/non-normalized tracked filename under `docs/project-audit` only if downstream links are checked first.
