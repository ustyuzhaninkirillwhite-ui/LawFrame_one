import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";

const runLive = process.env.LEXFRAME_STAGE17_17_10_LIVE === "1";
const projectId = process.env.STAGE17_PROJECT_ID ?? "project_claim_001";

test.describe("Stage 17.12 debranding and neutral icon", () => {
  test.skip(
    !runLive,
    "Set LEXFRAME_STAGE17_17_10_LIVE=1 to run live Stage 17.12 debranding checks.",
  );

  test("uses local neutral icon and no visible Activepieces brand", async ({
    page,
    request,
  }) => {
    await signInAsDemo(page, {
      email: "stage16.owner@lexframe.test",
      fullName: "Stage 16 Owner",
    });
    const ensuredCanvas = await ensureStage17Canvas(page, request);

    await page.goto(ensuredCanvas.route);
    await expect(page.getByTestId("activepieces-canvas-container")).toBeVisible({
      timeout: 45_000,
    });
    await expect(
      page.locator('iframe[title="Конструктор автоматизаций"]'),
    ).toBeVisible();

    const scan = await page.evaluate(() => {
      const iframe = document.querySelector<HTMLIFrameElement>(
        'iframe[title="Конструктор автоматизаций"]',
      );
      const doc = iframe?.contentDocument;
      const images = doc
        ? Array.from(doc.images).map((image) => ({
            src: image.getAttribute("src") ?? "",
            alt: image.getAttribute("alt") ?? "",
            title: image.getAttribute("title") ?? "",
          }))
        : [];
      return {
        outerTitle: document.title,
        iframeTitle: iframe?.getAttribute("title") ?? null,
        documentTitle: doc?.title ?? null,
        images,
        bodyText: doc?.body.innerText ?? "",
      };
    });
    const serialized = JSON.stringify(scan);
    const forbidden = /Powered by Activepieces|cdn\.activepieces\.com\/brand|activepieces\.com\/brand/i;
    writeEvidence({ status: forbidden.test(serialized) ? "FAIL" : "PASS", scan });

    expect(serialized).not.toMatch(forbidden);
    expect(scan.iframeTitle).toBe("Конструктор автоматизаций");
  });
});

async function ensureStage17Canvas(
  page: Page,
  request: APIRequestContext,
) {
  const session = await getWorkspaceApiSession(page, request);
  const response = await request.post(
    `${session.apiBaseUrl}/projects/${projectId}/automations/stage17-canvas/ensure`,
    {
      headers: {
        ...session.headers,
        "content-type": "application/json",
      },
      data: {},
    },
  );

  expect(response.ok()).toBeTruthy();
  return (await response.json()) as {
    readonly automation_id: string;
    readonly route: string;
  };
}

function writeEvidence(payload: Record<string, unknown>) {
  const filePath = path.resolve(
    process.cwd(),
    "..",
    "..",
    "artifacts",
    "stage17",
    "debranding-icon-evidence.json",
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `${JSON.stringify({ stage: "17.12", generated_at: new Date().toISOString(), ...payload }, null, 2)}\n`,
    "utf8",
  );
}
