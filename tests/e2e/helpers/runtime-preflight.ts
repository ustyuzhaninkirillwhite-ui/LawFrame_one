import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "@playwright/test";

export type RuntimePreflightStatus = "OK" | "BLOCKED_INFRASTRUCTURE";

export interface RuntimePreflightProbe {
  readonly appPortConflicts?: readonly number[];
  readonly staleBackendArtifacts?: readonly string[];
  readonly missingBackendArtifacts?: readonly string[];
  readonly postgresAvailable?: boolean;
  readonly dockerAvailable?: boolean;
}

export interface RuntimePreflightReport {
  readonly status: RuntimePreflightStatus;
  readonly reasons: readonly string[];
}

export function classifyRuntimePreflight(
  probe: RuntimePreflightProbe,
): RuntimePreflightReport {
  const reasons: string[] = [];

  if (probe.appPortConflicts && probe.appPortConflicts.length > 0) {
    reasons.push(
      `ports already in use: ${probe.appPortConflicts.join(", ")}`,
    );
  }

  if (probe.missingBackendArtifacts && probe.missingBackendArtifacts.length > 0) {
    reasons.push(
      `missing backend dist artifacts: ${probe.missingBackendArtifacts.join(", ")}`,
    );
  }

  if (probe.staleBackendArtifacts && probe.staleBackendArtifacts.length > 0) {
    reasons.push(
      `stale backend dist artifacts: ${probe.staleBackendArtifacts.join(", ")}`,
    );
  }

  if (probe.postgresAvailable === false) {
    reasons.push("Postgres/Supabase is unavailable on 127.0.0.1:54322");
  }

  if (probe.dockerAvailable === false) {
    reasons.push("Docker daemon is unavailable");
  }

  return {
    status: reasons.length > 0 ? "BLOCKED_INFRASTRUCTURE" : "OK",
    reasons,
  };
}

export function preflightRuntimeOrSkipWithReason() {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const result = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "stage16-e2e-preflight.mjs"),
      "--mode=backend-shell",
      "--phase=before-build",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        LEXFRAME_E2E_REUSE_EXISTING_SERVER:
          process.env.LEXFRAME_E2E_REUSE_EXISTING_SERVER ?? "1",
      },
    },
  );

  if (result.status === 2) {
    test.skip(
      true,
      `BLOCKED_INFRASTRUCTURE: ${result.stderr || result.stdout}`,
    );
  }
}
