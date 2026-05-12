# Refactor Cleanup Inventory - 2026-05-12

## Scope

This inventory records repository noise candidates discovered during the safe cleanup/refactor pass. No artifact, screenshot, report, release evidence, contract, migration, endpoint, package export, or runtime compatibility file was deleted in this pass.

## Tracked Artifact Candidates

- `artifacts/**`: 218 tracked files, including generated reports, rendered screenshots, release-gate evidence, Playwright output, and entrypoint inventories.
- Root visual evidence files: 9 tracked PNG files named `stage17-*.png` or `lexframe-light-theme-canvas-smoke.png`.
- Total tracked artifact/evidence candidate set: 227 files.

## Largest Files To Review Before Archiving

- `artifacts/stage18-20/remediation/e2e/playwright/results.json` - about 10 MB.
- `artifacts/stage18-20/remediation/e2e/playwright/html-report/index.html` - about 4.7 MB.
- `artifacts/stage19/chat-entrypoint-inventory.json` - about 3.9 MB.
- `artifacts/stage18/ai-entrypoint-inventory.json` - about 850 KB.
- `artifacts/stage17/pieces-inventory.json` - about 784 KB.

## Directory Buckets

- `artifacts/pravokontur-presentation`: generated presentation source, renders, scratch images, and output deck.
- `artifacts/stage17*`, `artifacts/stage18*`, `artifacts/stage19`, `artifacts/stage20`, `artifacts/stage21`: release/evidence outputs. Treat as historical evidence until owner approval.
- `artifacts/reports`: generated DOCX report and page renders.
- Root `stage17-*.png`: visual smoke/evidence screenshots.

## Follow-Up Recommendation

Do a separate artifact policy pass after code cleanup is merged:

- decide which evidence is release-critical and must stay tracked;
- move generated or bulky evidence to external storage if it is not needed for source review;
- add ignore rules or generation instructions for future rendered reports/screenshots;
- fix the quoted/non-normalized tracked filename under `docs/project-audit` only if downstream links are checked first.
