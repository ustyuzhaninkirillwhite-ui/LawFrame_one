import assert from "node:assert/strict";
import { test } from "node:test";
import { resolve } from "node:path";
import {
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
