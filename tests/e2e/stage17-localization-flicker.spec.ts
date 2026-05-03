import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";

const runLive = process.env.LEXFRAME_STAGE17_17_10_LIVE === "1";
const projectId = process.env.STAGE17_PROJECT_ID ?? "project_claim_001";
const forbiddenTerms = [
  "Flows",
  "Runs",
  "Versions",
  "Publish",
  "Manual Run",
  "Manual Trigger",
  "Manage Flow",
  "Loop on Items",
  "Router",
  "Code",
  "Choose a piece",
  "Select a piece first",
  "Please select a piece first",
  "Connections",
  "No results",
  "Create connection",
  "Test step",
  "Step settings",
  "Trigger",
  "Action",
  "Activepieces",
];

test.describe("Stage 17.12 localization flicker hardening", () => {
  test.skip(
    !runLive,
    "Set LEXFRAME_STAGE17_17_10_LIVE=1 to run live Stage 17.12 localization checks.",
  );

  test("does not expose known English labels during initial visible paint", async ({
    page,
    request,
  }) => {
    await signInAsDemo(page, {
      email: "stage16.owner@lexframe.test",
      fullName: "Stage 16 Owner",
    });
    const ensuredCanvas = await ensureStage17Canvas(page, request);
    const samples: Array<{ at: number; hits: string[] }> = [];

    await page.goto(ensuredCanvas.route);
    await expect(page.getByTestId("activepieces-canvas-container")).toBeVisible({
      timeout: 45_000,
    });
    await expect(
      page.getByText("Загружаем конструктор автоматизаций."),
    ).toHaveCount(0, { timeout: 45_000 });

    for (let index = 0; index < 12; index += 1) {
      samples.push(await sampleKnownEnglish(page));
      await page.waitForTimeout(150);
    }

    const hits = samples.flatMap((sample) => sample.hits);
    const metrics = await page.evaluate(
      () =>
        (
          window as Window & {
            __LEXFRAME_STAGE17_LOCALIZATION_FALLBACK__?: unknown;
          }
        ).__LEXFRAME_STAGE17_LOCALIZATION_FALLBACK__ ?? null,
    );
    writeEvidence({ status: hits.length === 0 ? "PASS" : "FAIL", samples, metrics });
    expect(hits).toEqual([]);
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

async function sampleKnownEnglish(page: Page) {
  const payload = await page.evaluate(() => {
    const iframe = document.querySelector<HTMLIFrameElement>(
      'iframe[title="Конструктор автоматизаций"]',
    );
    const doc = iframe?.contentDocument;
    if (!doc?.body) {
      return "";
    }
    const values: string[] = [doc.title];
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const value = walker.currentNode.nodeValue?.trim();
      if (value) {
        values.push(value);
      }
    }
    for (const element of doc.body.querySelectorAll<HTMLElement>("*")) {
      for (const attribute of ["aria-label", "alt", "title", "placeholder"]) {
        const value = element.getAttribute(attribute)?.trim();
        if (value) {
          values.push(value);
        }
      }
    }
    return values.join("\n");
  });

  return {
    at: Date.now(),
    hits: forbiddenTerms.filter((term) =>
      term.includes(" ")
        ? payload.includes(term)
        : new RegExp(`\\b${escapeRegExp(term)}\\b`).test(payload),
    ),
  };
}

function writeEvidence(payload: Record<string, unknown>) {
  const filePath = path.resolve(
    process.cwd(),
    "..",
    "..",
    "artifacts",
    "stage17",
    "localization-flicker-evidence.json",
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `${JSON.stringify({ stage: "17.12", generated_at: new Date().toISOString(), ...payload }, null, 2)}\n`,
    "utf8",
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
