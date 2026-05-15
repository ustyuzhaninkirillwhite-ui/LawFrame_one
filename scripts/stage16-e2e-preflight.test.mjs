import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPreflightReport,
  classifyDatabaseSchemaProbe,
  classifyAutomationEnsureProbe,
  classifyComposeService,
  getScopePlan,
} from "./stage16-e2e-preflight.mjs";

test("chat scope requires main postgres but not Activepieces runtime", () => {
  const plan = getScopePlan("chat");

  assert.equal(plan.requiredServices.has("postgres"), true);
  assert.equal(plan.requiredPorts.has(54322), true);
  assert.equal(plan.requiredServices.has("activepieces-app"), false);
  assert.equal(plan.requiredPorts.has(54323), false);
  assert.equal(plan.notRequiredServices.has("activepieces-app"), true);
  assert.equal(plan.notRequiredPorts.has(54323), true);
});

test("settings scope requires main postgres but not optional runtimes", () => {
  const plan = getScopePlan("settings");

  assert.equal(plan.requiredServices.has("postgres"), true);
  assert.equal(plan.requiredPorts.has(54322), true);
  assert.equal(plan.requiredServices.has("activepieces-app"), false);
  assert.equal(plan.requiredServices.has("storage-sandbox"), false);
  assert.equal(plan.requiredServices.has("opensearch"), false);
  assert.equal(plan.notRequiredServices.has("activepieces-app"), true);
  assert.equal(plan.notRequiredServices.has("storage-sandbox"), true);
  assert.equal(plan.notRequiredServices.has("opensearch"), true);
});

test("security scope requires main postgres but not AP/storage/search runtimes", () => {
  const plan = getScopePlan("security");

  assert.equal(plan.requiredServices.has("postgres"), true);
  assert.equal(plan.requiredPorts.has(54322), true);
  assert.equal(plan.requiredServices.has("activepieces-app"), false);
  assert.equal(plan.requiredServices.has("storage-sandbox"), false);
  assert.equal(plan.requiredServices.has("opensearch"), false);
  assert.equal(plan.notRequiredServices.has("activepieces-app"), true);
  assert.equal(plan.notRequiredServices.has("storage-sandbox"), true);
  assert.equal(plan.notRequiredServices.has("opensearch"), true);
});

test("stopped required compose service is classified as a required blocker", () => {
  const item = classifyComposeService("postgres", {
    Service: "postgres",
    State: "exited",
    Status: "Exited (255) 4 minutes ago",
    ExitCode: 255,
  });

  assert.equal(item.status, "COMPOSE_SERVICE_STOPPED");
  assert.equal(item.blocksRequired, true);
});

test("optional degradation does not block a scoped preflight report", () => {
  const report = buildPreflightReport({
    scope: "chat",
    phase: "before-build",
    required: [
      { name: "docker", status: "READY", blocksRequired: false },
      { name: "postgres-main", status: "READY", blocksRequired: false },
    ],
    optional: [
      {
        name: "activepieces-app",
        status: "NOT_REQUIRED_FOR_SCOPE",
        blocksRequired: false,
      },
      {
        name: "opensearch",
        status: "SEARCH_BLOCKED",
        blocksRequired: false,
      },
    ],
    recommendations: [],
  });

  assert.equal(report.status, "DEGRADED_OPTIONAL");
  assert.equal(report.blockers.length, 0);
});

test("automation scope blocks stale product schema before browser specs", () => {
  const item = classifyDatabaseSchemaProbe("automation", {
    ok: true,
    rows: [
      "app.projects|missing",
      "app.chat_messages.client_message_id|missing",
      "app.installed_automations|r",
      "app.automation_runtime_bindings|r",
      "app.activepieces_project_bindings|r",
      "automation_fixture_count|0",
    ],
  });

  assert.equal(item.status, "STALE_SCHEMA");
  assert.equal(item.blocksRequired, true);
  assert.deepEqual(item.details.missing, [
    "app.projects",
    "app.chat_messages.client_message_id",
    "NO_AUTOMATION_FIXTURE",
  ]);
  assert.equal(item.details.automationFixtureCount, 0);
});

test("automation ensure 503 is classified as an AP runtime blocker", () => {
  const item = classifyAutomationEnsureProbe({
    ok: false,
    status: 503,
    body: JSON.stringify({
      error: {
        code: "AP_POSTGRES_CONFIG_MISSING",
        message: "Activepieces runtime database credentials are not configured.",
      },
    }),
  });

  assert.equal(item.status, "AP_RUNTIME_BLOCKED");
  assert.equal(item.blocksRequired, true);
  assert.equal(item.details.code, "AP_POSTGRES_CONFIG_MISSING");
});
