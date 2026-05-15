import { expect, test, type Page, type Response } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { assertNoBlockingOverlay } from "./utils/clickability";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import {
  assertEmbedConfigSafe,
  assertNotActivepiecesLogin,
  waitForActivepiecesIframe,
  waitForBuilderSurface,
} from "./utils/activepieces";
import { ensureAutomationCanvas } from "./utils/automation";
import {
  assertNoAutomationBrowserSecrets,
  installAutomationBrowserSecretScan,
} from "./utils/browser-secret-scan";
import { openProjectTab } from "./utils/project-workspace";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block4 automation Activepieces Canvas full flow", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    installAutomationBrowserSecretScan(page);
    await signInAsDemo(page, {
      email: `block4-canvas-${Date.now()}@lexframe.local`,
      fullName: "Block4 Canvas User",
    });
  });

  test("opens an embedded builder through LexFrame route without AP login or secret exposure", async ({
    page,
    request,
  }) => {
    const canvas = await ensureAutomationCanvas(page, request, projectId);
    const sessionResponses: Response[] = [];
    page.on("response", (response) => {
      if (
        response.request().method() === "POST" &&
        response.url().includes("/activepieces/session")
      ) {
        sessionResponses.push(response);
      }
    });

    await page.goto(canvas.route);
    await waitForBuilderSurface(page);

    if (await page.getByTestId("activepieces-canvas-container").isVisible().catch(() => false)) {
      await expect
        .poll(() => sessionResponses.length, { timeout: 15_000 })
        .toBeGreaterThan(0);
      const sessionResponse = sessionResponses.at(-1);
      expect(sessionResponse).toBeTruthy();
      expect(sessionResponse!.status()).toBeLessThan(500);
      const sessionPayload = await sessionResponse!.json();
      assertEmbedConfigSafe(sessionPayload);
      await waitForActivepiecesIframe(page);
      await assertNotActivepiecesLogin(page);
      await expect(page).toHaveURL(
        new RegExp(`/app/projects/${projectId}/automations/.+/automation$`),
      );
    } else {
      await expect(page.getByTestId("builder-unavailable-state")).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/stack trace|TypeError/i);
    }

    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await assertNoBlockingOverlay(page);
    await assertNoAutomationBrowserSecrets(page);
  });

  test("opens canvas from the project automation row without sending the user to AP login", async ({
    page,
    request,
  }) => {
    const canvas = await ensureAutomationCanvas(page, request, projectId);

    await page.goto(`/app/projects/${projectId}`);
    await expect(page.getByTestId("project-workspace-shell")).toBeVisible({
      timeout: 20_000,
    });
    await openProjectTab(page, "automations");
    await page.locator(`a[href="${canvas.route}"]`).first().click();
    await waitForBuilderSurface(page);

    await expect(page).toHaveURL(
      new RegExp(`/app/projects/${projectId}/automations/.+/automation$`),
    );
    await expect(page.locator("body")).not.toContainText(
      /activepieces login|sign in to activepieces|sign in with activepieces/i,
    );
    await assertNoAutomationBrowserSecrets(page);
  });

  test("shows a controlled redacted unavailable state when AP session creation returns 503", async ({
    page,
    request,
  }, testInfo) => {
    const canvas = await ensureAutomationCanvas(page, request, projectId);
    await page.route("**/activepieces/session", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "ACTIVEPIECES_UNAVAILABLE",
            message:
              "raw backend stack trace sk-live-secret eyJheader.payload.signature",
          },
          requestId: "req_e2e_session_503",
        }),
      });
    });

    await page.goto(canvas.route);
    await expect(page.getByTestId("builder-unavailable-state")).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.locator("body")).toContainText(
      /Конструктор|automation canvas|temporarily unavailable/i,
    );
    await expect(page.locator("body")).not.toContainText(
      /raw backend|stack trace|sk-live-secret|eyJheader|BEGIN PRIVATE KEY|service_role/i,
    );
    await testInfo.attach("canvas-session-503-controlled-state", {
      body: await page.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
  });

  test("keeps project automation canvas localized after the builder is ready", async ({
    page,
    request,
  }, testInfo) => {
    const canvas = await ensureAutomationCanvas(page, request, projectId);

    await page.goto(`/app/projects/${projectId}`);
    await openProjectTab(page, "automations");
    await page.locator(`a[href="${canvas.route}"]`).first().click();
    await waitForBuilderSurface(page);
    await page.waitForTimeout(2_000);

    const hits = await scanVisibleEnglishCanvasLabels(page);
    await testInfo.attach("automation-canvas-localization-scan", {
      body: Buffer.from(`${JSON.stringify({ hits }, null, 2)}\n`, "utf8"),
      contentType: "application/json",
    });
    expect(hits).toEqual([]);
  });
});

async function scanVisibleEnglishCanvasLabels(page: Page) {
  const payload = await page.evaluate(() => {
    const values: string[] = [document.body.innerText];
    for (const iframe of Array.from(document.querySelectorAll("iframe"))) {
      const doc = iframe.contentDocument;
      if (!doc?.body) {
        continue;
      }
      values.push(doc.title, doc.body.innerText);
      for (const element of Array.from(doc.body.querySelectorAll<HTMLElement>("*"))) {
        for (const attribute of ["aria-label", "alt", "title", "placeholder"]) {
          const value = element.getAttribute(attribute);
          if (value) {
            values.push(value);
          }
        }
      }
    }
    return values.join("\n");
  });

  const forbidden = ["New Flow", "Manual Trigger", "Publish"];
  return forbidden.filter((term) =>
    term.includes(" ")
      ? payload.includes(term)
      : new RegExp(`\\b${escapeRegExp(term)}\\b`).test(payload),
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
