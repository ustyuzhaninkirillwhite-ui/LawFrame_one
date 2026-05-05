import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const artifactsDir = path.join(root, "artifacts", "stage17");
const inventory = readJson("pieces-inventory.json");
const build = readJson("pieces-build-report.json");
const sync = readJson("pieces-sync-report.json");
const localization = readJson("pieces-localization-report.json");

const findings = [];
if (!inventory) findings.push("missing pieces-inventory.json");
if (!build) findings.push("missing pieces-build-report.json");
if (!sync) findings.push("missing pieces-sync-report.json");
if (!localization) findings.push("missing pieces-localization-report.json");

if (inventory) {
  if (inventory.counts.total <= 1) findings.push("pieces inventory does not prove a palette broader than router");
  if (inventory.specialPieces.gmail.status !== "found") findings.push("gmail is not explicitly found/documented");
  if (inventory.specialPieces.cometapi.status !== "found") findings.push("cometapi is not explicitly found/documented");
}

if (build && build.status === "FAIL") {
  findings.push("pieces build report contains failed builds");
}
if (sync && sync.status === "FAIL") {
  findings.push("pieces sync report contains failed sync");
}

const runtimeCatalog = collectRuntimeCatalog();
if (runtimeCatalog.status === "checked") {
  if (runtimeCatalog.distinctNames < 100) {
    findings.push(
      `runtime Activepieces catalog is too small: ${runtimeCatalog.distinctNames} distinct pieces`,
    );
  }
  for (const [pieceName, present] of Object.entries(runtimeCatalog.knownPieces)) {
    if (!present) {
      findings.push(`runtime Activepieces catalog is missing ${pieceName}`);
    }
  }
}

const result = {
  stage: "17.12",
  generatedAt: new Date().toISOString(),
  status: findings.length === 0 ? "PASS" : "FAIL",
  findings,
  inventorySummary: inventory
    ? {
        total: inventory.counts.total,
        core: inventory.counts.core,
        community: inventory.counts.community,
        gmail: inventory.specialPieces.gmail.status,
        cometapi: inventory.specialPieces.cometapi.status,
      }
    : null,
  buildSummary: build?.summary ?? null,
  syncStatus: sync?.result?.status ?? null,
  builtInUtilities: {
    code:
      "Activepieces 0.80 exposes Code as a built-in utility action, not as piece_metadata @activepieces/piece-code.",
  },
  runtimeCatalog,
};

fs.writeFileSync(
  path.join(artifactsDir, "pieces-verify-report.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(result, null, 2));

if (result.status !== "PASS") {
  process.exit(1);
}

function readJson(name) {
  const filePath = path.join(artifactsDir, name);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectRuntimeCatalog() {
  const container =
    process.env.STAGE17_ACTIVEPIECES_POSTGRES_CONTAINER ??
    "lexframe-stage17-activepieces-postgres-1";
  const result = spawnSync(
    "docker",
    [
      "exec",
      container,
      "psql",
      "-U",
      "activepieces",
      "-d",
      "activepieces",
      "-Atc",
      [
        "select json_build_object(",
        "'totalRows', count(*),",
        "'distinctNames', count(distinct name),",
        "'knownPieces', json_build_object(",
        "'@activepieces/piece-openai', bool_or(name='@activepieces/piece-openai'),",
        "'@activepieces/piece-gmail', bool_or(name='@activepieces/piece-gmail'),",
        "'@activepieces/piece-google-drive', bool_or(name='@activepieces/piece-google-drive'),",
        "'@activepieces/piece-slack', bool_or(name='@activepieces/piece-slack'),",
        "'@activepieces/piece-http', bool_or(name='@activepieces/piece-http'),",
        "'@activepieces/piece-webhook', bool_or(name='@activepieces/piece-webhook')",
        ")",
        ")::text from piece_metadata;",
      ].join(" "),
    ],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    },
  );

  if (result.status !== 0) {
    return {
      status: "skipped",
      reason: "Stage17 Activepieces Postgres container is not available.",
      container,
    };
  }

  try {
    const parsed = JSON.parse(result.stdout.trim());
    return {
      status: "checked",
      container,
      totalRows: Number(parsed.totalRows ?? 0),
      distinctNames: Number(parsed.distinctNames ?? 0),
      knownPieces: parsed.knownPieces ?? {},
    };
  } catch (error) {
    return {
      status: "skipped",
      reason:
        error instanceof Error ? error.message : "catalog parse failed",
      container,
    };
  }
}
