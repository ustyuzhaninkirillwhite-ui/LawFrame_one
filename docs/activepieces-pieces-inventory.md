# Activepieces Pieces Inventory

## Verified Counts

Archive root: `E:\activepieces-main`

| Piece class | Count |
|---|---:|
| Core pieces | 27 |
| Community pieces | 657 |
| Custom pieces | 0 |
| Total pieces | 684 |
| Source action files | 4367 |
| Source trigger files | 1258 |

Core pieces:

`approval`, `connections`, `crypto`, `csv`, `data-mapper`,
`data-summarizer`, `date-helper`, `delay`, `file-helper`, `forms`,
`graphql`, `http`, `image-helper`, `manual-trigger`, `math-helper`, `pdf`,
`qrcode`, `schedule`, `sftp`, `smtp`, `store`, `subflows`, `tables`, `tags`,
`text-helper`, `webhook`, `xml`.

## Exposure Policy

| Risk class | Default exposure | Examples | Required controls |
|---|---|---|---|
| Safe core | Normal catalog | `manual-trigger`, `schedule`, `delay`, `date-helper`, `text-helper`, `math-helper`, `crypto`, `csv`, `qrcode`, `xml`, `data-mapper`, `store`, `tags` | Standard workspace permissions |
| Legal/document | Normal or policy-gated catalog | `docusign`, `pandadoc`, `sign-now`, `signrequest`, `pdf`, `google-docs`, `google-drive`, `box`, `dropbox`, `airparser`, `amazon-textract` | Document-layer routing, DLP, approval for external send |
| Delivery | Policy-gated | `gmail`, `slack`, `telegram-bot`, `twilio`, `sendgrid`, `resend`, `whatsapp`, `microsoft-teams` | Human approval, delivery confirmation, audit |
| AI | Blocked until routed | `openai`, `claude`, `google-gemini`, `azure-openai`, `amazon-bedrock`, `cohere`, `perplexity-ai` | LexFrame AI gateway only; no provider keys in AP |
| Database | Admin-only or blocked | `postgres`, `mysql`, `mongodb`, `supabase`, `snowflake`, `oracle-database`, `bigquery` | No privileged DB credentials; scoped backend tokens only |
| Devops/storage/scraping | Advanced/admin-only | `http`, `graphql`, `soap`, `sftp`, `amazon-s3`, `github`, `gitlab`, `apify`, `firecrawl`, `tavily` | Egress policy, SSRF guard, scoped tokens |
| Finance/billing | Admin/policy-gated | `stripe`, `square`, `quickbooks`, `xero`, `chargebee`, `paddle` | Finance approval and least-privilege OAuth scopes |
| Unknown/general SaaS | Hidden until classified | Long-tail community pieces | Manual review or classifier extension |

## Generator

The implementation package `@lexframe/activepieces-inventory` scans the
Activepieces repo and emits:

- package name
- path
- display name
- core/community/custom class
- action and trigger counts
- auth type
- risk class
- LexFrame exposure
- import mode
- notes

Recommended command after dependencies are available:

```powershell
corepack pnpm --filter @lexframe/activepieces-inventory build
node packages/activepieces-inventory/dist/cli.js E:\activepieces-main --markdown
```

## Import Strategy

- Import all safe pieces into `Technical Integrations`.
- Import legal/document pieces into `Legal Modules` or `Document Operations`
  after provider-specific review.
- Expose delivery pieces only with workspace approval policy.
- Hide generic HTTP/API, database, Supabase, SFTP, SMTP, browser/scraping, and
  custom pieces behind advanced/admin mode.
- Route AI pieces through LexFrame AI gateway.
- Route file/storage pieces through LexFrame document layer.
- Preserve original package name and source path for lineage.
