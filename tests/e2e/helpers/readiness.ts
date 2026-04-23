import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { getWorkspaceApiSession } from "./api";

interface ReadinessDetailsPayload {
  readonly profile: string;
  readonly effectiveProfile: string;
  readonly contractSatisfied: boolean;
  readonly allowReadinessGateBlocked: boolean;
  readonly blockedReasons?: readonly string[];
}

export async function expectReadinessProfile(
  page: Page,
  request: APIRequestContext,
  expectedProfile: string,
) {
  expect(process.env.LEXFRAME_READINESS_PROFILE).toBe(expectedProfile);

  const session = await getWorkspaceApiSession(page, request);
  const response = await request.get(
    `${session.apiBaseUrl}/health/readiness/details`,
    {
      headers: session.headers,
    },
  );

  expect(response.ok()).toBeTruthy();

  const payload = (await response.json()) as ReadinessDetailsPayload;
  expect(payload.profile).toBe(expectedProfile);
  expect(payload.effectiveProfile).toBe(expectedProfile);
  expect(
    payload.contractSatisfied,
    `Readiness contract is blocked: ${JSON.stringify(
      payload.blockedReasons ?? [],
    )}`,
  ).toBeTruthy();

  if (expectedProfile === "local-integrated") {
    expect(payload.allowReadinessGateBlocked).toBeFalsy();
  }

  return payload;
}
