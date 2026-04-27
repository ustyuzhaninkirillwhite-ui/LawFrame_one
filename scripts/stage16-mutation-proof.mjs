import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const worktree = join(tmpdir(), `lexframe-stage16-mutation-${timestamp}`);
const evidenceDir = join(tmpdir(), `lexframe-stage16-mutation-evidence-${timestamp}`);
mkdirSync(evidenceDir, { recursive: true });

const mutations = [
  {
    id: "backend-runtime-artifact",
    file: "scripts/stage16-build-backend-runtime.mjs",
    replace: "apps/backend/dist/main.js",
    with: "apps/backend/dist/__stage16_missing_main__.js",
    command: ["corepack", ["pnpm", "stage16:release-gate"]],
  },
  {
    id: "web-runtime-artifact",
    file: "scripts/stage16-build-web-runtime.mjs",
    replace: "packages/workflow-dsl/dist/index.js",
    with: "packages/workflow-dsl/dist/__stage16_missing_index__.js",
    command: ["corepack", ["pnpm", "stage16:release-gate"]],
  },
  {
    id: "disable-ap-flow-creation",
    file: "apps/backend/src/modules/workflow-compiler/activepieces-sync.service.ts",
    replace: "const created = await this.activepieces.createFlow({",
    with: "throw new Error('stage16 mutation disabled AP flow creation');\n    const created = await this.activepieces.createFlow({",
    command: ["corepack", ["pnpm", "stage16:release-gate"]],
  },
  {
    id: "invalid-ap-api-key",
    file: "compose.yaml",
    replace: "ACTIVEPIECES_API_KEY: local_activepieces_access_token",
    with: `ACTIVEPIECES_API_KEY: ${fakeJwt()}`,
    command: ["corepack", ["pnpm", "stage16:release-gate"]],
  },
  {
    id: "compose-ps-q",
    file: "scripts/stage16-db-bootstrap.mjs",
    replace: "const postgresService = \"postgres\";",
    with: "const postgresService = \"postgres\";\nconst stage16MutationForbiddenPattern = [\"compose\", \"ps\", \"-q\", \"activepieces-postgres\"];",
    command: ["corepack", ["pnpm", "stage16:validate:compose-helpers"]],
  },
  {
    id: "remove-ap-evidence-step",
    file: "scripts/stage16-release-gate.mjs",
    replace: "stage16:activepieces:evidence",
    with: "stage16:ap-evidence-removed",
    command: ["corepack", ["pnpm", "stage16:validate:release-gate-integrity"]],
  },
  {
    id: "break-scenario20-accessible-name",
    file: "tests/e2e/stage16-live-audit/stage16-live-audit.spec.ts",
    replace: "Рабочая область Canvas",
    with: "__stage16_missing_canvas_region__",
    command: ["corepack", ["pnpm", "stage16:release-gate"]],
  },
  {
    id: "zero-live-tests",
    file: "scripts/stage16-run-live-audit.mjs",
    replace: "\"stage16-live-audit\",",
    with: "\"stage16-no-tests\",",
    command: ["corepack", ["pnpm", "stage16:run-live-audit"]],
  },
];

assertClean(root);
runOrThrow("git", ["worktree", "add", "--detach", worktree, "HEAD"], root, "worktree-add");

try {
  runOrThrow(
    "corepack",
    ["pnpm", "install", "--frozen-lockfile"],
    worktree,
    "install",
  );

  const results = [];
  for (const mutation of mutations) {
    applyMutation(mutation);
    const result = runCapture(
      mutation.command[0],
      mutation.command[1],
      worktree,
      mutation.id,
    );
    results.push({
      mutation: mutation.id,
      expected: "non-zero exit",
      actual: result.status,
      status: result.status === 0 ? "FAIL" : "PASS",
    });
    revertWorktree();
    if (result.status === 0) {
      throw new Error(`mutation ${mutation.id} did not fail as expected`);
    }
  }

  const finalStatus = runCapture("git", ["status", "--short"], worktree, "final-status");
  if (finalStatus.stdout.trim()) {
    throw new Error(`mutation worktree is not clean:\n${finalStatus.stdout}`);
  }

  writeFileSync(
    join(evidenceDir, "summary.json"),
    `${JSON.stringify({ evidenceDir, results }, null, 2)}\n`,
  );
  console.log(`[stage16-mutation-proof] PASS evidence=${evidenceDir}`);
} finally {
  runCapture("git", ["worktree", "remove", "--force", worktree], root, "worktree-remove");
}

function assertClean(cwd) {
  const status = runCapture("git", ["status", "--short"], cwd, "source-status");
  if (status.status !== 0 || status.stdout.trim()) {
    throw new Error(
      `stage16 mutation proof requires a clean source tree before starting.\n${status.stdout}${status.stderr}`,
    );
  }
}

function applyMutation(mutation) {
  const filePath = join(worktree, mutation.file);
  const original = readFileSync(filePath, "utf8");
  if (!original.includes(mutation.replace)) {
    throw new Error(`mutation ${mutation.id} target not found in ${mutation.file}`);
  }
  writeFileSync(filePath, original.replace(mutation.replace, mutation.with));
}

function revertWorktree() {
  runOrThrow("git", ["checkout", "--", "."], worktree, "revert");
  runOrThrow("git", ["clean", "-fd"], worktree, "clean");
}

function runOrThrow(command, args, cwd, label) {
  const result = runCapture(command, args, cwd, label);
  if (result.status !== 0) {
    throw new Error(`${label} failed with ${result.status}\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function runCapture(command, args, cwd, label) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      LEXFRAME_READINESS_PROFILE:
        process.env.LEXFRAME_READINESS_PROFILE ?? "local-integrated",
      ACTIVEPIECES_SIMULATE_RUNS:
        process.env.ACTIVEPIECES_SIMULATE_RUNS ?? "0",
      NEXT_PUBLIC_ENABLE_MSW: process.env.NEXT_PUBLIC_ENABLE_MSW ?? "0",
    },
    maxBuffer: 100 * 1024 * 1024,
  });
  writeFileSync(
    join(evidenceDir, `${label}.log`),
    [
      `$ ${command} ${args.join(" ")}`,
      `cwd=${cwd}`,
      `exit=${result.status}`,
      "--- stdout ---",
      result.stdout ?? "",
      "--- stderr ---",
      result.stderr ?? "",
    ].join("\n"),
  );
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function fakeJwt() {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      id: "user_stage16_invalid",
      projectId: "project_stage16_invalid",
      platform: { id: "platform_stage16_invalid" },
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  return `${header}.${payload}.invalid`;
}
