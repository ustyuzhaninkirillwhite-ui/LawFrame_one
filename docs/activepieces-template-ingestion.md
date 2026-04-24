# Activepieces Template And Automation Ingestion

## Verified State

The archive does not contain a local official flow-template JSON library.
Template functionality exists in code:

- `packages/server/api/src/app/template/template.controller.ts`
- `packages/server/api/src/app/template/template.service.ts`
- `packages/server/api/src/app/template/template-validator.ts`
- `packages/server/api/src/app/template/community-templates.service.ts`
- `packages/shared/src/lib/management/template/template.ts`
- `packages/web/src/features/templates/**`
- `packages/web/src/app/routes/templates/**`
- EE custom platform templates:
  `packages/server/api/src/app/ee/template/platform-template.service.ts`

For self-hosted editions, official templates are proxied from
`https://cloud.activepieces.com/api/v1/templates`. Those payloads are not
automatically portable into LexFrame and must be marked `needs legal
confirmation`.

## Ingestion Pipeline

```text
Activepieces template / example / flow JSON
-> scan and parse
-> validate template or flow shape
-> extract required pieces, triggers, actions, and connections
-> classify provider and data risk
-> remove secrets and private references
-> map to LexFrame category
-> create automation_template
-> create automation_template_version
-> create runtime mapping
-> preserve source path and hash
-> generate preview and import report
-> optionally compile back to Activepieces flow JSON
```

## Source Classification

| Source | Import mode | License risk | Recommended action |
|---|---|---|---|
| Local template JSON | `library_import` if schema/license clear | Low if covered by MIT | Normalize and seed |
| Local flow/test fixture JSON | `library_import` for examples only | Low to medium | Import as draft/internal examples |
| Docs examples | `library_import` if executable and licensed | Low to medium | Normalize manually reviewed examples |
| Cloud official templates | Metadata-only until approved | High/unknown | Do not redistribute without legal confirmation |
| Custom platform templates in AP DB | Workspace-scoped import | Tenant-owned | Import through admin/operator workflow |

## Generator

The implementation package `@lexframe/activepieces-template-ingestor` scans:

- `.json` files
- `.md` and `.mdx` fenced JSON snippets
- known template proxy code
- migration/test fixtures containing flow-like structures

It emits source records with:

- source path
- source type
- hash
- importability
- required pieces
- required connections
- risk
- license note
- LexFrame category
- blocker list

Recommended command after dependencies are available:

```powershell
corepack pnpm --filter @lexframe/activepieces-template-ingestor build
node packages/activepieces-template-ingestor/dist/cli.js E:\activepieces-main --markdown
```

## Acceptance Criteria

- Local scan completes without mutating the Activepieces archive.
- Cloud template proxy is reported as `needs legal confirmation`.
- No secret-looking values are carried into generated LexFrame seed data.
- Every import record includes source path and SHA-256 hash.
- Unknown Activepieces flow features are preserved for runtime projection rather
  than dropped.
