import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { getWorkspaceApiSession } from "../helpers/api";

export async function readRunEvidenceFromApiOrDb(
  page: Page,
  request: APIRequestContext,
  runId?: string,
) {
  const session = await getWorkspaceApiSession(page, request);
  const url = runId
    ? `${session.apiBaseUrl}/runs/${runId}`
    : `${session.apiBaseUrl}/runs`;
  const response = await request.get(url, {
    headers: session.headers,
  });

  expect(response.status(), await response.text()).toBeLessThan(500);
  return response.json();
}

export function assertRunEvidenceSafe(payload: unknown) {
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toMatch(
    /(ACTIVEPIECES_API_KEY|LEXFRAME_RUNTIME_MASTER_SECRET|BEGIN PRIVATE KEY|service_role|sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,})/i,
  );
}
