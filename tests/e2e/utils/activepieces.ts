import { expect, type Locator, type Page, type Response } from "@playwright/test";
import { readBrowserStorage } from "./storage";

const forbiddenEmbedSecretPattern =
  /(ACTIVEPIECES_API_KEY|ACTIVEPIECES_SIGNING_PRIVATE_KEY|AP_JWT_SECRET|AP_ENCRYPTION_KEY|LEXFRAME_RUNTIME_MASTER_SECRET|SUPABASE_SERVICE_ROLE|service_role|BEGIN PRIVATE KEY|sk-[A-Za-z0-9_-]{12,}|xai-[A-Za-z0-9_-]{12,})/i;

export interface ActivepiecesStoredJwt {
  readonly storageName: "localStorage" | "sessionStorage";
  readonly key: string;
  readonly issuer: string;
  readonly expiresAt: number | null;
  readonly valueLength: number;
}

export async function waitForActivepiecesIframe(page: Page): Promise<Locator> {
  await expect(page.getByTestId("activepieces-canvas-container")).toBeVisible({
    timeout: 45_000,
  });
  const iframe = page.getByTestId("activepieces-canvas-container").locator("iframe").first();
  await expect(iframe).toBeVisible({ timeout: 45_000 });
  await expect
    .poll(() => readVisibleBuilderFrameState(page), { timeout: 45_000 })
    .toBe("visible");
  return iframe;
}

export async function waitForBuilderSurface(page: Page) {
  await expect
    .poll(
      async () => {
        if (await page.getByTestId("builder-unavailable-state").isVisible().catch(() => false)) {
          return "controlled-unavailable";
        }
        if (await page.getByTestId("activepieces-canvas-container").isVisible().catch(() => false)) {
          const frameState = await readVisibleBuilderFrameState(page);
          return frameState === "visible" ? "iframe" : frameState;
        }
        return "waiting";
      },
      { timeout: 45_000 },
    )
    .not.toBe("waiting");

  if (await page.getByTestId("activepieces-canvas-container").isVisible().catch(() => false)) {
    await expect
      .poll(() => readBuilderFrameText(page), { timeout: 45_000 })
      .toMatch(
        /Runs|Versions|Test Flow|Manual Trigger|Flow Builder|Ручной запуск|Запуски|Версии|Тест/i,
      );
  }
}

export async function assertNotActivepiecesLogin(page: Page) {
  await expect(page.locator("body")).not.toContainText(/activepieces login|sign in to activepieces/i);
  const iframe = page.getByTestId("activepieces-canvas-container").locator("iframe").first();
  const handle = await iframe.elementHandle().catch(() => null);
  const frame = await handle?.contentFrame().catch(() => null);
  if (frame) {
    await expect(frame.locator("body")).not.toContainText(
      /activepieces login|sign in|invalid access/i,
    );
  }
}

export async function assertActivepiecesSessionRequested(
  page: Page,
): Promise<Response> {
  const response = await page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "POST" &&
      candidate.url().includes("/activepieces/session"),
    { timeout: 45_000 },
  );
  expect(response.status(), await response.text()).toBeLessThan(500);
  return response;
}

export function assertEmbedConfigSafe(payload: unknown) {
  const record = payload as Record<string, unknown>;
  const scrubbed = JSON.stringify(record, (key, value) => {
    if (/jwt_token|jwtToken|token$/i.test(key)) {
      return "[runtime-embed-token]";
    }
    return value;
  });

  expect(scrubbed).not.toMatch(forbiddenEmbedSecretPattern);
  expect(record).not.toHaveProperty("apiKey");
  expect(record).not.toHaveProperty("activepiecesApiKey");
  expect(record).not.toHaveProperty("signingPrivateKey");
  expect(record).not.toHaveProperty("providerKey");
}

export async function assertRouteFamilyTokenRetention(page: Page) {
  const url = new URL(page.url());
  expect(url.pathname).toMatch(/\/app\/projects\/[^/]+\/automations\/[^/]+\/automation/);
  const apTokens = await scanStorageForActivepiecesJwt(page);
  for (const token of apTokens) {
    expect(token.issuer).toMatch(/activepieces|unknown/i);
    expect(token.valueLength).toBeLessThan(4096);
  }
}

export async function assertTokensClearedAfterLeavingAutomationFamily(page: Page) {
  await expect
    .poll(async () => (await scanStorageForActivepiecesJwt(page)).length, {
      timeout: 10_000,
    })
    .toBe(0);
}

export async function scanStorageForActivepiecesJwt(
  page: Page,
): Promise<ActivepiecesStoredJwt[]> {
  return page.evaluate(() => {
    const jwtLike = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;
    const storages = [
      ["localStorage", window.localStorage] as const,
      ["sessionStorage", window.sessionStorage] as const,
    ];

    return storages.flatMap(([storageName, storage]) =>
      Array.from({ length: storage.length }, (_, index) => {
        const key = storage.key(index) ?? "";
        const value = storage.getItem(key) ?? "";
        const match = value.match(jwtLike)?.[0] ?? null;
        if (!match) {
          return null;
        }
        let issuer = "unknown";
        let expiresAt: number | null = null;
        try {
          const payload = JSON.parse(atob(match.split(".")[1] ?? ""));
          issuer = String(payload.iss ?? payload.issuer ?? "unknown");
          expiresAt = typeof payload.exp === "number" ? payload.exp : null;
        } catch {
          issuer = "unknown";
        }
        return {
          storageName,
          key,
          issuer,
          expiresAt,
          valueLength: match.length,
        };
      }).filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    );
  });
}

export async function assertNoActivepiecesServerSecretsInStorage(page: Page) {
  const storage = JSON.stringify(await readBrowserStorage(page));
  expect(storage).not.toMatch(forbiddenEmbedSecretPattern);
}

async function readVisibleBuilderFrameState(page: Page) {
  return page.evaluate(() => {
    const container = document.querySelector<HTMLElement>(
      '[data-testid="activepieces-canvas-container"]',
    );
    const iframe = container?.querySelector<HTMLIFrameElement>("iframe") ?? null;
    if (!container || !iframe) {
      return "missing";
    }

    const containerBox = container.getBoundingClientRect();
    const iframeBox = iframe.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const minVisibleSize = 120;
    const visible =
      containerBox.width >= minVisibleSize &&
      containerBox.height >= minVisibleSize &&
      iframeBox.width >= minVisibleSize &&
      iframeBox.height >= minVisibleSize &&
      iframeBox.right > 0 &&
      iframeBox.bottom > 0 &&
      iframeBox.left < viewportWidth &&
      iframeBox.top < viewportHeight;

    return visible ? "visible" : "offscreen";
  });
}

async function readBuilderFrameText(page: Page) {
  const iframe = page.getByTestId("activepieces-canvas-container").locator("iframe").first();
  const handle = await iframe.elementHandle().catch(() => null);
  const frame = await handle?.contentFrame().catch(() => null);
  if (!frame) {
    return "";
  }

  return frame.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
}
