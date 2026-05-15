import { expect, type Page, type Request } from "@playwright/test";
import { assertNoSecretsInBrowserStorage, readBrowserStorage } from "./storage";

const directProviderHostPattern =
  /(api\.openai\.com|openai\.azure\.com|api\.cometapi\.com|api\.x\.ai|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.tavily\.com|tavily\.com)/i;
const serverSecretPattern =
  /(service_role|SUPABASE_SERVICE_ROLE|ACTIVEPIECES_API_KEY|BEGIN PRIVATE KEY|LEXFRAME_RUNTIME_MASTER_SECRET|SUPABASE_SECRET_KEY|COMETAPI_API_KEY|OPENAI_API_KEY|TAVILY_API_KEY)/i;
const jwtLikePattern = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;
const signedUrlLikePattern =
  /(\/storage\/v1\/object\/sign\/|[?&](token|X-Amz-Signature|X-Amz-Credential)=)/i;

interface NetworkState {
  readonly directProviderCalls: string[];
  readonly secretLeaks: string[];
  readonly consoleLeaks: string[];
}

const states = new WeakMap<Page, NetworkState>();
const installed = new WeakSet<Page>();

export function installNetworkSecurityAssertions(page: Page) {
  if (installed.has(page)) {
    return;
  }

  installed.add(page);
  const state: NetworkState = {
    directProviderCalls: [],
    secretLeaks: [],
    consoleLeaks: [],
  };
  states.set(page, state);

  page.on("request", (request) => inspectRequest(request, state));
  page.on("console", (message) => {
    const text = message.text();
    if (/authorization\s*:/i.test(text) || serverSecretPattern.test(text)) {
      state.consoleLeaks.push(text);
    }
  });
}

export async function assertNoDirectProviderBrowserCalls(page: Page) {
  installNetworkSecurityAssertions(page);
  expect(states.get(page)?.directProviderCalls ?? []).toEqual([]);
}

export async function assertNoBrowserNetworkSecretLeaks(page: Page) {
  installNetworkSecurityAssertions(page);
  expect(states.get(page)?.secretLeaks ?? []).toEqual([]);
  expect(states.get(page)?.consoleLeaks ?? []).toEqual([]);
}

export async function assertNoJwtInDom(page: Page) {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  expect(bodyText).not.toMatch(jwtLikePattern);
}

export async function assertNoSignedUrlInBrowserStorage(page: Page) {
  const storage = JSON.stringify(await readBrowserStorage(page));
  expect(storage).not.toMatch(signedUrlLikePattern);
}

export async function assertNoProjectFlowSecurityLeaks(page: Page) {
  await assertNoDirectProviderBrowserCalls(page);
  await assertNoBrowserNetworkSecretLeaks(page);
  await assertNoSecretsInBrowserStorage(page);
  await assertNoJwtInDom(page);
  await assertNoSignedUrlInBrowserStorage(page);
}

function inspectRequest(request: Request, state: NetworkState) {
  const url = request.url();
  const headers = request.headers();
  const postData = request.postData() ?? "";

  if (directProviderHostPattern.test(url)) {
    state.directProviderCalls.push(url);
  }

  const serialized = JSON.stringify({ url, headers, postData });
  if (serverSecretPattern.test(serialized)) {
    state.secretLeaks.push(url);
  }

  if (
    directProviderHostPattern.test(url) &&
    typeof headers.authorization === "string"
  ) {
    state.secretLeaks.push(`${url} authorization`);
  }
}
