# Activepieces License Map For LexFrame

## Summary

Activepieces root licensing allows MIT use outside the Enterprise carve-out.
The carve-out is explicit:

- `packages/ee/**`
- `packages/server/api/src/app/ee/**`

Those paths are governed by `packages/ee/LICENSE`, which requires a valid
Activepieces Enterprise/commercial license for production use and does not grant
ordinary redistribution rights.

## License Table

| Repo path | Component | License | Commercial SaaS use | Modify | Redistribute | Requires confirmation | Notes |
|---|---|---|---|---|---|---|---|
| `LICENSE` | Root license | MIT with EE carve-out | Yes outside carve-out | Yes outside carve-out | Yes outside carve-out | No | Keep copyright notice |
| `packages/shared/**` | Shared schemas/models/operations | MIT | Yes | Yes | Yes | No | Good source for compiler compatibility |
| `packages/pieces/framework/**` | Piece SDK | MIT | Yes | Yes | Yes | No | Direct reuse/reference is allowed |
| `packages/pieces/core/**` | Core pieces | MIT | Yes | Yes | Yes | No | Still apply LexFrame security policy |
| `packages/pieces/community/**` | Community pieces | MIT by root license | Yes | Yes | Yes | Provider terms may apply | External SaaS/API terms are separate |
| `packages/server/api/src/app/flows/**` | Flow API/runtime control | MIT | Yes | Yes | Yes | No | Prefer AP runtime API over copying server internals |
| `packages/server/worker/**` | Worker/sandbox/egress | MIT | Yes | Yes | Yes | No | Best consumed as self-hosted AP runtime |
| `packages/server/engine/**` | Execution engine | MIT | Yes | Yes | Yes | No | SSRF guard and sandbox behavior are important |
| `packages/web/src/app/builder/**` | Builder UI | MIT | Yes | Yes | Yes | No | Coupled to AP API/session/project context |
| `packages/web/src/features/templates/**` | Template UI | MIT | Yes | Yes | Yes | No | Template payload source can still be unclear |
| `packages/web/src/features/connections/**` | Connection UI | MIT | Yes | Yes | Yes | No | Do not expose privileged secrets |
| `packages/ee/embed-sdk/**` | Embed SDK | Enterprise | Only with license | Limited by EE license | No without agreement | Yes | Use commercial license or native wrapper |
| `packages/server/api/src/app/ee/managed-authn/**` | Managed auth | Enterprise | Only with license | Limited by EE license | No without agreement | Yes | Needed for AP-native embedding |
| `packages/server/api/src/app/ee/signing-key/**` | Signing keys | Enterprise | Only with license | Limited by EE license | No without agreement | Yes | LexFrame can implement native signer |
| `packages/server/api/src/app/ee/connection-keys/**` | Product embed connection keys | Enterprise | Only with license | Limited by EE license | No without agreement | Yes | Use native LexFrame connection bridge otherwise |
| `packages/server/api/src/app/ee/secret-managers/**` | AWS/Vault/1Password/CyberArk secret managers | Enterprise | Only with license | Limited by EE license | No without agreement | Yes | LexFrame can route via its own secrets module |
| `packages/server/api/src/app/ee/global-connections/**` | Global/preselected connections | Enterprise | Only with license | Limited by EE license | No without agreement | Yes | Native workspace/admin policy fallback |
| `packages/server/api/src/app/ee/platform/**` | Platform plan, billing, concurrency | Enterprise | Only with license | Limited by EE license | No without agreement | Yes | LexFrame admin should own product limits |
| `packages/server/api/src/app/ee/scim/**` | SCIM | Enterprise | Only with license | Limited by EE license | No without agreement | Yes | Native LexFrame identity integration if needed |
| `docs/LICENSE` | Mintlify docs license | MIT | Yes | Yes | Yes | No | Applies to docs tooling/content area |
| `community-templates.service.ts` cloud payloads | Cloud template data | Unknown payload terms | Not automatically | Not automatically | Not automatically | Yes | Store lineage only until legal approval |

## Rules For Implementation

- MIT-safe: flow schemas, flow operations, runtime concepts, piece framework,
  core/community pieces, builder interaction patterns, tests, and docs can be
  reused with attribution.
- Enterprise-only: do not copy or redistribute EE code in production without a
  commercial agreement.
- Commercial-license path: if LexFrame needs AP-native managed auth, embed SDK,
  global connections, secret managers, SCIM, or AP platform admin parity, buy or
  negotiate an Activepieces Enterprise/commercial license.
- Native fallback path: implement LexFrame signing, managed provisioning, OAuth
  app management, secret manager routing, admin policy, and audit using
  LexFrame-owned code.
- Templates: local source templates may be imported if license is clear; cloud
  official templates are metadata-only until legal confirmation.
- Pieces: code license is MIT, but external provider API terms, OAuth scopes,
  data processing terms, and legal SaaS policy must be checked per provider.
