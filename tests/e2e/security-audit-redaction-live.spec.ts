import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";

test.describe("@part7 security audit redaction live", () => {
  test("real settings secret action produces audit metadata without raw key, secret ref or signed URL values", async ({
    page,
    request,
  }, testInfo) => {
    const runId = Date.now();
    const marker = `sk-part7-audit-${runId}-secret-marker`;
    await signInAsDemo(page, {
      email: `part7-audit-${runId}@lexframe.local`,
      fullName: "Part7 Audit",
    });
    const session = await getWorkspaceApiSession(page, request);

    const createConnection = await request.post(
      `${session.apiBaseUrl}/settings/ai/provider-connections`,
      {
        headers: session.headers,
        data: {
          ownerScope: "workspace",
          routeGroup: "chat_ai",
          providerCode: "cometapi",
          uiLabel: `Part7 Audit ${runId}`,
          baseUrl: "https://api.example.com/v1",
          modelId: `part7-audit-model-${runId}`,
          apiKey: marker,
          capabilities: {
            streaming: true,
            jsonMode: true,
            structuredJsonSchema: true,
            toolCalls: true,
          },
        },
      },
    );
    expect(createConnection.ok()).toBeTruthy();
    expect(await createConnection.text()).not.toContain(marker);

    const auditResponse = await request.get(`${session.apiBaseUrl}/audit/events`, {
      headers: session.headers,
    });
    expect(auditResponse.ok()).toBeTruthy();
    const auditText = await auditResponse.text();
    expect(auditText).not.toContain(marker);
    expect(auditText).not.toMatch(/sk-part7-audit-\d+-secret-marker/i);
    expect(auditText).not.toMatch(/Authorization:\s*Bearer/i);
    expect(auditText).not.toMatch(/\/storage\/v1\/object\/sign\/|[?&]token=/i);
    expect(auditText).not.toMatch(/secret_ref_id":"[0-9a-f-]{16,}"/i);
    expect(auditText).not.toMatch(/backendSecretId":"[^"]+"/i);

    const audit = JSON.parse(auditText) as AuditResponse;
    const items: readonly AuditItem[] = Array.isArray(audit)
      ? audit
      : (audit as { readonly items?: readonly AuditItem[] }).items ?? [];
    const settingsEvents = items.filter((item) =>
      item.action.startsWith("settings.ai."),
    );
    expect(settingsEvents.length).toBeGreaterThan(0);
    expect(JSON.stringify(settingsEvents)).toContain("[REDACTED]");

    await testInfo.attach("audit-redaction-live-summary", {
      body: Buffer.from(
        `${JSON.stringify(
          {
            settingsAuditEvents: settingsEvents.length,
            markerPresent: false,
            redacted: true,
          },
          null,
          2,
        )}\n`,
        "utf8",
      ),
      contentType: "application/json",
    });
  });
});

interface AuditItem {
  readonly action: string;
  readonly metadata: unknown;
}

type AuditResponse =
  | readonly AuditItem[]
  | {
      readonly items?: readonly AuditItem[];
    };
