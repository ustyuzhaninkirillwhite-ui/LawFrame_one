import { expect, test, type Page } from "@playwright/test";
import {
  assertNoConsoleErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertNoBlockingOverlay } from "./utils/clickability";
import {
  createProjectViaApi,
  delay,
  fulfillJson,
  isMswE2eRun,
  openProjectWorkspaceRoute,
  projectShell,
  setMswControls,
  signInForProjectWorkspace,
} from "./utils/project-workspace-runtime";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";
const secondaryProjectId =
  process.env.LEXFRAME_E2E_SECONDARY_PROJECT_ID ?? "project_research_002";

test.describe("@part2 project rename navigation race", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    await signInForProjectWorkspace(page, "Part2 Project Rename");
  });

  test("rename failure keeps original title authoritative and allows retry", async ({
    page,
  }) => {
    await openProjectWorkspaceRoute(page, projectId);
    const originalTitle = await stableProjectHeading(page);
    const failedTitle = `Part2 Failed Rename ${Date.now()}`;

    if (isMswE2eRun) {
      await setMswControls(page, {
        failures: {
          [`PATCH /projects/${projectId}`]: {
            status: 503,
            code: "PROJECT_RENAME_FAILED",
            message: "raw database stack should not render",
            remaining: 1,
          },
        },
      });
    } else {
      await page.route(`**/projects/${projectId}`, async (route) => {
        if (route.request().method() !== "PATCH") {
          await route.continue();
          return;
        }
        await fulfillJson(
          route,
          {
            error: {
              code: "PROJECT_RENAME_FAILED",
              message: "raw database stack should not render",
            },
          },
          503,
        );
      });
    }

    await startRename(page, failedTitle);

    await expect(projectShell(page)).toContainText(/not saved|не сохран/i);
    await expect(projectShell(page)).not.toContainText(/raw database stack|PROJECT_RENAME_FAILED/i);
    await expect(page.getByRole("heading", { name: failedTitle })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: originalTitle })).toBeVisible();
    await assertNoBlockingOverlay(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });

  test("rename success updates ProjectHome and sidebar consistently after reload", async ({
    page,
  }) => {
    await openProjectWorkspaceRoute(page, projectId);
    const originalTitle = await stableProjectHeading(page);
    const nextTitle = `Part2 Rename ${Date.now()}`;

    try {
      await startRename(page, nextTitle);
      await expect(page.getByRole("heading", { name: nextTitle })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.locator("aside").getByText(nextTitle, { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      if (!isMswE2eRun) {
        await page.reload();
        await expect(page.getByRole("heading", { name: nextTitle })).toBeVisible({
          timeout: 20_000,
        });
      }
    } finally {
      await restoreProjectTitle(page, originalTitle);
    }
  });

  test("late rename response from project A does not overwrite project B", async ({
    page,
    request,
  }) => {
    const targetProjectId = isMswE2eRun
      ? secondaryProjectId
      : await createProjectViaApi(page, request, `Part2 Switch Target ${Date.now()}`);
    let releasePatch: () => void = () => undefined;
    const delayedTitle = `Part2 Late Rename ${Date.now()}`;
    if (isMswE2eRun) {
      await setMswControls(page, {
        delays: {
          [`PATCH /projects/${projectId}`]: { delayMs: 800 },
        },
      });
    } else {
      await page.route(`**/projects/${projectId}`, async (route) => {
        if (route.request().method() !== "PATCH") {
          await route.continue();
          return;
        }
        await new Promise<void>((resolve) => {
          releasePatch = resolve;
        });
        await fulfillJson(route, {
          project: {
            id: projectId,
            name: delayedTitle,
          },
        });
      });
    }

    await openProjectWorkspaceRoute(page, projectId);
    await startRename(page, delayedTitle);
    await page.goto(`/app/projects/${targetProjectId}`, { waitUntil: "commit" });
    await expect(projectShell(page)).toBeVisible({ timeout: 20_000 });
    const secondaryTitle = await stableProjectHeading(page);
    releasePatch();
    await delay(isMswE2eRun ? 1_000 : 300);

    await expect(page).toHaveURL(new RegExp(`/app/projects/${targetProjectId}`));
    await expect(page.getByRole("heading", { name: secondaryTitle })).toBeVisible();
    await expect(page.getByRole("heading", { name: delayedTitle })).toHaveCount(0);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });
});

async function startRename(page: Page, nextTitle: string) {
  await projectShell(page).getByRole("button", { name: /Переименовать|rename/i }).click();
  const input = projectShell(page).getByRole("textbox", {
    name: /Название проекта|project name/i,
  });
  await input.fill(nextTitle);
  await input.press("Enter");
}

async function currentHeading(page: Page) {
  return (await projectShell(page).locator("h1").first().innerText()).trim();
}

async function stableProjectHeading(page: Page) {
  await expect
    .poll(async () => currentHeading(page), { timeout: 15_000 })
    .not.toBe("LexFrame");
  return currentHeading(page);
}

async function restoreProjectTitle(page: Page, originalTitle: string) {
  await page.unroute(`**/projects/${projectId}`).catch(() => undefined);
  await openProjectWorkspaceRoute(page, projectId);
  if ((await currentHeading(page)) === originalTitle) {
    return;
  }
  await startRename(page, originalTitle);
  await expect(page.getByRole("heading", { name: originalTitle })).toBeVisible({
    timeout: 20_000,
  });
}
