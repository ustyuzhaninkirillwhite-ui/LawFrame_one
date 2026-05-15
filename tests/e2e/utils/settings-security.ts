import { expect, type Page, type Request, type Response } from "@playwright/test";
import { readBrowserStorage } from "./storage";

const directProviderHostPattern =
  /(api\.openai\.com|openai\.azure\.com|api\.cometapi\.com|api\.x\.ai|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.deepseek\.com)/i;
const secretLikePattern =
  /(OPENAI_API_KEY|COMETAPI_API_KEY|XAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY|DEEPSEEK_API_KEY|ACTIVEPIECES_API_KEY|SUPABASE_SERVICE_ROLE|BEGIN PRIVATE KEY|sk-[A-Za-z0-9_-]{12,}|xai-[A-Za-z0-9_-]{12,})/i;

interface SettingsSecurityState {
  readonly marker: string;
  readonly directProviderCalls: string[];
  readonly disallowedMarkerRequests: string[];
  readonly markerResponseLeaks: string[];
  readonly consoleLeaks: string[];
}

const states = new WeakMap<Page, SettingsSecurityState>();

export function installSettingsSecurityScan(page: Page, marker: string) {
  if (states.has(page)) {
    return;
  }

  const state: SettingsSecurityState = {
    marker,
    directProviderCalls: [],
    disallowedMarkerRequests: [],
    markerResponseLeaks: [],
    consoleLeaks: [],
  };
  states.set(page, state);
  page.on("request", (request) => inspectRequest(request, state));
  page.on("response", (response) => {
    void inspectResponse(response, state);
  });
  page.on("console", (message) => {
    const text = message.text();
    if (
      text.includes("Request {url:") &&
      text.includes("[REDACTED]") &&
      !text.includes(marker)
    ) {
      return;
    }
    if (text.includes(marker) || secretLikePattern.test(text)) {
      state.consoleLeaks.push(redactedConsoleSummary(text));
    }
  });
}

export async function assertSettingsSecretNotExposed(page: Page, marker: string) {
  const state = states.get(page);
  expect(state?.directProviderCalls ?? []).toEqual([]);
  expect(state?.disallowedMarkerRequests ?? []).toEqual([]);
  expect(state?.markerResponseLeaks ?? []).toEqual([]);
  expect(state?.consoleLeaks ?? []).toEqual([]);

  const storage = JSON.stringify(await readBrowserStorage(page));
  expect(storage).not.toContain(marker);
  expect(storage).not.toMatch(secretLikePattern);

  const body = await page.locator("body").innerText().catch(() => "");
  expect(body).not.toContain(marker);
  expect(body).not.toMatch(secretLikePattern);
}

export function settingsSecuritySnapshot(page: Page) {
  const state = states.get(page);
  return {
    directProviderCalls: [...(state?.directProviderCalls ?? [])],
    disallowedMarkerRequests: [...(state?.disallowedMarkerRequests ?? [])],
    markerResponseLeaks: [...(state?.markerResponseLeaks ?? [])],
    consoleLeaks: [...(state?.consoleLeaks ?? [])],
  };
}

function inspectRequest(request: Request, state: SettingsSecurityState) {
  const url = request.url();
  const parsed = new URL(url);
  const method = request.method();
  const headers = request.headers();
  const postData = request.postData() ?? "";

  if (directProviderHostPattern.test(url)) {
    state.directProviderCalls.push(`${method} ${parsed.host}${parsed.pathname}`);
  }

  const markerInUrlOrHeaders =
    url.includes(state.marker) ||
    Object.values(headers).some((value) => value.includes(state.marker));
  if (markerInUrlOrHeaders) {
    state.disallowedMarkerRequests.push(`${method} ${parsed.host}${parsed.pathname}`);
    return;
  }

  if (postData.includes(state.marker) && !isAllowedSecretWriteRequest(request)) {
    state.disallowedMarkerRequests.push(`${method} ${parsed.host}${parsed.pathname}`);
  }
}

async function inspectResponse(response: Response, state: SettingsSecurityState) {
  const request = response.request();
  const parsed = new URL(response.url());
  if (parsed.pathname.startsWith("/_next/")) {
    return;
  }

  const contentType = response.headers()["content-type"] ?? "";
  if (!/json|text|html/i.test(contentType)) {
    return;
  }

  try {
    const text = await response.text();
    if (text.includes(state.marker)) {
      state.markerResponseLeaks.push(`${request.method()} ${parsed.host}${parsed.pathname}`);
    }
  } catch {
    // Streamed responses may not be readable after completion.
  }
}

function isAllowedSecretWriteRequest(request: Request) {
  const parsed = new URL(request.url());
  if (request.method() !== "POST") {
    return false;
  }

  return (
    parsed.pathname.endsWith("/settings/ai/provider-connections") ||
    /\/settings\/ai\/provider-connections\/[^/]+\/secret$/.test(parsed.pathname)
  );
}

function redactedConsoleSummary(text: string) {
  return text
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[REDACTED]")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}
