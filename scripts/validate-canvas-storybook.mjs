import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const registryPath = path.resolve(
  repoRoot,
  "apps/web/src/features/canvas/storybook/canvas-states.registry.json",
);

const requiredStates = [
  "CanvasPage.Empty",
  "CanvasPage.BasicValidWorkflow",
  "CanvasPage.InvalidMissingInput",
  "CanvasPage.PolicyBlockedExternalDelivery",
  "CanvasPage.RuntimeUnavailable",
  "CanvasPage.ReadonlyViewer",
  "CanvasPage.DraftLocked",
  "CanvasPage.SyncConflict",
  "CanvasPage.CompilePreviewSuccess",
  "CanvasPage.CompilePreviewFailure",
  "CanvasPage.LongRussianLabels",
  "StepInspector.OutputsRedacted",
  "ValidationRail.PolicyBlocks",
];

const registry = JSON.parse(await fs.readFile(registryPath, "utf-8"));
const stateNames = new Set(registry.states.map((state) => state.name));
const missing = requiredStates.filter((state) => !stateNames.has(state));

if (missing.length > 0) {
  console.error("Canvas visual state registry is incomplete.");
  console.error(missing);
  process.exitCode = 1;
} else {
  console.log(`Canvas visual state registry passed: ${registryPath}`);
}
