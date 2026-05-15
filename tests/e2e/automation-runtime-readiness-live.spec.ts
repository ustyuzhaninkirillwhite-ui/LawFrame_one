import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import {
  assertNotActivepiecesLogin,
  waitForBuilderSurface,
} from "./utils/activepieces";
import { ensureAutomationCanvas } from "./utils/automation";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block4 automation runtime readiness live", () => {
  test("automation scoped preflight requires AP runtime but not search/storage services", () => {
    const report = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "scripts/stage16-e2e-preflight.mjs",
          "--scope=automation",
          "--json",
          "--fail-on-required",
          "--allow-reuse-runtime",
        ],
        {
          cwd: repoRoot(),
          encoding: "utf8",
          env: {
            ...process.env,
            LEXFRAME_E2E_USE_MSW: "0",
          },
        },
      ),
    ) as {
      readonly status: string;
      readonly required: ReadonlyArray<{ readonly name: string; readonly status: string }>;
      readonly optional: ReadonlyArray<{ readonly name: string; readonly status: string }>;
    };

    expect(report.status).toBe("READY");
    expect(statusByName(report.required, "activepieces-postgres")).toContain("READY");
    expect(statusByName(report.required, "activepieces-redis")).toContain("READY");
    expect(statusByName(report.required, "activepieces-app")).toContain("READY");
    expect(statusByName(report.required, "activepieces-worker")).toContain("READY");
    expect(statusByName(report.optional, "opensearch")).toContain("NOT_REQUIRED_FOR_SCOPE");
    expect(statusByName(report.optional, "storage-sandbox")).toContain("NOT_REQUIRED_FOR_SCOPE");
    expect(statusByName(report.optional, "delivery-sandbox")).toContain("NOT_REQUIRED_FOR_SCOPE");
  });

  test("ready AP runtime opens a LexFrame-controlled builder surface without AP login", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, {
      email: `block4-readiness-${Date.now()}@lexframe.local`,
      fullName: "Block4 Readiness User",
    });

    const canvas = await ensureAutomationCanvas(page, request, projectId);
    await page.goto(canvas.route);
    await waitForBuilderSurface(page);

    await expect(page.locator("body")).not.toContainText(
      /stack trace|BEGIN PRIVATE KEY|ACTIVEPIECES_API_KEY|AP_JWT_SECRET|service_role/i,
    );
    if (await page.locator("iframe").count()) {
      await assertNotActivepiecesLogin(page);
    } else {
      await expect(page.getByTestId("builder-unavailable-state")).toBeVisible();
      await expect(page.locator("body")).not.toContainText(
        /activepieces login|sign in to activepieces/i,
      );
    }
  });
});

function statusByName(
  items: ReadonlyArray<{ readonly name: string; readonly status: string }>,
  name: string,
) {
  return items.filter((item) => item.name === name).map((item) => item.status);
}

function repoRoot() {
  return process.cwd().endsWith(path.join("tests", "e2e"))
    ? path.resolve(process.cwd(), "..", "..")
    : process.cwd();
}
