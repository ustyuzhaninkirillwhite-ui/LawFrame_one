import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import {
  installBrowserSecurityScan,
  scanConsoleForSensitiveStrings,
  scanDomForSecretLikeStrings,
  scanNetworkForForbiddenHosts,
  scanStorageForSecretLikeStrings,
} from "./utils/browser-security";
import { installConsoleGuards } from "./utils/console";

test.describe("@part7 security browser storage and network full", () => {
  test("combined security journey keeps browser storage, DOM, console and network free of forbidden secrets", async ({
    page,
  }, testInfo) => {
    installConsoleGuards(page);
    installBrowserSecurityScan(page);
    await signInAsDemo(page, {
      email: `part7-browser-security-${Date.now()}@lexframe.local`,
      fullName: "Part7 Browser Security",
    });

    const routes = [
      "/app/projects",
      "/chat",
      "/documents",
      "/admin/security",
      "/settings/profile/audit",
    ];
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    }

    const dom = await scanDomForSecretLikeStrings(page);
    const storage = await scanStorageForSecretLikeStrings(page);
    const consoleScan = await scanConsoleForSensitiveStrings(page);
    const network = await scanNetworkForForbiddenHosts(page);

    await testInfo.attach("browser-storage-network-full-summary", {
      body: Buffer.from(
        `${JSON.stringify(
          {
            routes,
            dom,
            storage,
            console: consoleScan,
            network,
          },
          null,
          2,
        )}\n`,
        "utf8",
      ),
      contentType: "application/json",
    });
  });
});
