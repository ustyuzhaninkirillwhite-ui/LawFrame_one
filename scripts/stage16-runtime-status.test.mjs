import test from "node:test";
import assert from "node:assert/strict";

import {
  buildControlledRuntimeStopArgs,
  describeSystemStatus,
  evaluateSystemStatusReadiness,
} from "./stage16-runtime-status.mjs";

test("local-integrated runtime accepts healthy overall with optional AI degraded", () => {
  const result = evaluateSystemStatusReadiness(
    {
      overall: "healthy",
      components: [
        { code: "storage", status: "healthy" },
        { code: "activepieces", status: "healthy" },
        { code: "ai", status: "degraded" },
        { code: "search", status: "healthy" },
        { code: "realtime", status: "healthy" },
      ],
    },
    "local-integrated",
  );

  assert.equal(result.ready, true);
  assert.equal(result.blockerCode, null);
});

test("local-integrated runtime rejects blocked required components", () => {
  const result = evaluateSystemStatusReadiness(
    {
      overall: "healthy",
      components: [
        { code: "storage", status: "blocked" },
        { code: "activepieces", status: "healthy" },
        { code: "ai", status: "degraded" },
      ],
    },
    "local-integrated",
  );

  assert.equal(result.ready, false);
  assert.equal(result.blockerCode, "RUNTIME_REQUIRED_COMPONENT_BLOCKED");
});

test("runtime status description preserves component states for diagnostics", () => {
  assert.equal(
    describeSystemStatus({
      overall: "healthy",
      components: [
        { code: "storage", status: "healthy" },
        { code: "ai", status: "degraded" },
      ],
    }),
    "overall=healthy storage=healthy, ai=degraded",
  );
});

test("runtime bootstrap stop args are scoped to controlled services", () => {
  assert.deepEqual(
    buildControlledRuntimeStopArgs(
      ["compose", "--profile", "local-integrated"],
      ["backend", "web", "mining-worker"],
    ),
    [
      "compose",
      "--profile",
      "local-integrated",
      "stop",
      "backend",
      "web",
      "mining-worker",
    ],
  );
});
