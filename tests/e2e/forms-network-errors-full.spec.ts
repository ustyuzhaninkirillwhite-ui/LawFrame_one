import { expect, test, type Page } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { installConsoleGuards } from "./utils/console";
import { writeJsonArtifact } from "./utils/evidence";
import { assertRouteReady } from "./utils/navigation";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";
const block5MswControlStorageKey = "lexframe.e2e.block5.msw-control";
const forbiddenSecretPattern =
  /(sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|authorization|x-api-key|OPENAI_API_KEY|COMETAPI_API_KEY|service_role|BEGIN PRIVATE KEY)/i;

test.describe("@block5 forms and network error recovery", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    await signInAsDemo(page, {
      email: `block5-forms-${Date.now()}@lexframe.local`,
      fullName: "Block5 Forms User",
    });
    await waitForSettledApp(page);
  });

  test("keeps dirty profile values after a failed profile save", async ({
    page,
  }) => {
    await openSettings(page);
    const profileName = page.getByTestId("settings-profile-display-name");
    const dirtyValue = `Dirty profile ${Date.now()}`;
    await profileName.fill(dirtyValue);

    await failNextMswRequest(page, "PATCH /settings/profile", {
      status: 500,
      code: "PROFILE_SAVE_TEMPORARILY_UNAVAILABLE",
      message: "Profile settings were not saved. Try again.",
    });
    await page.getByTestId("settings-save-button").click();

    await expect(profileName).toHaveValue(dirtyValue);
    await expect(page.getByRole("dialog")).toContainText(
      /Profile settings were not saved/i,
    );
    await expect(page.getByRole("dialog")).not.toContainText(
      /Unhandled|stack trace|HTTP 500/i,
    );
  });

  test("guards organization save against a double-click duplicate PATCH", async ({
    page,
  }) => {
    await openSettings(page);
    await page.getByTestId("settings-tab-organization").click();
    await expect(page.getByTestId("settings-organization-display-name")).toBeVisible();

    await delayMswRequest(page, "PATCH /settings/organization", 700);

    const organizationName = `Block5 Org ${Date.now()}`;
    await page.getByTestId("settings-organization-display-name").fill(organizationName);
    const saveButton = page.getByTestId("settings-save-button");
    await saveButton.dblclick();
    await expect(saveButton).toBeDisabled();

    await expect
      .poll(
        () => readBlock5MswRequestCount(page, "PATCH /settings/organization"),
        { timeout: 10_000 },
      )
      .toBe(1);
    const requestCount = await readBlock5MswRequestCount(
      page,
      "PATCH /settings/organization",
    );
    writeJsonArtifact("block5-network", "organization-save-double-click", {
      generatedAt: new Date().toISOString(),
      requestCount,
    });
  });

  test("redacts AI connection test failures in the settings UI", async ({
    page,
  }) => {
    const rawConnectionFailureMessage = [
      "upstream 502",
      "Authorization:",
      "Bearer",
      "sk-block5-secret-should-not-render",
    ].join(" ");

    await openSettings(page);
    await page.getByTestId("settings-tab-ai").click();
    await expect(page.getByRole("heading", { name: /AI/i })).toBeVisible({
      timeout: 15_000,
    });
    const apiKeyInput = page.getByLabel(/API key/i).first();
    if (await apiKeyInput.isVisible().catch(() => false)) {
      await apiKeyInput.fill("sk-block5-ui-only-key");
    }

    await failNextMswRequest(page, "POST /settings/ai/provider-connections/test", {
      status: 502,
      requestId: "block5-ai-test-redaction",
      code: "AI_PROVIDER_UNAVAILABLE",
      message: rawConnectionFailureMessage,
      details: {
        header: "x-api-key: sk-block5-secret-should-not-render",
      },
    });

    const testButton = page
      .getByRole("button", {
        name: /Проверить подключение|Сохранить и проверить|test connection|save and test/i,
      })
      .first();
    await expect(testButton).toBeEnabled({ timeout: 15_000 });
    await waitForTwoAnimationFrames(page);
    await testButton.click();
    await expect
      .poll(
        () =>
          readBlock5MswRequestCount(
            page,
            "POST /settings/ai/provider-connections/test",
          ),
        { timeout: 5_000 },
      )
      .toBe(1);

    const dialogText = await page.getByRole("dialog").innerText({ timeout: 15_000 });
    expect(dialogText).toMatch(/provider unavailable|AI provider is temporarily unavailable/i);
    expect(dialogText).not.toMatch(forbiddenSecretPattern);
    expect(dialogText).not.toContain("upstream 502");
  });

  test("project rename failure keeps the draft and re-enables save", async ({
    page,
  }) => {
    await gotoAppRoute(page, `/app/projects/${projectId}`);
    await assertRouteReady(page, "project-workspace");

    await failNextMswRequest(page, `PATCH /projects/${projectId}`, {
      status: 500,
      code: "PROJECT_RENAME_FAILED",
      message: "Project name was not saved. Try again.",
    });

    await page
      .getByTestId("project-workspace-shell")
      .getByRole("button", { name: /Переименовать проект|rename project/i })
      .click();
    const draft = `Failed project rename ${Date.now()}`;
    const input = page.getByRole("textbox", { name: /Название проекта|project name/i });
    await input.fill(draft);
    await page
      .getByRole("button", { name: /Сохранить название проекта|save project name/i })
      .click();

    await expect(input).toHaveValue(draft);
    await expect(
      page.getByRole("button", { name: /Сохранить название проекта|save project name/i }),
    ).toBeEnabled();
  });

  test("chat title rename failure keeps editing open without publishing draft", async ({
    page,
  }) => {
    const threadId = "chat_project_claim_001";
    await gotoAppRoute(page, `/app/projects/${projectId}/chats/${threadId}`);
    await assertRouteReady(page, "project-chat");

    const originalTitle = await page
      .getByRole("link", { name: /Претензия|Поставщик|claim|chat/i })
      .first()
      .innerText({ timeout: 15_000 })
      .catch(() => null);

    await failNextMswRequest(page, `PATCH /chat/threads/${threadId}`, {
      status: 500,
      code: "CHAT_TITLE_RENAME_FAILED",
      message: "Название чата не сохранено. Повторите попытку.",
    });

    const renameButton = page
      .getByRole("button", { name: /Переименовать чат|rename chat/i })
      .first();
    await expect(renameButton).toBeVisible({ timeout: 15_000 });
    await renameButton.click();

    const draftTitle = `Failed chat title ${Date.now()}`;
    const titleInput = page.getByRole("textbox", {
      name: /Название чата|chat title/i,
    });
    await titleInput.fill(draftTitle);
    await page
      .getByRole("button", { name: /Сохранить название чата|save chat title/i })
      .click();

    await expect(titleInput).toHaveValue(draftTitle);
    await expect(page.locator("body")).toContainText(
      /Название чата не сохранено/i,
    );
    await expect(page.locator("a", { hasText: draftTitle })).toHaveCount(0);
    if (originalTitle) {
      expect(originalTitle).not.toContain(draftTitle);
    }
  });

  test("slow core APIs keep request counts bounded", async ({ page }) => {
    await delayMswRequest(page, "GET /session/context", 350);
    await delayMswRequest(page, "GET /settings/bootstrap", 350);
    await delayMswRequest(page, "GET /projects", 350);

    await gotoAppRoute(page, `/app/projects/${projectId}`);
    await assertRouteReady(page, "project-workspace");
    await page.getByTestId("settings-entry-point").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.waitForTimeout(2_000);

    const snapshot = {
      session: await readBlock5MswRequestCount(page, "GET /session/context"),
      settings: await readBlock5MswRequestCount(page, "GET /settings/bootstrap"),
      projects: await readBlock5MswRequestCount(page, "GET /projects"),
    };
    writeJsonArtifact("block5-network", "slow-core-api-request-counts", {
      generatedAt: new Date().toISOString(),
      counts: snapshot,
    });
    expect(snapshot.session ?? 0).toBeLessThanOrEqual(4);
    expect(snapshot.settings ?? 0).toBeLessThanOrEqual(4);
    expect(snapshot.projects ?? 0).toBeLessThanOrEqual(4);
  });
});

async function openSettings(page: Page) {
  await gotoAppRoute(page, `/app/projects/${projectId}`);
  await assertRouteReady(page, "project-workspace");
  await page.getByTestId("settings-entry-point").first().click();
  await assertRouteReady(page, "settings");
}

async function waitForSettledApp(page: Page) {
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
    .toMatch(/^\/app\/projects\/[^/]+(?:\/chats)?\/?$|^\/dashboard$/);
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForTimeout(300);
}

async function gotoAppRoute(page: Page, url: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      return;
    } catch (error) {
      if (
        attempt === 2 ||
        !(error instanceof Error) ||
        (!error.message.includes("net::ERR_ABORTED") &&
          !error.message.includes("interrupted by another navigation"))
      ) {
        throw error;
      }

      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(200);
    }
  }
}

async function waitForTwoAnimationFrames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function failNextMswRequest(
  page: Page,
  key: string,
  error: {
    readonly status: number;
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
    readonly requestId?: string;
  },
) {
  await runWithNavigationRetry(page, () =>
    page.evaluate(
      ({ storageKey, requestKey, failure }) => {
        const raw = window.sessionStorage.getItem(storageKey);
        const control = raw ? JSON.parse(raw) : {};
        control.failures = {
          ...(control.failures ?? {}),
          [requestKey]: {
            ...failure,
            remaining: 1,
          },
        };
        window.sessionStorage.setItem(storageKey, JSON.stringify(control));
      },
      {
        storageKey: block5MswControlStorageKey,
        requestKey: key,
        failure: error,
      },
    ),
  );
}

async function delayMswRequest(
  page: Page,
  key: string,
  delayMs: number,
) {
  await runWithNavigationRetry(page, () =>
    page.evaluate(
      ({ storageKey, requestKey, ms }) => {
        const raw = window.sessionStorage.getItem(storageKey);
        const control = raw ? JSON.parse(raw) : {};
        control.delays = {
          ...(control.delays ?? {}),
          [requestKey]: { delayMs: ms },
        };
        window.sessionStorage.setItem(storageKey, JSON.stringify(control));
      },
      { storageKey: block5MswControlStorageKey, requestKey: key, ms: delayMs },
    ),
  );
}

async function readBlock5MswRequestCount(page: Page, key: string) {
  return runWithNavigationRetry(page, () =>
    page.evaluate(
      ({ storageKey, requestKey }) => {
        const raw = window.sessionStorage.getItem(storageKey);
        if (!raw) {
          return 0;
        }

        const control = JSON.parse(raw);
        return Number(control.counts?.[requestKey] ?? 0);
      },
      { storageKey: block5MswControlStorageKey, requestKey: key },
    ),
  );
}

async function runWithNavigationRetry<T>(
  page: Page,
  action: () => Promise<T>,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (!isNavigationContextError(error) || attempt === 2) {
        throw error;
      }

      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(150);
    }
  }

  throw lastError;
}

function isNavigationContextError(error: unknown) {
  return (
    error instanceof Error &&
    /Execution context was destroyed|Cannot find context|navigation/i.test(
      error.message,
    )
  );
}
