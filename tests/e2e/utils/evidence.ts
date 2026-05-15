import type { Page } from "@playwright/test";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type EvidenceArtifactType =
  | "screenshot"
  | "trace"
  | "json"
  | "log"
  | "report";

export interface EvidenceArtifact {
  readonly type: EvidenceArtifactType;
  readonly path: string;
  readonly sha256: string;
  readonly safeForSharing: boolean;
}

export function repoRoot() {
  return path.resolve(__dirname, "..", "..", "..");
}

export function systemArtifactsDir(...segments: readonly string[]) {
  return path.join(repoRoot(), "artifacts", "system-tests", ...segments);
}

export function ensureArtifactDir(...segments: readonly string[]) {
  const target = systemArtifactsDir(...segments);
  fs.mkdirSync(target, { recursive: true });
  return target;
}

export async function takeEvidenceScreenshot(page: Page, name: string) {
  const dir = ensureArtifactDir("block5-visual");
  const filename = sanitizeArtifactName(name).endsWith(".png")
    ? sanitizeArtifactName(name)
    : `${sanitizeArtifactName(name)}.png`;
  const filePath = path.join(dir, filename);

  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

export function writeJsonArtifact(
  relativeDir: string,
  name: string,
  data: unknown,
) {
  const dir = ensureArtifactDir(relativeDir);
  const filePath = path.join(
    dir,
    sanitizeArtifactName(name).endsWith(".json")
      ? sanitizeArtifactName(name)
      : `${sanitizeArtifactName(name)}.json`,
  );
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return filePath;
}

export function writeMetricArtifact(name: string, data: unknown) {
  return writeJsonArtifact("block5-performance/metrics", name, data);
}

export function hashFile(filePath: string) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function artifactRecord(
  filePath: string,
  type: EvidenceArtifactType,
  safeForSharing = true,
): EvidenceArtifact {
  return {
    type,
    path: path.relative(repoRoot(), filePath).replace(/\\/g, "/"),
    sha256: fs.existsSync(filePath) ? hashFile(filePath) : "",
    safeForSharing,
  };
}

export function sanitizeArtifactName(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}
