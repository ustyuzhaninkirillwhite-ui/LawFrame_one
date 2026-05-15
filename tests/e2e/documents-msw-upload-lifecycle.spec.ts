import { expect, test } from "@playwright/test";
import path from "node:path";
import { signInAsDemo } from "./helpers/auth";
import {
  openDocumentUploadDialog,
  selectDocumentFile,
  submitDocumentUpload,
} from "./utils/documents";

const fixturesDir = path.join(__dirname, "fixtures", "files");
const mswControlStorageKey = "lexframe.e2e.block5.msw-control";

test.describe("documents MSW upload lifecycle", () => {
  test.skip(
    process.env.LEXFRAME_E2E_USE_MSW !== "1",
    "MSW-only deterministic document upload lifecycle coverage.",
  );

  test("recovers after a one-shot content upload failure", async ({ page }) => {
    await signInAsDemo(page, {
      email: `part5-documents-msw-${Date.now()}@lexframe.local`,
      fullName: "Part5 Documents MSW",
    });
    await page.evaluate((storageKey) => {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          failures: {
            "POST /documents/:documentId/versions/:versionId/content": {
              status: 503,
              code: "READINESS_GATE_BLOCKED",
              message: "Storage temporarily unavailable.",
              remaining: 1,
            },
          },
        }),
      );
    }, mswControlStorageKey);

    await openDocumentUploadDialog(page);
    await selectDocumentFile(page, path.join(fixturesDir, "minimal.pdf"));
    await submitDocumentUpload(page);
    await expect(page.locator("body")).toContainText(
      /Storage temporarily unavailable|READINESS_GATE_BLOCKED/i,
      { timeout: 20_000 },
    );

    await submitDocumentUpload(page);
    await expect(page.locator("body")).toContainText(/Upload flow completed/i, {
      timeout: 20_000,
    });
  });
});
