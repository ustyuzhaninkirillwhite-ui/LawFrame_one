import { expect, test } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { signInAsDemo } from "./helpers/auth";
import {
  installBrowserSecurityScan,
  writeBrowserSecurityScanArtifact,
} from "./utils/browser-security";
import { installConsoleGuards } from "./utils/console";
import { writeJsonArtifact } from "./utils/evidence";
import { assertRouteReady } from "./utils/navigation";
import { readBrowserStorage } from "./utils/storage";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block5 browser security isolation", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    installBrowserSecurityScan(page);
    await signInAsDemo(page, {
      email: `block5-security-${Date.now()}@lexframe.local`,
      fullName: "Block5 Browser Security User",
    });
  });

  test("scans DOM, storage, console and network across key browser surfaces", async ({
    page,
  }) => {
    await page.goto(`/app/projects/${projectId}`);
    await assertRouteReady(page, "project-workspace");
    await page.getByTestId("settings-entry-point").first().click();
    await assertRouteReady(page, "settings");
    await page.keyboard.press("Escape");

    await page.goto("/documents");
    await assertRouteReady(page, "documents");
    await page.goto("/sources");
    await assertRouteReady(page, "sources");
    await page.goto("/app/projects");
    await assertRouteReady(page, "ordinary");

    await writeBrowserSecurityScanArtifact(page);
  });

  test("does not persist raw attached file bytes to browser storage", async ({
    page,
  }) => {
    const rawFileContents =
      "OPENAI_API_KEY=sk-block5-runtime-storage-should-not-persist";
    const fixturePath = path.join(
      os.tmpdir(),
      `lexframe-block5-storage-${Date.now()}.txt`,
    );
    fs.writeFileSync(fixturePath, rawFileContents, "utf8");

    await page.goto(`/app/projects/${projectId}`);
    await assertRouteReady(page, "project-workspace");
    await page
      .getByRole("button", {
        name: /Добавить контекст|add context/i,
      })
      .click();
    await page
      .getByTestId("project-workspace-shell")
      .locator('input[type="file"]')
      .last()
      .setInputFiles(fixturePath);
    await expect(page.locator("body")).toContainText(path.basename(fixturePath));

    const storage = await readBrowserStorage(page);
    const serialized = JSON.stringify(storage);
    writeJsonArtifact("block5-security", "file-form-storage-scan", {
      generatedAt: new Date().toISOString(),
      filename: path.basename(fixturePath),
      storage,
    });
    expect(serialized).not.toContain(rawFileContents);
    expect(serialized).not.toMatch(/sk-block5-runtime-storage-should-not-persist/i);
  });
});
