import { expect, type Page } from "@playwright/test";

const apiBaseUrl = process.env.LEXFRAME_API_BASE_URL ?? "http://127.0.0.1:3100";

export async function createProjectChat(page: Page, projectId: string) {
  const result = await fetchFromBrowser<{
    readonly chat: { readonly id: string; readonly projectId: string };
  }>(page, `/projects/${projectId}/chats`, {
    method: "POST",
    body: {
      title: `Block3 project chat ${Date.now()}`,
      source: "project_chat",
    },
  });

  expect(result.chat.projectId).toBe(projectId);
  return result.chat.id;
}

export async function createGlobalChat(page: Page) {
  const result = await fetchFromBrowser<{
    readonly thread: { readonly id: string; readonly projectId: string | null };
  }>(page, "/chat/threads", {
    method: "POST",
    body: {
      title: `Block3 global chat ${Date.now()}`,
      kind: "general",
    },
  });

  expect(result.thread.projectId).toBeNull();
  return result.thread.id;
}

export async function sendChatMessage(page: Page, text: string) {
  const composer = page.getByTestId("chat-composer-input");
  await expect(composer).toBeVisible({ timeout: 15_000 });
  await composer.fill(text);
  await composer.press("Enter");
}

export async function waitForUserMessage(page: Page, text: string) {
  await expect(page.locator("[data-message-role='user']").filter({ hasText: text })).toBeVisible({
    timeout: 15_000,
  });
}

export async function waitForAssistantPlaceholder(page: Page) {
  await expect
    .poll(
      async () => {
        const assistantCount = await page
          .locator("[data-message-role='assistant']")
          .count();
        const statusVisible = await page
          .locator("[aria-label*='LexFrame']")
          .filter({ hasText: /LexFrame/i })
          .first()
          .isVisible()
          .catch(() => false);

        return assistantCount > 0 || statusVisible;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

export async function waitForAssistantFinalOrControlledFailure(page: Page) {
  await expect
    .poll(
      async () => {
        if (await page.getByTestId("chat-stream-error").isVisible().catch(() => false)) {
          return "controlled-failure";
        }

        const assistantTexts = await page
          .locator("[data-message-role='assistant']")
          .allInnerTexts()
          .catch(() => []);

        return assistantTexts.some(
          (text) =>
            text.trim().length > 0 &&
            !/генер|обрабатывает|generating|processing/i.test(text),
        )
          ? "final"
          : "waiting";
      },
      { timeout: 45_000 },
    )
    .not.toBe("waiting");
}

export async function cancelChatRun(page: Page) {
  const cancel = page.getByRole("button", {
    name: /остановить|stop|cancel/i,
  });
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click();
    await expect(page.locator("body")).toContainText(/останов|cancel/i, {
      timeout: 10_000,
    });
  }
}

export async function reloadAndAssertRecovery(page: Page) {
  await page.reload();
  await expect(page.getByTestId("chat-composer-input")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator("body")).not.toContainText(/Unhandled Runtime Error/i);
}

export async function attachFileToComposer(page: Page, fileFixture: string) {
  const fileInput = page.locator("form input[type='file']").first();
  await fileInput.setInputFiles(fileFixture);
}

export async function assertNoDuplicateAssistantMessages(page: Page) {
  const assistantMessages = (
    await page.locator("[data-message-role='assistant']").allInnerTexts()
  ).map((message) => message.trim());
  const nonEmptyMessages = assistantMessages.filter(Boolean);

  expect(new Set(nonEmptyMessages).size).toBe(nonEmptyMessages.length);
}

export async function assertProjectChatScope(page: Page, projectId: string) {
  await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}/chats(?:/|$)`));
}

export async function assertGlobalChatScope(page: Page) {
  await expect(page).toHaveURL(/\/chat(?:\/[^/]+)?$/);
  expect(new URL(page.url()).pathname).not.toContain("/app/projects/");
}

export async function assertAttachmentChip(page: Page, filename: string) {
  await expect(page.getByTestId("chat-attachment-chip").filter({ hasText: filename })).toBeVisible({
    timeout: 10_000,
  });
}

export async function assertBranchSwitcherState(page: Page) {
  await expect(page.locator("[data-message-role='assistant']").filter({ hasText: /\d+\s*\/\s*\d+/ })).toBeVisible({
    timeout: 10_000,
  });
}

export async function assertDocumentUploadCompleted(page: Page, filename: string) {
  await expect(page.locator("body")).toContainText(filename, { timeout: 20_000 });
  await expect(page.locator("body")).toContainText(/completed|ready|upload/i, {
    timeout: 20_000,
  });
}

async function fetchFromBrowser<T>(
  page: Page,
  path: string,
  init: {
    readonly method?: string;
    readonly body?: Record<string, unknown>;
  } = {},
): Promise<T> {
  return page.evaluate(
    async ({ apiBaseUrl: baseUrl, init: fetchInit, path: apiPath }) => {
      const token = window.localStorage.getItem("lexframe.dev.access-token");
      if (!token) {
        throw new Error("Missing demo access token.");
      }

      const sessionResponse = await fetch(`${baseUrl}/session/context`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!sessionResponse.ok) {
        throw new Error(`Session context failed: ${sessionResponse.status}`);
      }

      const session = (await sessionResponse.json()) as {
        readonly activeWorkspace?: { readonly id?: string } | null;
      };
      const workspaceId = session.activeWorkspace?.id;
      if (!workspaceId) {
        throw new Error("Missing active workspace.");
      }

      const response = await fetch(`${baseUrl}${apiPath}`, {
        method: fetchInit.method ?? "GET",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-workspace-id": workspaceId,
        },
        body: fetchInit.body ? JSON.stringify(fetchInit.body) : undefined,
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`API ${apiPath} failed: ${response.status} ${text}`);
      }

      return text ? (JSON.parse(text) as T) : ({} as T);
    },
    { apiBaseUrl, init, path },
  );
}
