import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";

const runLive = process.env.LEXFRAME_STAGE17_17_10_LIVE === "1";
const projectId = process.env.STAGE17_PROJECT_ID ?? "project_claim_001";

interface EnsuredCanvas {
  readonly automation_id: string;
  readonly route: string;
}

test.describe("Stage 17.10 Activepieces Canvas release gate", () => {
  test.skip(
    !runLive,
    "Set LEXFRAME_STAGE17_17_10_LIVE=1 to run the live Stage 17.10 Canvas gate.",
  );

  let ensuredCanvas: EnsuredCanvas;

  test.beforeEach(async ({ page, request }) => {
    await signInAsDemo(page, {
      email: "stage16.owner@lexframe.test",
      fullName: "Stage 16 Owner",
    });
    ensuredCanvas = await ensureStage17Canvas(page, request);
  });

  test("auto-provisions a fresh workspace from the Automations entrypoint", async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await signInAsDemo(page, {
      email: `stage17.fresh.${Date.now()}@lexframe.test`,
      fullName: "Stage 17 Fresh Owner",
    });

    await page.goto(`/app/projects/${projectId}/automations`);

    await expect(page).toHaveURL(
      new RegExp(
        `/app/projects/${projectId}/automations/[0-9a-f-]+/automation$`,
      ),
      { timeout: 60_000 },
    );
    await expect(page.getByTestId("activepieces-canvas-container")).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByText("Пустой canvas")).toHaveCount(0);
    await expect(page.getByText("local_empty_canvas")).toHaveCount(0);
    await expect(page.getByText("Автоматизации ещё не подготовлены")).toHaveCount(
      0,
    );
  });

  test("issues a backend AP session without leaking long-lived keys", async ({
    page,
    request,
  }) => {
    const session = await getWorkspaceApiSession(page, request);
    const response = await request.post(`${session.apiBaseUrl}/activepieces/session`, {
      headers: {
        ...session.headers,
        "content-type": "application/json",
      },
      data: {
        workspace_id: session.workspaceId,
        project_id: projectId,
        automation_id: ensuredCanvas.automation_id,
        purpose: "automation_canvas",
        client_route: ensuredCanvas.route,
        mode_preference: "auto",
        return_builder_config: true,
        client_trace_id: `stage17-${Date.now()}`,
      },
    });

    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(["ready", "degraded"]).toContain(payload.status);
    expect(payload.jwt_token).toBeTruthy();
    expect(payload.role).toMatch(/^(ADMIN|EDITOR|VIEWER)$/);
    expect(JSON.stringify(payload)).not.toMatch(secretPattern);
    expect(payload.locale ?? payload.sdk_config?.embedding?.locale).toBe("ru");
  });

  test("opens the automation route with embedded AP Canvas and no AP login", async ({
    page,
  }) => {
    await page.goto(ensuredCanvas.route);

    await expect(page.getByTestId("activepieces-canvas-container")).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByText(/login|sign in|activepieces/i)).toHaveCount(0);
    await expect(
      page.locator('iframe[title="Конструктор автоматизаций"]'),
    ).toBeVisible();

    const browserState = await readBrowserState(page);
    expect(JSON.stringify(browserState)).not.toMatch(secretPattern);
  });

  test("keeps allowed AP function surfaces reachable by RBAC policy", async ({
    page,
  }) => {
    await page.goto(ensuredCanvas.route);

    await expect(page.getByTestId("activepieces-canvas-container")).toBeVisible({
      timeout: 45_000,
    });
    const builderFrame = page.frameLocator(
      'iframe[title="Конструктор автоматизаций"]',
    );
    await expect(
      builderFrame.getByText("Ручной запуск (Ручной запуск)"),
    ).toBeVisible({ timeout: 45_000 });
    await expect(builderFrame.getByText("Запуски")).toBeVisible();
    await expect(builderFrame.getByText("Версии")).toBeVisible();
    await expect(builderFrame.getByText("Опубликовать")).toBeVisible();
  });
});

async function ensureStage17Canvas(
  page: Page,
  request: APIRequestContext,
): Promise<EnsuredCanvas> {
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
  const payload = (await response.json()) as EnsuredCanvas;
  expect(payload.automation_id).toBeTruthy();
  expect(payload.route).toContain(`/app/projects/${projectId}/automations/`);
  return payload;
}

async function readBrowserState(page: Page) {
  return page.evaluate(() => ({
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
    title: document.title,
    globals: {
      hasActivepiecesSdk: Boolean(
        (window as Window & { activepieces?: unknown }).activepieces,
      ),
    },
  }));
}

const secretPattern =
  /\b(?:sk-[A-Za-z0-9_-]{20,}|xai-[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|service_role[A-Za-z0-9_-]{10,}|BEGIN PRIVATE KEY|ACTIVEPIECES_SIGNING_PRIVATE_KEY|ACTIVEPIECES_API_KEY)\b/i;
