import { expect, test } from "@playwright/test";
import { classifyRuntimePreflight } from "./helpers/runtime-preflight";

test.describe("@block1 frontend runtime preflight", () => {
  test("classifies dirty infrastructure before browser product checks", () => {
    const report = classifyRuntimePreflight({
      appPortConflicts: [3000, 3100],
      dockerAvailable: false,
      missingBackendArtifacts: ["apps/backend/dist/main.js"],
      postgresAvailable: false,
      staleBackendArtifacts: ["packages/contracts/dist/index.js"],
    });

    expect(report.status).toBe("BLOCKED_INFRASTRUCTURE");
    expect(report.reasons).toEqual(
      expect.arrayContaining([
        "ports already in use: 3000, 3100",
        "Docker daemon is unavailable",
        "missing backend dist artifacts: apps/backend/dist/main.js",
        "Postgres/Supabase is unavailable on 127.0.0.1:54322",
        "stale backend dist artifacts: packages/contracts/dist/index.js",
      ]),
    );
  });

  test("does not classify a clean shell runtime probe as a product pass", () => {
    const report = classifyRuntimePreflight({
      appPortConflicts: [],
      dockerAvailable: true,
      missingBackendArtifacts: [],
      postgresAvailable: true,
      staleBackendArtifacts: [],
    });

    expect(report).toEqual({
      status: "OK",
      reasons: [],
    });
  });
});
