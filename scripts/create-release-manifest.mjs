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
  build: {
    backendArtifact: process.env.LEXFRAME_BACKEND_ARTIFACT ?? null,
    frontendArtifact: process.env.LEXFRAME_FRONTEND_ARTIFACT ?? null,
    smokeReportPath: process.env.LEXFRAME_SMOKE_REPORT_PATH ?? null,
  },
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
console.log(`Release manifest written to ${outputPath}`);
