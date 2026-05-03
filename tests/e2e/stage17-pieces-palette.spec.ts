import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";

const runLive = process.env.LEXFRAME_STAGE17_17_10_LIVE === "1";
const projectId = process.env.STAGE17_PROJECT_ID ?? "project_claim_001";

test.describe("Stage 17.12 pieces palette evidence", () => {
  test.skip(
    !runLive,
    "Set LEXFRAME_STAGE17_17_10_LIVE=1 to run live Stage 17.12 pieces checks.",
  );

  test("documents broad local pieces inventory and opens builder palette surface", async ({
    page,
    request,
  }) => {
    const inventory = readInventory();
    expect(inventory.counts.total).toBeGreaterThan(1);
    expect(inventory.specialPieces.gmail.status).toBe("found");
    expect(inventory.specialPieces.cometapi.status).toBe("found");

    await signInAsDemo(page, {
      email: "stage16.owner@lexframe.test",
      fullName: "Stage 16 Owner",
    });
    const ensuredCanvas = await ensureStage17Canvas(page, request);

    await page.goto(ensuredCanvas.route);
    await expect(page.getByTestId("activepieces-canvas-container")).toBeVisible({
      timeout: 45_000,
    });

    await expect
      .poll(() => readFrameText(page), {
        timeout: 45_000,
        message: "Activepieces builder frame should expose localized flow text.",
      })
      .toMatch(/Ручной|Manual|Маршрутизатор|Router/i);
    const frameText = await readFrameText(page);
    if (process.env.STAGE17_EXPECT_FULL_PIECES_PALETTE === "1") {
      expect(frameText).toMatch(/Gmail/i);
      expect(frameText).toMatch(/CometAPI/i);
    }
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

async function readFrameText(page: Page) {
  return page.evaluate(() => {
    const iframe = document.querySelector<HTMLIFrameElement>(
      'iframe[title="Конструктор автоматизаций"]',
    );
    return iframe?.contentDocument?.body.innerText ?? "";
  });
}

function readInventory() {
  const filePath = path.resolve(
    process.cwd(),
    "..",
    "..",
    "artifacts",
    "stage17",
    "pieces-inventory.json",
  );
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as {
    readonly counts: { readonly total: number };
    readonly specialPieces: {
      readonly gmail: { readonly status: string };
      readonly cometapi: { readonly status: string };
    };
  };
}
