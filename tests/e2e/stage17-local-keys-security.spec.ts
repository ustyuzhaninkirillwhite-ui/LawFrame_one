import fs from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";

const runLive = process.env.LEXFRAME_STAGE17_17_10_LIVE === "1";
const projectId = process.env.STAGE17_PROJECT_ID ?? "project_claim_001";

test.describe("Stage 17.10 local keys and browser secret evidence", () => {
  test.skip(
    !runLive,
    "Set LEXFRAME_STAGE17_17_10_LIVE=1 to run the live Stage 17.10 security gate.",
  );

  test("does not expose provider keys in status, network, storage or route state", async ({
    page,
    request,
  }) => {
    const captured: Array<{ url: string; text: string }> = [];
    page.on("response", async (response) => {
      const url = response.url();
      if (!/activepieces|local-keys|automation-runtime|ai-gateway/i.test(url)) {
        return;
      }
      const contentType = response.headers()["content-type"] ?? "";
      if (!/json|text|html|javascript/i.test(contentType)) {
        return;
      }
      captured.push({
        url,
        text: await response.text().catch(() => ""),
      });
    });

    await signInAsDemo(page, {
      email: "stage16.owner@lexframe.test",
      fullName: "Stage 16 Owner",
    });
    const session = await getWorkspaceApiSession(page, request);
    const canvas = await ensureStage17Canvas(request, session);

    const localKeysStatus = await request.get(
      `${session.apiBaseUrl}/admin/local-keys/status`,
      { headers: session.headers },
    );
    expect([200, 403]).toContain(localKeysStatus.status());
    if (localKeysStatus.status() === 200) {
      const statusPayload = await localKeysStatus.json();
      expect(JSON.stringify(statusPayload)).not.toMatch(secretPattern);
      expect(JSON.stringify(statusPayload)).toMatch(/fingerprint|status|keys/i);
    }

    await page.goto(canvas.route);
    await expect(
      page.locator('iframe[title="Конструктор автоматизаций"]'),
    ).toBeVisible({
      timeout: 45_000,
    });

    const storage = await page.evaluate(() => ({
      localStorage: Object.fromEntries(
        Array.from({ length: window.localStorage.length }, (_, index) => {
          const key = window.localStorage.key(index) ?? "";
          return [key, window.localStorage.getItem(key)];
        }),
      ),
      sessionStorage: Object.fromEntries(
        Array.from({ length: window.sessionStorage.length }, (_, index) => {
          const key = window.sessionStorage.key(index) ?? "";
          return [key, window.sessionStorage.getItem(key)];
        }),
      ),
      cookies: document.cookie,
      title: document.title,
    }));
    const evidence = {
      generated_at: new Date().toISOString(),
      captured,
      storage,
    };

    const outputPath = path.resolve(
      process.cwd(),
      "..",
      "..",
      "artifacts",
      "stage17",
      "playwright-browser-evidence.json",
    );
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(redactEvidence(evidence), null, 2)}\n`);

    expect(JSON.stringify(evidence)).not.toMatch(secretPattern);
    expect(storage.localStorage).not.toHaveProperty("activepieces.jwtToken");
    expect(storage.sessionStorage).not.toHaveProperty("activepieces.jwtToken");
  });
});

async function ensureStage17Canvas(
  request: APIRequestContext,
  session: Awaited<ReturnType<typeof getWorkspaceApiSession>>,
) {
  const response = await request.post(
    `${session.apiBaseUrl}/projects/${projectId}/automations/stage17-canvas/ensure`,
    {
      headers: {
        ...session.headers,
        "content-type": "application/json",
      },
      data: {},
    },
  );

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { readonly route: string };
  expect(payload.route).toContain(`/app/projects/${projectId}/automations/`);
  return payload;
}

function redactEvidence(input: unknown) {
  return JSON.parse(JSON.stringify(input), (_key, value) => {
    if (typeof value === "string" && secretPattern.test(value)) {
      return "[REDACTED]";
    }
    return value;
  });
}

const secretPattern =
  /\b(?:sk-[A-Za-z0-9_-]{20,}|xai-[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|service_role[A-Za-z0-9_-]{10,}|BEGIN PRIVATE KEY|ACTIVEPIECES_SIGNING_PRIVATE_KEY|ACTIVEPIECES_API_KEY)\b/i;
