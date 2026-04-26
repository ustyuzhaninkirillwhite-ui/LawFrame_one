import fs from "node:fs/promises";
import path from "node:path";

const outputPath = path.resolve(
  process.env.LEXFRAME_RELEASE_MANIFEST_PATH ?? "artifacts/release-manifest.json",
);

const manifest = {
  schemaVersion: "lexframe.release_manifest.v1",
  generatedAt: new Date().toISOString(),
  environment: process.env.LEXFRAME_DEPLOY_ENV ?? "preview",
  commitSha: process.env.GITHUB_SHA ?? process.env.LEXFRAME_RELEASE_SHA ?? "local-dev",
  contractsVersion: process.env.LEXFRAME_CONTRACTS_VERSION ?? "stage11",
  workflowCompilerVersion:
    process.env.LEXFRAME_WORKFLOW_COMPILER_VERSION ??
    "stage16-workflow-compiler-v1",
  images: [
    {
      service: "backend",
      image: process.env.LEXFRAME_BACKEND_IMAGE ?? "ghcr.io/example/lexframe/backend",
      digest: process.env.LEXFRAME_BACKEND_DIGEST ?? null,
    },
    {
      service: "web",
      image: process.env.LEXFRAME_WEB_IMAGE ?? "ghcr.io/example/lexframe/web",
      digest: process.env.LEXFRAME_WEB_DIGEST ?? null,
    },
    {
      service: "mining-worker",
      image: process.env.LEXFRAME_MINING_WORKER_IMAGE ?? "ghcr.io/example/lexframe/mining-worker",
      digest: process.env.LEXFRAME_MINING_WORKER_DIGEST ?? null,
    },
  ],
  migrations: (process.env.LEXFRAME_MIGRATIONS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  pieceVersions: [
    {
      packageName: "@lexframe/activepieces-legal-pieces",
      version: process.env.LEXFRAME_ACTIVEPIECES_PIECES_VERSION ?? "0.1.0",
    },
  ],
  aiAssets: {
    promptVersions: [
      "workflow_planning_v1",
      "workflow_patch_v1",
      "redaction_preview_v1",
    ],
    schemaVersions: [
      "lexframe.workflow.v1",
      "lexframe.workflow_patch.v1",
      "ai_redaction_preview_v1",
    ],
  },
  canvas: {
    dslVersion: "2.0",
    workflowSchemaHash:
      process.env.LEXFRAME_CANVAS_WORKFLOW_SCHEMA_HASH ??
      "sha256:workflow-v2-schema-local",
    runtimeProjectionSchemaHash:
      process.env.LEXFRAME_CANVAS_RUNTIME_PROJECTION_SCHEMA_HASH ??
      "sha256:runtime-projection-schema-local",
    featureFlags: [
      {
        name: "canvas_v2_enabled",
        defaultValue: false,
        owner: "product-engineering",
        allowedRoles: ["owner", "admin"],
        killSwitch: "disable canvas_v2_enabled",
        monitoringSignal: "canvas.validation.policy_blocks",
        rollbackBehavior: "fall back to Canvas v1/read-only automation detail",
      },
      {
        name: "canvas_v2_publish_enabled",
        defaultValue: false,
        owner: "release-manager",
        allowedRoles: ["owner", "admin"],
        killSwitch: "disable canvas_v2_publish_enabled",
        monitoringSignal: "canvas.publish.failed",
        rollbackBehavior:
          "block new publishes and keep existing published versions",
      },
    ],
    testReports: {
      schema:
        process.env.LEXFRAME_CANVAS_SCHEMA_REPORT ??
        "artifacts/canvas-schema-report.json",
      backend:
        process.env.LEXFRAME_CANVAS_BACKEND_REPORT ??
        "artifacts/backend-canvas-jest.json",
      frontend:
        process.env.LEXFRAME_CANVAS_FRONTEND_REPORT ??
        "artifacts/web-canvas-vitest.json",
      e2e:
        process.env.LEXFRAME_CANVAS_E2E_REPORT ??
        "artifacts/playwright-canvas-report",
      security:
        process.env.LEXFRAME_CANVAS_SECURITY_REPORT ??
        "artifacts/canvas-security-report.json",
      performance:
        process.env.LEXFRAME_CANVAS_PERFORMANCE_REPORT ??
        "artifacts/canvas-performance-smoke.json",
      manualQa:
        process.env.LEXFRAME_CANVAS_MANUAL_QA_REPORT ??
        "docs/testing/canvas-v2-manual-qa-checklist.md",
    },
    rollbackPlan: {
      previousImageDigests: [
        {
          service: "backend",
          digest: process.env.LEXFRAME_PREVIOUS_BACKEND_DIGEST ?? "sha256:previous-backend",
        },
        {
          service: "web",
          digest: process.env.LEXFRAME_PREVIOUS_WEB_DIGEST ?? "sha256:previous-web",
        },
      ],
      disableFlags: [
        "canvas_v2_enabled",
        "canvas_v2_publish_enabled",
        "canvas_v2_reverse_sync_enabled",
      ],
      runtimeBindingPolicy: "freeze_runtime",
      verificationCommand: "corepack pnpm canvas:release-gate",
    },
  },
  build: {
    backendArtifact: process.env.LEXFRAME_BACKEND_ARTIFACT ?? null,
    frontendArtifact: process.env.LEXFRAME_FRONTEND_ARTIFACT ?? null,
    smokeReportPath: process.env.LEXFRAME_SMOKE_REPORT_PATH ?? null,
  },
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
console.log(`Release manifest written to ${outputPath}`);
