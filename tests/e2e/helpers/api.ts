import { expect, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl = process.env.LEXFRAME_API_BASE_URL ?? "http://127.0.0.1:3100";

interface SessionContextPayload {
  readonly activeWorkspace: {
    readonly id: string;
  } | null;
}

export interface WorkspaceApiSession {
  readonly apiBaseUrl: string;
  readonly token: string;
  readonly workspaceId: string;
  readonly headers: {
    readonly authorization: string;
    readonly "x-workspace-id": string;
  };
}

export async function getWorkspaceApiSession(
  page: Page,
  request: APIRequestContext,
): Promise<WorkspaceApiSession> {
  const token = await page.evaluate(() =>
    window.localStorage.getItem("lexframe.dev.access-token"),
  );

  expect(token).toBeTruthy();

  const sessionResponse = await request.get(`${apiBaseUrl}/session/context`, {
    headers: {
      authorization: `Bearer ${token!}`,
    },
  });

  expect(sessionResponse.ok()).toBeTruthy();

  const sessionContext =
    (await sessionResponse.json()) as SessionContextPayload;
  const workspaceId = sessionContext.activeWorkspace?.id ?? null;

  expect(workspaceId).toBeTruthy();

  return {
    apiBaseUrl,
    token: token!,
    workspaceId: workspaceId!,
    headers: {
      authorization: `Bearer ${token!}`,
      "x-workspace-id": workspaceId!,
    },
  };
}
