import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { getWorkspaceApiSession, type WorkspaceApiSession } from "../helpers/api";
import { assertRouteReady } from "./navigation";

const mswAutomationFixtureId = "aut_01hzyd8md4j4yhr40t1k0f8p9n";

export interface EnsuredAutomationCanvas {
  readonly automation_id: string;
  readonly route: string;
  readonly project_id?: string;
  readonly status?: string;
  readonly readiness_code?: string;
}

export async function openProjectAutomations(page: Page, projectId: string) {
  await page.goto(`/app/projects/${projectId}/automations`);
  await assertRouteReady(page, "automations");
}

export async function ensureAutomationCanvas(
  page: Page,
  request: APIRequestContext,
  projectId: string,
): Promise<EnsuredAutomationCanvas> {
  if (process.env.LEXFRAME_E2E_USE_MSW === "1") {
    return {
      automation_id: mswAutomationFixtureId,
      project_id: projectId,
      route: `/app/projects/${projectId}/automations/${mswAutomationFixtureId}/automation`,
      status: "ready",
      readiness_code: "MSW_FIXTURE",
    };
  }

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

  expect(response.status(), await response.text()).toBeLessThan(500);
  const payload = (await response.json()) as EnsuredAutomationCanvas;
  expect(payload.automation_id).toBeTruthy();
  expect(payload.route).toContain(`/app/projects/${projectId}/automations/`);
  return payload;
}

export async function openAutomationCanvas(
  page: Page,
  projectId: string,
  automationId: string,
) {
  await page.goto(`/app/projects/${projectId}/automations/${automationId}/automation`);
  await assertRouteReady(page, "automation-canvas");
}

export async function openEnsuredAutomationCanvas(
  page: Page,
  request: APIRequestContext,
  projectId: string,
) {
  const canvas = await ensureAutomationCanvas(page, request, projectId);
  await page.goto(canvas.route);
  await assertRouteReady(page, "automation-canvas");
  return canvas;
}

export async function openAutomationBuilder(page: Page, projectId: string) {
  await page.goto(`/app/projects/${projectId}/automation-builder`);
  await expect(page.locator("body")).toContainText(/Automation Builder|builder/i, {
    timeout: 20_000,
  });
}

export function runtimeHeaders(session: WorkspaceApiSession) {
  return {
    ...session.headers,
    "content-type": "application/json",
  };
}
