import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";

const forbiddenHosts = [
  "api.openai.com",
  "api.deepseek.com",
  "api.cometapi.com",
  "api.anthropic.com",
  "mcp.",
  "activepieces/api/v1/admin",
];
const forbiddenSecretPattern =
  /(sk-|xai-|service_role|SUPABASE_SERVICE_ROLE|ACTIVEPIECES_API_KEY|AP_JWT_SECRET|AP_ENCRYPTION_KEY|BEGIN PRIVATE KEY|Bearer [A-Za-z0-9._-]{30,})/i;

test.describe("@stage18 @stage19 @stage20 @security browser live audit", () => {
  test("does not expose provider/AP/MCP secrets or direct privileged calls in browser", async ({
    page,
  }) => {
    const browserUrls: string[] = [];
    page.on("request", (request) => {
      browserUrls.push(request.url());
    });

    await signInAsDemo(page, {
      email: `stage18-20-security-${Date.now()}@lexframe.local`,
      fullName: "Stage18 20 Security",
    });

    await page.goto("/app/projects/project_claim_001/chats");
    await expect(page.locator("body")).toBeVisible();
    await page.goto("/app/projects/project_claim_001/automation-builder");
    await expect(
      page.getByRole("heading", { name: "Automation Builder", exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    const storageDump = await page.evaluate(() => {
      const readStorage = (storage: Storage) =>
        Array.from({ length: storage.length }, (_, index) => {
          const key = storage.key(index) ?? "";
          return {
            key,
            value:
              key === "lexframe.dev.access-token"
                ? "[LEXFRAME_SESSION_TOKEN_REDACTED]"
                : storage.getItem(key),
          };
        });
      return JSON.stringify({
        localEntries: readStorage(window.localStorage),
        sessionEntries: readStorage(window.sessionStorage),
      });
    });
    const domText = await page.locator("body").innerText();

    expect(browserUrls.filter((url) => forbiddenHosts.some((host) => url.includes(host)))).toEqual([]);
    expect(storageDump).not.toMatch(forbiddenSecretPattern);
    expect(domText).not.toMatch(forbiddenSecretPattern);
  });
});
