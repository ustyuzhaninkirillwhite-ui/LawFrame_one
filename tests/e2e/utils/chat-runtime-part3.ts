import { expect, type Page, type Request } from "@playwright/test";
import { signInAsDemo } from "../helpers/auth";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./console";
import { assertRouteReady } from "./navigation";
import {
  assertNoProjectFlowSecurityLeaks,
  installNetworkSecurityAssertions,
} from "./network-assertions";
import { waitForStableLayout } from "./navigation";

export const part3ProjectId =
  process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";
export const part3UseMsw = process.env.LEXFRAME_E2E_USE_MSW === "1";

export async function signInForChatPart3(page: Page, label: string) {
  installConsoleGuards(page);
  installNetworkSecurityAssertions(page);
  await signInAsDemo(page, {
    email: `part3-${label}-${Date.now()}@lexframe.local`,
    fullName: `Part3 ${label}`,
  });
  await waitForStableLayout(page).catch(() => undefined);
  await expect
    .poll(
      () =>
        page
          .evaluate(() => window.localStorage.getItem("lexframe.dev.access-token"))
          .catch(() => null),
      { timeout: 10_000 },
    )
    .toBeTruthy();
}

export async function openProjectChat(
  page: Page,
  projectId: string,
  threadId: string,
) {
  await gotoChatRouteWithManifestRetry(
    page,
    `/app/projects/${projectId}/chats/${threadId}`,
    "project-chat",
  );
  await expect(chatComposer(page)).toBeVisible({ timeout: 20_000 });
}

export async function openGlobalChat(page: Page, threadId: string) {
  await gotoChatRouteWithManifestRetry(page, `/chat/${threadId}`, "global-chat");
  await expect(chatComposer(page)).toBeVisible({ timeout: 20_000 });
}

export function chatComposer(page: Page) {
  return page.getByTestId("chat-composer-input");
}

export async function sendChatPrompt(page: Page, prompt: string) {
  await chatComposer(page).fill(prompt);
  await chatComposer(page).press("Enter");
}

export function userMessage(page: Page, text: string) {
  return page.locator("[data-message-role='user']").filter({ hasText: text });
}

export function assistantMessage(page: Page) {
  return page.locator("[data-message-role='assistant']");
}

export function streamError(page: Page) {
  return page.getByTestId("chat-stream-error");
}

export async function waitForUserVisible(page: Page, prompt: string) {
  await expect(userMessage(page, prompt)).toBeVisible({ timeout: 15_000 });
}

export async function waitForChatControlledOutcome(page: Page) {
  await expect
    .poll(
      async () => {
        if (await streamError(page).isVisible().catch(() => false)) {
          return "error";
        }

        const assistantTexts = await assistantMessage(page)
          .allInnerTexts()
          .catch(() => []);
        if (
          assistantTexts.some(
            (text) =>
              text.trim().length > 0 &&
              !/РіРµРЅРµСЂ|РѕР±СЂР°Р±Р°С‚|generating|processing/i.test(text),
          )
        ) {
          return "assistant";
        }

        if (
          await page
            .getByTestId("chat-running-status")
            .isVisible()
            .catch(() => false)
        ) {
          return "running";
        }

        return "waiting";
      },
      { timeout: 30_000 },
    )
    .not.toBe("waiting");
}

export async function assertNoDuplicateTextMessages(page: Page, text: string) {
  await expect(userMessage(page, text)).toHaveCount(1);
}

export async function assertNoChatRuntimeLeaks(page: Page) {
  await assertNoHydrationErrors(page);
  await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  await assertNoProjectFlowSecurityLeaks(page);
  await expect(page.locator("body")).not.toContainText(
    /raw provider|invalid token|authorization|bearer|service_role|BEGIN PRIVATE KEY|sk-[a-z0-9_-]{12,}|X-Amz-Signature|token=signed/i,
  );
}

export function recordRequests(
  page: Page,
  predicate: (request: Request) => boolean,
) {
  const requests: Request[] = [];
  page.on("request", (request) => {
    if (predicate(request)) {
      requests.push(request);
    }
  });
  return requests;
}

export function isChatStreamRequest(request: Request) {
  return (
    request.method() === "POST" &&
    /\/chat\/threads\/[^/]+\/messages:stream$/.test(new URL(request.url()).pathname)
  );
}

export function isAttachmentIntentRequest(request: Request) {
  return (
    request.method() === "POST" &&
    new URL(request.url()).pathname === "/chat/attachments/upload-intents"
  );
}

export async function setMswControl(
  page: Page,
  control: {
    readonly failures?: Record<
      string,
      {
        readonly status: number;
        readonly code: string;
        readonly message: string;
        readonly remaining?: number;
      }
    >;
    readonly delays?: Record<string, { readonly delayMs: number }>;
  },
) {
  await page.evaluate((nextControl) => {
    window.sessionStorage.setItem(
      "lexframe.e2e.block5.msw-control",
      JSON.stringify(nextControl),
    );
  }, control);
}

export async function installBackendRouteFailureOnce(
  page: Page,
  urlPattern: string,
  status: number,
  code: string,
  message: string,
) {
  let used = false;
  await page.route(urlPattern, async (route) => {
    if (used) {
      await route.fallback();
      return;
    }

    used = true;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({
        requestId: `part3-${code.toLowerCase()}`,
        error: { code, message, details: {} },
      }),
    });
  });
}

export async function fetchChatApiFromBrowser<T>(
  page: Page,
  path: string,
  init: {
    readonly method?: string;
    readonly body?: Record<string, unknown>;
  } = {},
): Promise<T> {
  const apiBaseUrl =
    process.env.LEXFRAME_E2E_USE_MSW === "1"
      ? new URL(page.url()).origin
      : process.env.LEXFRAME_API_BASE_URL ?? "http://127.0.0.1:3104";

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.evaluate(
        async ({ apiBaseUrl: baseUrl, init: requestInit, path: apiPath }) => {
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
            method: requestInit.method ?? "GET",
            headers: {
              authorization: `Bearer ${token}`,
              "content-type": "application/json",
              "x-workspace-id": workspaceId,
            },
            body: requestInit.body ? JSON.stringify(requestInit.body) : undefined,
          });
          const text = await response.text();
          if (!response.ok) {
            throw new Error(`API ${apiPath} failed: ${response.status} ${text}`);
          }

          return text ? (JSON.parse(text) as T) : ({} as T);
        },
        { apiBaseUrl, init, path },
      );
    } catch (error) {
      lastError = error;
      const message = String(error);
      const shouldRetry =
        /Execution context was destroyed|Cannot find context with specified id/i.test(
          message,
        ) ||
        (part3UseMsw && /Session context failed: 404/i.test(message));

      if (!shouldRetry) {
        throw error;
      }

      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page
        .waitForFunction(
          () =>
            (window as Window & { __LEXFRAME_MSW_READY?: boolean })
              .__LEXFRAME_MSW_READY === true,
          undefined,
          { timeout: 5_000 },
        )
        .catch(() => undefined);
      await waitForStableLayout(page).catch(() => undefined);
    }
  }

  throw lastError;
}

async function gotoChatRouteWithManifestRetry(
  page: Page,
  url: string,
  routeKind: "project-chat" | "global-chat",
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto(url, { waitUntil: "commit" });
    try {
      await assertRouteReady(page, routeKind);
      return;
    } catch (error) {
      const isManifestRace = await page
        .getByRole("dialog", { name: /Runtime SyntaxError/i })
        .filter({ hasText: /Unexpected end of JSON input/i })
        .isVisible()
        .catch(() => false);

      if (!isManifestRace || attempt > 0) {
        throw error;
      }

      await page.reload({ waitUntil: "commit" }).catch(() => undefined);
      await waitForStableLayout(page).catch(() => undefined);
    }
  }
}

export async function createProjectChatForPart3(page: Page, projectId: string) {
  const result = await fetchChatApiFromBrowser<{
    readonly chat: { readonly id: string; readonly projectId: string };
  }>(page, `/projects/${projectId}/chats`, {
    method: "POST",
    body: {
      title: `Part3 project chat ${Date.now()}`,
      source: "project_chat",
    },
  });

  expect(result.chat.projectId).toBe(projectId);
  return result.chat.id;
}

export async function createGlobalChatForPart3(page: Page) {
  const result = await fetchChatApiFromBrowser<{
    readonly thread: { readonly id: string; readonly projectId: string | null };
  }>(page, "/chat/threads", {
    method: "POST",
    body: {
      title: `Part3 global chat ${Date.now()}`,
      kind: "general",
    },
  });

  expect(result.thread.projectId).toBeNull();
  return result.thread.id;
}
