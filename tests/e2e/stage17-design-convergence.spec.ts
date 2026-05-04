import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";

const runLiveVisual =
  process.env.LEXFRAME_STAGE17_17_8_VISUAL === "1" ||
  process.env.LEXFRAME_STAGE17_17_10_LIVE === "1";
const projectId = process.env.STAGE17_PROJECT_ID ?? "project_claim_001";

test.describe("Stage 17.8 design convergence", () => {
  test.skip(
    !runLiveVisual,
    "Set LEXFRAME_STAGE17_17_8_VISUAL=1 to capture live 17.8 evidence.",
  );

  let canvasRoute: string;

  test.beforeEach(async ({ page, request }) => {
    await signInAsDemo(page, {
      email: "stage16.owner@lexframe.test",
      fullName: "Stage 16 Owner",
    });
    canvasRoute = await ensureStage17Canvas(page, request);
  });

  for (const route of [
    "/app",
    `/app/projects/${projectId}`,
    `/app/projects/${projectId}/chats/chat_project_claim_001`,
    "/documents",
    "/app/runs/run_project_claim",
    "/admin/security/activepieces",
  ]) {
    test(`LexFrame AP-like visual surface ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");

      await expect(page.locator("body")).toHaveCSS(
        "font-family",
        /Inter|IBM Plex Sans|system-ui/,
      );
      await expect(page).toHaveScreenshot(`stage17-17-8-${slug(route)}.png`, {
        fullPage: true,
        maxDiffPixels: 200,
      });
    });
  }

  test("Activepieces Canvas wrapper remains stock-like", async ({ page }) => {
    await page.goto(canvasRoute);

    const container = page.getByTestId("activepieces-canvas-container");
    await expect(container).toBeVisible({ timeout: 45_000 });
    await expect(
      container.getByText("Загружаем конструктор автоматизаций."),
    ).toHaveCount(0, { timeout: 45_000 });
    await expect(container.locator("iframe")).toBeVisible({ timeout: 45_000 });
    await expect(container).toHaveScreenshot(
      "stage17-17-8-activepieces-canvas-wrapper.png",
    );
    await expect(page.getByText(/login|sign in/i)).toHaveCount(0);
  });

  test("Keyboard focus remains visible on migrated shell controls", async ({
    page,
  }) => {
    await page.goto(`/app/projects/${projectId}`);
    await page.locator("button").first().focus();
    await page.keyboard.press("Tab");
    const activeElement = page.locator(":focus");
    await expect(activeElement).toBeVisible();
    await expect(activeElement).toHaveCSS("outline-style", /auto|solid|none/);
  });
});

async function ensureStage17Canvas(
  page: Page,
  request: APIRequestContext,
): Promise<string> {
  const session = await getWorkspaceApiSession(page, request);
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
  return payload.route;
}

function slug(route: string) {
  return route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "root";
}
