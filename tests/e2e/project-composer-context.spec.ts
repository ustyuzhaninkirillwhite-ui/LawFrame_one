import { expect, test, type Request } from "@playwright/test";
import path from "node:path";
import {
  assertNoConsoleErrors,
  installConsoleGuards,
} from "./utils/console";
import {
  composerInput,
  delay,
  fulfillJson,
  isMswE2eRun,
  isProjectChatCreate,
  openAutomationPicker,
  openPlusMenu,
  openProjectWorkspaceRoute,
  openProjectWorkspaceTab,
  openWebSearchPanel,
  projectFileInput,
  projectShell,
  recordRequests,
  sendButton,
  setMswControls,
  signInForProjectWorkspace,
  webSearchPanel,
} from "./utils/project-workspace-runtime";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";
const fixturesDir = path.join(__dirname, "fixtures", "files");

test.describe("@part2 project composer context", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    await signInForProjectWorkspace(page, "Part2 Project Composer");
  });

  test("prompt survives plus menu, web-search panel and tab switches", async ({
    page,
  }) => {
    await openProjectWorkspaceRoute(page, projectId);
    await composerInput(page).fill("Part2 retained project prompt");

    await openPlusMenu(page);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("project-plus-menu")).toHaveCount(0);
    await expect(page.getByTestId("project-plus-button")).toBeFocused();

    await openWebSearchPanel(page);
    await webSearchPanel(page).getByRole("button", { name: /Закрыть|close/i }).click();
    await expect(webSearchPanel(page)).toHaveCount(0);

    await openProjectWorkspaceTab(page, "sources");
    await openProjectWorkspaceTab(page, "automations");
    await openProjectWorkspaceTab(page, "chats");
    await expect(composerInput(page)).toHaveValue("Part2 retained project prompt");
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });

  test("double click send creates at most one project chat and one stream", async ({
    page,
  }) => {
    const createRequests = recordRequests(page, isProjectChatCreate(projectId));
    const streamRequests = recordRequests(page, isStreamRequest);

    await page.route(`**/projects/${projectId}/chats`, async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await delay(400);
      await fulfillJson(route, {
        chat: {
          id: "chat_part2_double_send",
          projectId,
          title: "Part2 double submit",
        },
        session: {
          id: "aisess_part2_double_send",
          status: "active",
        },
      });
    });
    await page.route("**/chat/threads/*/messages:stream", async (route) => {
      await delay(100);
      await fulfillJson(route, { status: "completed", events: [] });
    });

    await openProjectWorkspaceRoute(page, projectId);
    await composerInput(page).fill("Part2 double submit");
    await sendButton(page).dblclick();

    await expect.poll(() => createRequests.length, { timeout: 5_000 }).toBe(1);
    await expect.poll(() => streamRequests.length, { timeout: 5_000 }).toBe(1);
    expect(createRequests).toHaveLength(1);
    expect(streamRequests).toHaveLength(1);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });

  test("failed project chat creation keeps composer recoverable and redacted", async ({
    page,
  }) => {
    if (isMswE2eRun) {
      await setMswControls(page, {
        failures: {
          [`POST /projects/${projectId}/chats`]: {
            status: 503,
            code: "PROJECT_CHAT_CREATE_FAILED",
            message: "raw provider stack should not render",
            remaining: 1,
          },
        },
      });
    } else {
      await page.route(`**/projects/${projectId}/chats`, async (route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        await fulfillJson(
          route,
          {
            error: {
              code: "PROJECT_CHAT_CREATE_FAILED",
              message: "raw provider stack should not render",
            },
          },
          503,
        );
      });
    }

    await openProjectWorkspaceRoute(page, projectId);
    await composerInput(page).fill("Part2 failed create keeps draft");
    await sendButton(page).click();

    await expect(projectShell(page)).toContainText(/Сообщение не отправлено|Message was not sent/i);
    await expect(projectShell(page)).not.toContainText(/raw provider stack|ApiClientError/i);
    await expect(composerInput(page)).toHaveValue("Part2 failed create keeps draft");
    await expect(sendButton(page)).toBeEnabled();
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });

  test("file chip validation and automation chip removal keep send state correct", async ({
    page,
  }) => {
    await openProjectWorkspaceRoute(page, projectId);

    await projectFileInput(page).setInputFiles(path.join(fixturesDir, "empty.txt"));
    await expect(projectShell(page)).toContainText("empty.txt");
    await expect(sendButton(page)).toBeDisabled();

    await projectShell(page).getByRole("button", { name: /Убрать файл|remove file/i }).click();
    await expect(projectShell(page)).not.toContainText("empty.txt");
    await composerInput(page).fill("Part2 text only after invalid file");
    await expect(sendButton(page)).toBeEnabled();

    await openAutomationPicker(page);
    const attachButtons = page.getByTestId("project-automation-picker").getByRole("button", {
      name: /Прикрепить|attach/i,
    });
    if ((await attachButtons.count()) > 0) {
      await attachButtons.first().click();
      const chip = page.getByTestId("selected-automation-chip");
      await expect(chip).toBeVisible();
      await expect(chip.getByRole("link")).toHaveAttribute(
        "href",
        new RegExp(`/app/projects/${projectId}/automations/.+/automation`),
      );
      await chip.getByRole("button", { name: /Убрать автоматизацию|remove/i }).click();
      await expect(chip).toHaveCount(0);
      await expect(composerInput(page)).toHaveValue("Part2 text only after invalid file");
    } else {
      await expect(page.getByTestId("project-automation-picker")).toContainText(
        /Автоматизаций пока нет|no automations/i,
      );
    }
  });
});

function isStreamRequest(request: Request) {
  const url = new URL(request.url());
  return request.method() === "POST" && /\/chat\/threads\/.+\/messages:stream$/.test(url.pathname);
}
