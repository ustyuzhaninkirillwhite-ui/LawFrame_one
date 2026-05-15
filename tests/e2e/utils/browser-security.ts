import { expect, type Page } from "@playwright/test";
import { readBrowserStorage } from "./storage";
import {
  installNetworkSecurityScan,
  networkSecuritySnapshot,
  scanNetworkForForbiddenHosts,
} from "./network-security";
import { writeJsonArtifact } from "./evidence";

const secretLikePattern =
  /(OPENAI_API_KEY|COMETAPI_API_KEY|XAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY|DEEPSEEK_API_KEY|ACTIVEPIECES_API_KEY|ACTIVEPIECES_SIGNING_PRIVATE_KEY|AP_JWT_SECRET|AP_ENCRYPTION_KEY|SUPABASE_SERVICE_ROLE|SUPABASE_SECRET_KEY|LEXFRAME_RUNTIME_MASTER_SECRET|BEGIN PRIVATE KEY|Authorization:\s*Bearer|sk-[A-Za-z0-9_-]{12,}|xai-[A-Za-z0-9_-]{12,})/i;
const jwtLikePattern = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;
const signedUrlLikePattern =
  /(\/storage\/v1\/object\/sign\/|[?&](token|X-Amz-Signature|X-Amz-Credential)=)/i;

interface BrowserSecurityState {
  readonly consoleLeaks: string[];
}

const states = new WeakMap<Page, BrowserSecurityState>();

export function installBrowserSecurityScan(page: Page) {
  if (states.has(page)) {
    return;
  }

  states.set(page, { consoleLeaks: [] });
  installNetworkSecurityScan(page);
  page.on("console", (message) => {
    const text = message.text();
    if (secretLikePattern.test(text) || /authorization\s*:/i.test(text)) {
      states.get(page)?.consoleLeaks.push(text.slice(0, 240));
    }
  });
}

export async function scanDomForSecretLikeStrings(page: Page) {
  const payload = await page.evaluate(() => ({
    text: document.body?.innerText ?? "",
    htmlAttributes: Array.from(document.querySelectorAll("*")).flatMap((node) =>
      Array.from(node.attributes).map((attribute) => [
        node.tagName,
        attribute.name,
        attribute.value,
      ]),
    ),
    scripts: Array.from(document.scripts).map((script) => script.textContent ?? ""),
  }));
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toMatch(secretLikePattern);
  expect(serialized).not.toMatch(jwtLikePattern);
  return { status: "pass" as const };
}

export async function scanStorageForSecretLikeStrings(page: Page) {
  const storage = JSON.stringify(await readBrowserStorage(page));
  expect(storage).not.toMatch(secretLikePattern);
  expect(storage).not.toMatch(signedUrlLikePattern);
  expect(storage).not.toMatch(jwtLikePattern);
  return { status: "pass" as const };
}

export async function scanConsoleForSensitiveStrings(page: Page) {
  installBrowserSecurityScan(page);
  const leaks = states.get(page)?.consoleLeaks ?? [];
  expect(leaks).toEqual([]);
  return { status: "pass" as const, leaks };
}

export { scanNetworkForForbiddenHosts };

export async function writeBrowserSecurityScanArtifact(page: Page) {
  const scan = {
    generatedAt: new Date().toISOString(),
    route: new URL(page.url()).pathname,
    dom: await scanDomForSecretLikeStrings(page),
    storage: await scanStorageForSecretLikeStrings(page),
    console: await scanConsoleForSensitiveStrings(page),
    network: await scanNetworkForForbiddenHosts(page),
    snapshot: networkSecuritySnapshot(page),
  };
  writeJsonArtifact("block5-security", "browser-security-scan", scan);
  return scan;
}
