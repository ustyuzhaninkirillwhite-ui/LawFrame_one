import {
  expect,
  type APIRequestContext,
  type Page,
  type Request,
  type Route,
} from "@playwright/test";
import { getWorkspaceApiSession } from "../helpers/api";
import { signInAsDemo } from "../helpers/auth";
import { assertRouteReady } from "./navigation";
import { projectTabNamePattern } from "./project-workspace";

export type ProjectWorkspaceTab = keyof typeof projectTabNamePattern;

export interface RecordedRequest {
  readonly method: string;
  readonly pathname: string;
  readonly url: string;
}

export const isMswE2eRun = process.env.LEXFRAME_E2E_USE_MSW === "1";
const mswControlStorageKey = "lexframe.e2e.block5.msw-control";

export async function signInForProjectWorkspace(page: Page, label: string) {
  await signInAsDemo(page, {
    email: `${label}-${Date.now()}@lexframe.local`,
    fullName: label,
  });
}

export async function openProjectWorkspaceRoute(page: Page, projectId: string) {
  await page.goto(`/app/projects/${projectId}`, { waitUntil: "commit" });
  await assertRouteReady(page, "project-workspace");
}

export async function openProjectWorkspaceTab(
  page: Page,
  tab: ProjectWorkspaceTab,
) {
  await projectTab(page, tab).click();
  await expect(projectTab(page, tab)).toHaveAttribute("aria-selected", "true");
}

export function projectShell(page: Page) {
  return page.getByTestId("project-workspace-shell");
}

export function projectTab(page: Page, tab: ProjectWorkspaceTab) {
  return page.getByRole("tab", { name: projectTabNamePattern[tab] });
}

export function composerInput(page: Page) {
  return page.getByTestId("project-composer-input");
}

export function sendButton(page: Page) {
  return page.getByTestId("project-composer-send");
}

export function plusButton(page: Page) {
  return page.getByTestId("project-plus-button");
}

export function projectFileInput(page: Page) {
  return page.getByTestId("project-file-input");
}

export function webSearchPanel(page: Page) {
  return page.getByTestId("project-web-search-panel");
}

export async function openPlusMenu(page: Page) {
  await plusButton(page).click();
  await expect(page.getByTestId("project-plus-menu")).toBeVisible();
}

export async function openWebSearchPanel(page: Page) {
  await openPlusMenu(page);
  await page.getByTestId("project-plus-menu").getByRole("button").nth(2).click();
  await expect(webSearchPanel(page)).toBeVisible();
}

export async function openAutomationPicker(page: Page) {
  await openPlusMenu(page);
  await page.getByTestId("project-plus-menu").getByRole("button").nth(3).click();
  await expect(page.getByTestId("project-automation-picker")).toBeVisible();
}

export function recordRequests(
  page: Page,
  predicate: (request: Request) => boolean,
) {
  const requests: RecordedRequest[] = [];
  page.on("request", (request) => {
    if (!predicate(request)) {
      return;
    }
    const url = new URL(request.url());
    requests.push({
      method: request.method(),
      pathname: url.pathname,
      url: request.url(),
    });
  });
  return requests;
}

export function isProjectEndpoint(projectId: string, suffix: string) {
  return (request: Request) => {
    const url = new URL(request.url());
    return url.pathname === `/projects/${projectId}${suffix}`;
  };
}

export function isProjectChatCreate(projectId: string) {
  return (request: Request) =>
    request.method() === "POST" &&
    isProjectEndpoint(projectId, "/chats")(request);
}

export function isProjectKnowledge(projectId: string) {
  return (request: Request) =>
    request.method() === "GET" &&
    isProjectEndpoint(projectId, "/knowledge")(request);
}

export function isProjectAutomations(projectId: string) {
  return (request: Request) =>
    request.method() === "GET" &&
    isProjectEndpoint(projectId, "/automations")(request);
}

export function isProjectSnapshot(projectId: string) {
  return (request: Request) =>
    request.method() === "GET" &&
    isProjectEndpoint(projectId, "/snapshot")(request);
}

export function isProjectWebSearch(projectId: string) {
  return (request: Request) =>
    request.method() === "POST" &&
    isProjectEndpoint(projectId, "/web-search")(request);
}

export async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function assertNoWorkspaceSkeleton(page: Page) {
  await expect(projectShell(page).getByTestId("project-skeleton-rows")).toHaveCount(0);
}

export function projectKnowledgeItem(input: {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly url: string;
  readonly summary?: string;
}) {
  const timestamp = new Date().toISOString();
  return {
    id: input.id,
    workspaceId: "workspace_demo",
    projectId: input.projectId,
    sourceType: "web_search_result",
    sourceId: input.id.replace(/^knowledge_/, "web_"),
    title: input.title,
    summary: input.summary ?? "Deterministic project source",
    url: input.url,
    mode: "reference_only",
    classification: "public",
    pinned: false,
    enabledForChat: true,
    citationRequired: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function setMswControls(
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
  await page.evaluate(
    ({ key, value }) => {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    },
    { key: mswControlStorageKey, value: control },
  );
}

export async function createProjectViaApi(
  page: Page,
  request: APIRequestContext,
  name: string,
) {
  const session = await getWorkspaceApiSession(page, request);
  const response = await request.post(`${session.apiBaseUrl}/projects`, {
    headers: session.headers,
    data: {
      name,
      description: "Part2 project workspace switch target",
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const payload = (await response.json()) as { readonly project?: { readonly id?: string } };
  expect(payload.project?.id).toBeTruthy();
  return payload.project!.id!;
}
