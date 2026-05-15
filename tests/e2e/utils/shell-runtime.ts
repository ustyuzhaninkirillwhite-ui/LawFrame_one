import { expect, type Locator, type Page, type Request, type Route } from "@playwright/test";
import { assertNoBrowserNetworkSecretLeaks, assertNoDirectProviderBrowserCalls } from "./network-assertions";
import { readBrowserStorage } from "./storage";

type RequestMatcher = RegExp | string | ((request: Request) => boolean);

interface NetworkSummaryState {
  readonly requests: string[];
  readonly failures: string[];
  readonly responses: Record<string, number>;
}

const networkStates = new WeakMap<Page, NetworkSummaryState>();

const secretLikePattern =
  /(ACTIVEPIECES_API_KEY|ACTIVEPIECES_SIGNING_PRIVATE_KEY|AP_JWT_SECRET|AP_ENCRYPTION_KEY|OPENAI_API_KEY|COMETAPI_API_KEY|TAVILY_API_KEY|SUPABASE_SERVICE_ROLE|service_role|BEGIN PRIVATE KEY|Authorization:\s*Bearer|x-api-key|signedUrl|X-Amz-Signature)/i;
const activepiecesJwtPattern =
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*ImFjdGl2ZXBpZWNlcyI[A-Za-z0-9_-]*\.[A-Za-z0-9_-]{4,}/;

export function installNetworkSummary(page: Page) {
  if (networkStates.has(page)) {
    return;
  }

  const state: NetworkSummaryState = {
    requests: [],
    failures: [],
    responses: {},
  };
  networkStates.set(page, state);

  page.on("request", (request) => {
    state.requests.push(request.url());
  });
  page.on("requestfailed", (request) => {
    state.failures.push(`${request.method()} ${request.url()}`);
  });
  page.on("response", (response) => {
    const key = `${response.request().method()} ${new URL(response.url()).pathname}`;
    state.responses[key] = (state.responses[key] ?? 0) + 1;
  });
}

export async function collectNetworkSummary(page: Page) {
  installNetworkSummary(page);
  const state = networkStates.get(page)!;
  return {
    totalRequests: state.requests.length,
    failedRequests: [...state.failures],
    responses: { ...state.responses },
    repeatedResponses: Object.fromEntries(
      Object.entries(state.responses).filter(([, count]) => count > 3),
    ),
  };
}

export async function assertNoForbiddenBrowserRequests(page: Page) {
  await assertNoDirectProviderBrowserCalls(page);
  await assertNoBrowserNetworkSecretLeaks(page);
}

export async function assertNoSecretLikeStringsInDomAndStorage(page: Page) {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  expect(bodyText).not.toMatch(secretLikePattern);
  expect(bodyText).not.toMatch(activepiecesJwtPattern);

  const storage = await readBrowserStorage(page);
  const sanitizedStorage = {
    ...storage,
    localStorage: Object.fromEntries(
      Object.entries(storage.localStorage).filter(
        ([key]) => key !== "lexframe.dev.access-token",
      ),
    ),
  };
  const serialized = JSON.stringify(sanitizedStorage);
  expect(serialized).not.toMatch(secretLikePattern);
  expect(serialized).not.toMatch(activepiecesJwtPattern);
}

export async function waitForShellReady(page: Page) {
  await expect(page.getByTestId("app-shell-root")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("project-sidebar")).toBeVisible({
    timeout: 20_000,
  });
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.localStorage.getItem("lexframe.dev.access-token"),
        ),
      { timeout: 15_000 },
    )
    .toBeTruthy();
}

export async function waitForRouteSettled(page: Page) {
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(
    () => undefined,
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

export function countRequestsMatching(page: Page, matcher: RequestMatcher) {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (matchesRequest(request, matcher)) {
      urls.push(request.url());
    }
  });
  return {
    urls,
    count: () => urls.length,
  };
}

export async function assertMainReceivesPointerEvents(page: Page) {
  const result = await page.getByTestId("app-shell-main").evaluate((main) => {
    const box = main.getBoundingClientRect();
    const x = Math.min(Math.max(box.left + box.width / 2, 1), window.innerWidth - 1);
    const y = Math.min(Math.max(box.top + Math.min(box.height / 2, 200), 1), window.innerHeight - 1);
    const target = document.elementFromPoint(x, y);
    return {
      receivesPointerEvents: Boolean(
        target && (main === target || main.contains(target)),
      ),
      targetTag: target?.tagName ?? null,
      targetTestId: target?.getAttribute("data-testid") ?? null,
    };
  });

  expect(result.receivesPointerEvents, JSON.stringify(result)).toBe(true);
}

export async function measureClickToVisible(
  page: Page,
  action: () => Promise<void>,
  locator: Locator,
) {
  const startedAt = Date.now();
  await action();
  await expect(locator).toBeVisible({ timeout: 15_000 });
  await waitForRouteSettled(page);
  return Date.now() - startedAt;
}

export async function withApiDelay(
  page: Page,
  urlPattern: RegExp | string,
  delayMs: number,
) {
  await page.route(urlPattern, async (route) => {
    await delay(delayMs);
    await route.continue();
  });
}

export async function withApiFailureOnce(
  page: Page,
  urlPattern: RegExp | string,
  status: number,
  payload: unknown,
) {
  let consumed = false;
  await page.route(urlPattern, async (route) => {
    if (consumed) {
      await route.continue();
      return;
    }
    consumed = true;
    await fulfillJson(route, status, payload);
  });
}

function matchesRequest(request: Request, matcher: RequestMatcher) {
  if (typeof matcher === "function") {
    return matcher(request);
  }
  return typeof matcher === "string"
    ? request.url().includes(matcher)
    : matcher.test(request.url());
}

function fulfillJson(route: Route, status: number, payload: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
