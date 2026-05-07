import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";

const forbiddenSecretPattern =
  /(sk-|xai-|service_role|SUPABASE_SERVICE_ROLE|ACTIVEPIECES_API_KEY|AP_JWT_SECRET|AP_ENCRYPTION_KEY|BEGIN PRIVATE KEY)/i;

test.describe("@stage18 @ai-gateway Stage 18 AI Gateway live audit", () => {
  test("routes default chat through LexFrame AI Gateway and keeps planner route reserved", async ({
    page,
    request,
  }) => {
    await signInAsDemo(page, {
      email: `stage18-audit-${Date.now()}@lexframe.local`,
      fullName: "Stage18 Audit",
    });
    const session = await getWorkspaceApiSession(page, request);
    const headers = {
      ...session.headers,
      "content-type": "application/json",
    };

    const readinessResponse = await request.get(
      `${session.apiBaseUrl}/readiness/stage18`,
      { headers: session.headers },
    );
    const readinessText = await readinessResponse.text();
    expect(readinessResponse.status(), readinessText).toBeLessThan(500);
    const readiness = JSON.parse(readinessText) as {
      readonly status: string;
      readonly defaultRoute: {
        readonly route: string;
        readonly provider: string;
        readonly model: string;
      };
    };
    expect(readiness.status).not.toBe("unavailable");
    expect(readiness.defaultRoute).toMatchObject({
      route: "default_chat",
      provider: "cometapi",
      model: "deepseek-v4-flash",
    });

    const streamResponse = await request.post(`${session.apiBaseUrl}/ai/stream`, {
      headers,
      data: {
        route: "default_chat",
        message: "Stage 18 audit safe backend-routed request.",
      },
    });
    const streamBody = await streamResponse.text();
    expect(streamResponse.ok(), streamBody).toBeTruthy();
    expect(streamBody).toContain("default_chat");
    expect(streamBody).toContain("cometapi");
    expect(streamBody).toContain("deepseek-v4-flash");
    expect(streamBody).not.toMatch(forbiddenSecretPattern);

    const plannerRouteResponse = await request.post(
      `${session.apiBaseUrl}/ai/stream`,
      {
        headers,
        data: {
          route: "automation_planner_high",
          message: "This route must remain Stage 20 only.",
        },
      },
    );
    const plannerRouteText = await plannerRouteResponse.text();
    expect(plannerRouteResponse.ok(), plannerRouteText).toBeTruthy();
    expect(plannerRouteText).toContain("ai_route_not_allowed");
    expect(plannerRouteText).toContain("reserved for Stage 20");
    expect(plannerRouteText).not.toMatch(forbiddenSecretPattern);

    const redactionResponse = await request.post(
      `${session.apiBaseUrl}/ai/redaction/preview`,
      {
        headers,
        data: {
          text: "Ivan Petrov wrote to ivan.petrov@example.test about confidential client material.",
          classification: "B_ANONYMIZED_LEGAL",
          redactionPolicy: "strict",
        },
      },
    );
    const redactionText = await redactionResponse.text();
    expect(redactionResponse.ok(), redactionText).toBeTruthy();
    const redaction = JSON.parse(redactionText) as {
      readonly redactedText: string;
      readonly mappingId: string;
    };
    expect(redaction.redactedText).toContain("<EMAIL_1>");
    expect(redaction.mappingId).toBeTruthy();
    expect(JSON.stringify(redaction)).not.toMatch(forbiddenSecretPattern);
  });
});
