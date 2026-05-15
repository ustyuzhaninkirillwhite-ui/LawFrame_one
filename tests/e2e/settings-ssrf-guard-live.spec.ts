import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { getWorkspaceApiSession } from "./helpers/api";
import {
  assertNoConsoleErrors,
  installConsoleGuards,
} from "./utils/console";

test.describe("@part6 settings AI base URL SSRF guard", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
  });

  test("rejects localhost, private and metadata provider base URLs through backend policy", async ({
    page,
    request,
  }, testInfo) => {
    await signInAsDemo(page, {
      email: `part6-ssrf-${Date.now()}@lexframe.local`,
      fullName: "Part6 SSRF",
    });
    const session = await getWorkspaceApiSession(page, request);
    const blocked: Array<{ baseUrl: string; status: number; code: string | null }> = [];

    for (const baseUrl of [
      "http://127.0.0.1:54322/v1",
      "http://localhost/v1",
      "http://169.254.169.254/latest",
      "http://[::1]/v1",
      "http://10.0.0.5/v1",
    ]) {
      const response = await request.post(
        `${session.apiBaseUrl}/settings/ai/provider-connections`,
        {
          headers: session.headers,
          data: {
            format: "manual_form",
            routeGroup: "chat_ai",
            ownerScope: "workspace",
            providerCode: "openai_compatible",
            baseUrl,
            modelId: "part6-ssrf-model",
            capabilities: {
              streaming: true,
              jsonMode: true,
              structuredJsonSchema: true,
              toolCalls: true,
            },
          },
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
        code?: string;
        message?: string;
      };
      const code = body.error?.code ?? body.code ?? null;
      const message = body.error?.message ?? body.message ?? "";
      expect(response.status(), baseUrl).toBe(400);
      expect(code, baseUrl).toBe("AI_BASE_URL_BLOCKED");
      expect(message, baseUrl).not.toMatch(/stack|Authorization|Bearer|sk-/i);
      blocked.push({ baseUrl, status: response.status(), code });
    }

    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await testInfo.attach("settings-ssrf-guard-summary", {
      body: Buffer.from(`${JSON.stringify({ blocked }, null, 2)}\n`, "utf8"),
      contentType: "application/json",
    });
  });
});
