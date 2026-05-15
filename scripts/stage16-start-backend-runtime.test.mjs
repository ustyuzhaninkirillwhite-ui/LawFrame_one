import assert from "node:assert/strict";
import { test } from "node:test";
import { resolve } from "node:path";
import {
  applyLocalRuntimeDefaults,
  repoRoot,
  resolveBackendRuntimeEntry,
} from "./stage16-start-backend-runtime.mjs";

test("resolves backend runtime entry from the repository root", () => {
  assert.equal(
    resolveBackendRuntimeEntry(repoRoot),
    resolve(repoRoot, "apps", "backend", "dist", "main.js"),
  );
});

test("exports the repository root instead of apps/backend", () => {
  assert.equal(resolve(repoRoot, "package.json"), resolve("package.json"));
});

test("defaults local backend runtime to controlled-real AI settings with durable vault storage", () => {
  const originalEnv = { ...process.env };
  try {
    delete process.env.AI_PROVIDER_MODE;
    delete process.env.LEXFRAME_AI_SECRET_BACKEND;
    delete process.env.LEXFRAME_READINESS_PROFILE;

    applyLocalRuntimeDefaults();

    assert.equal(process.env.AI_PROVIDER_MODE, "controlled-real");
    assert.equal(process.env.LEXFRAME_AI_SECRET_BACKEND, "supabase_vault");
    assert.equal(process.env.LEXFRAME_READINESS_PROFILE, "local-integrated");
  } finally {
    process.env = originalEnv;
  }
});
