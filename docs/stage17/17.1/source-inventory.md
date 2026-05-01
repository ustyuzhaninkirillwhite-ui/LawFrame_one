# Source Inventory

Status: BLOCKED
Date: 2026-04-28

## LexFrame

- Root: `E:\Law_frame_main`
- Git branch: `codex/17`
- Commit: `ec145113ad4fdeba40a7826a4122032b8f52e9d3`
- Last commit: `Добавлен full-runtime режим Stage 16`
- Git status before 17.1 artifacts: existing untracked
  `stage16-audit-evidence-20260426-000827/`
- Package: `lexframe@0.1.0`
- Package manager: `pnpm@10.11.1` through Corepack
- Toolchain observed: Node `v22.16.0`, Corepack `0.32.0`,
  `corepack pnpm` `10.11.1`, direct `pnpm` not in PATH.
- Main app directories observed: `apps/backend`, `apps/web`,
  `apps/mining-worker`.
- Main packages observed: `activepieces-bridge`,
  `activepieces-catalog-sync`, `activepieces-inventory`,
  `activepieces-legal-pieces`, `activepieces-template-ingestor`,
  `ai-gateway`, `api-client`, `canvas-test-fixtures`, `config`,
  `contracts`, `logger`, `telemetry`, `workflow`, `workflow-compiler`,
  `workflow-dsl`.

Evidence:

- `artifacts/stage17.1/command-logs/20260428-lexframe-source-state.txt`
- `artifacts/stage17.1/inventories/lexframe-ui-design-sanitized.txt`
- `artifacts/stage17.1/inventories/lexframe-secret-config-sanitized.txt`

## Activepieces

- Root: `E:\activepieces-main`
- Git status: BLOCKED. The directory exists but is not a git repository.
- Branch/commit: unknown because `.git` metadata is absent.
- Package: `activepieces@0.82.0`
- Package manager declared by `package.json`: `bun@1.3.3`
- Toolchain observed: Node available, Corepack available, `bun` not in PATH.
- Lockfile observed: `bun.lock` present.
- Target directories observed:
  - `packages/react-ui`: present
  - `packages/web`: present
  - `packages/ee`: present
  - `packages/server/api`: present
  - `packages/server/worker`: present
  - `packages/pieces`: present
  - `server/api/src/app/ee`: not present as that exact root path
  - `packages/server/api/src/app/ee`: present
- No top-level `apps/` directory was present in the Activepieces checkout.

Evidence:

- `artifacts/stage17.1/command-logs/20260428-activepieces-source-state.txt`
- `artifacts/stage17.1/inventories/activepieces-source-files-sanitized.txt`
- `artifacts/stage17.1/inventories/activepieces-secret-config-sanitized.txt`

## Audit Tooling Caveat

`rg` returned `Access is denied` in this Codex Windows session. Inventories use
Codebase Memory graph, `git grep -l` for tracked LexFrame matches, and
PowerShell path/name enumeration for Activepieces. This is documented as
CR-17.1-004 and should be reviewed before PASS if exact prescribed `rg` logs
are mandatory.
