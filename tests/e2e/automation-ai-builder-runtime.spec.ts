import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import { openAutomationBuilder, runtimeHeaders } from "./utils/automation";
import {
  assertNoAutomationBrowserSecrets,
  installAutomationBrowserSecretScan,
} from "./utils/browser-secret-scan";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block4 AI automation builder runtime policy", () => {
  test.beforeEach(async ({ page }) => {
    installAutomationBrowserSecretScan(page);
    await signInAsDemo(page, {
      email: `block4-builder-${Date.now()}@lexframe.local`,
      fullName: "Block4 Builder User",
    });
  });

  test("keeps planner, publish and runtime creation behind LexFrame backend policy gates", async ({
    page,
    request,
  }) => {
    const session = await getWorkspaceApiSession(page, request);
    const headers = runtimeHeaders(session);

    await openAutomationBuilder(page, projectId);

    const preflightResponse = await request.post(
      `${session.apiBaseUrl}/automation-builder/security/preflight`,
      { headers: session.headers },
    );
    expect(preflightResponse.status(), await preflightResponse.text()).toBeLessThan(500);
    const preflight = await preflightResponse.json();
    expect(preflight.frontendProviderCallsAllowed).toBe(false);
    expect(preflight.frontendRuntimeCallsAllowed).toBe(false);
    expect(preflight.canPublish).toBe(false);
    expect(preflight.canRunProduction).toBe(false);

    const intentResponse = await request.post(
      `${session.apiBaseUrl}/projects/${projectId}/automation-intents`,
      {
        headers,
        data: {
          source: "automation_builder_page",
          title: "Block4 gated automation",
          userGoal:
            "Create a legal drafting automation, but require approval before external delivery and do not run automatically.",
          classification: "client_material",
        },
      },
    );
    expect(intentResponse.status(), await intentResponse.text()).toBeLessThan(500);
    const intentPayload = await intentResponse.json();
    const intentId = intentPayload.intent?.id;
    expect(intentId).toBeTruthy();

    const planResponse = await request.post(
      `${session.apiBaseUrl}/automation-intents/${intentId}/plan`,
      { headers: session.headers },
    );
    expect(planResponse.status(), await planResponse.text()).toBeLessThan(500);
    const plan = await planResponse.json();
    const serializedPlan = JSON.stringify(plan);
    expect(serializedPlan).not.toMatch(/sk-|service_role|BEGIN PRIVATE KEY|ACTIVEPIECES_API_KEY/i);
    expect(plan.blueprint?.routeSnapshot?.route).toBe("automation_planner_high");
    expect(plan.blueprint?.routeSnapshot?.keyFingerprint).toBe("server_route_ref");
    expect(plan.blueprint?.validationSummary?.canPublish).toBe(false);
    expect(plan.blueprint?.validationSummary?.canRunProduction).toBe(false);
    expect(plan.blueprint?.dataPolicy?.rawSecretMaterialAllowed).not.toBe(true);

    const blueprintId = plan.blueprint?.id;
    expect(blueprintId).toBeTruthy();
    const runtimeBeforeApproval = await request.post(
      `${session.apiBaseUrl}/automation-blueprints/${blueprintId}/create-runtime-draft`,
      { headers: session.headers },
    );
    expect([400, 403, 409]).toContain(runtimeBeforeApproval.status());

    await assertNoAutomationBrowserSecrets(page);
  });
});
