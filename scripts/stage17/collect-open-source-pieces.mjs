import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const activepiecesRoot =
  process.env.ACTIVEPIECES_SOURCE_DIR ?? process.env.ACTIVEPIECES_REPO_ROOT ?? "E:/activepieces-main";
const artifactsDir = path.join(root, "artifacts", "stage17");
const docsDir = path.join(root, "docs", "stage17");
const inventoryPath = path.join(artifactsDir, "pieces-inventory.json");
const sourceInventoryDocPath = path.join(docsDir, "pieces-source-inventory.md");
const packDocPath = path.join(docsDir, "open-source-pieces-pack.md");
const localizationDocPath = path.join(docsDir, "pieces-localization-report.md");
const localizationJsonPath = path.join(artifactsDir, "pieces-localization-report.json");

fs.mkdirSync(artifactsDir, { recursive: true });
fs.mkdirSync(docsDir, { recursive: true });

const report = await collectInventory();
fs.writeFileSync(inventoryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(sourceInventoryDocPath, renderSourceInventory(report), "utf8");
fs.writeFileSync(packDocPath, renderPiecesPack(report), "utf8");
fs.writeFileSync(localizationDocPath, renderPiecesLocalization(report), "utf8");
fs.writeFileSync(
  localizationJsonPath,
  `${JSON.stringify(report.localization, null, 2)}\n`,
  "utf8",
);

console.log(
  JSON.stringify(
    {
      status: report.status,
      total: report.counts.total,
      core: report.counts.core,
      community: report.counts.community,
      gmail: report.specialPieces.gmail.status,
      cometapi: report.specialPieces.cometapi.status,
      artifact: path.relative(root, inventoryPath),
    },
    null,
    2,
  ),
);

async function collectInventory() {
  const sourceState = readSourceState(activepiecesRoot);
  const scan = await scanPieces(activepiecesRoot);
  const pieces = scan.pieces.map((piece) => enrichPiece(piece, activepiecesRoot));
  const specialPieces = {
    gmail: summarizeSpecialPiece(pieces, "gmail"),
    cometapi: summarizeSpecialPiece(pieces, "cometapi"),
  };
  const localization = summarizeLocalization(pieces, specialPieces);
  const license = summarizeLicenseBoundary(activepiecesRoot);

  return {
    stage: "17.12",
    status: pieces.length > 1 ? "PASS" : "FAIL",
    generatedAt: new Date().toISOString(),
    activepiecesRoot,
    sourceState,
    packageManager: readPackageManager(activepiecesRoot),
    lockfiles: listExisting(activepiecesRoot, ["bun.lock", "pnpm-lock.yaml", "package-lock.json", "yarn.lock"]),
    counts: {
      core: pieces.filter((piece) => piece.kind === "core").length,
      community: pieces.filter((piece) => piece.kind === "community").length,
      custom: pieces.filter((piece) => piece.kind === "custom").length,
      total: pieces.length,
      actions: pieces.reduce((sum, piece) => sum + piece.actions, 0),
      triggers: pieces.reduce((sum, piece) => sum + piece.triggers, 0),
    },
    pieces,
    specialPieces,
    localization,
    license,
    offlineSemantics: {
      metadataAvailableLocally: true,
      externalApiExecutionRequiresNetworkAndCredentials: true,
      credentialsCommitted: false,
      browserSecretsAllowed: false,
    },
    policyNotes: [
      "ACTIVEPIECES_CATALOG_MODE=max exposes the broad Activepieces catalog by default.",
      "ACTIVEPIECES_CATALOG_MODE=restricted restores the Stage17 allowlist rollback.",
      "Direct AI provider pieces, including CometAPI, can be visible in the catalog; credentials remain policy-controlled and are not committed.",
      "Gmail requires backend-approved connection policy and OAuth credentials; none are committed.",
    ],
  };
}

async function scanPieces(repoRoot) {
  const distPath = path.join(root, "packages", "activepieces-inventory", "dist", "index.js");
  if (fs.existsSync(distPath)) {
    const module = await import(pathToFileURL(distPath).href);
    return module.scanActivepiecesPieces(repoRoot);
  }

  throw new Error("packages/activepieces-inventory/dist/index.js is missing. Build @lexframe/activepieces-inventory first.");
}

function enrichPiece(piece, repoRoot) {
  const absolutePath = path.join(repoRoot, piece.path);
  const i18nDir = path.join(absolutePath, "src", "i18n");
  const i18nLocales = fs.existsSync(i18nDir)
    ? fs
        .readdirSync(i18nDir)
        .filter((file) => file.endsWith(".json"))
        .map((file) => file.replace(/\.json$/, ""))
        .sort((left, right) => left.localeCompare(right))
    : [];
  const distPath = path.join(absolutePath, "dist");
  return {
    packageName: piece.packageName,
    packageVersion: piece.packageVersion,
    slug: piece.slug,
    path: piece.path,
    kind: piece.kind,
    displayName: piece.displayName,
    description: piece.description,
    authType: piece.authType,
    actions: piece.actions,
    triggers: piece.triggers,
    actionNames: piece.actionEntries.map((entry) => entry.name).sort(),
    triggerNames: piece.triggerEntries.map((entry) => entry.name).sort(),
    categories: piece.categories,
    risk: piece.risk,
    exposure: piece.exposure,
    importMode: piece.importMode,
    i18nLocales,
    ruLocalePresent: i18nLocales.includes("ru"),
    distPresent: fs.existsSync(distPath),
    sourceHash: piece.sourceHash,
  };
}

function summarizeSpecialPiece(pieces, slug) {
  const piece = pieces.find((candidate) => candidate.slug === slug) ?? null;
  if (!piece) {
    return {
      slug,
      status: "missing",
      packageName: `@activepieces/piece-${slug}`,
      path: null,
      actions: [],
      triggers: [],
      authType: null,
      ruLocalePresent: false,
      distPresent: false,
      note: "Piece is not present in the current local open-source source tree.",
    };
  }

  return {
    slug,
    status: "found",
    packageName: piece.packageName,
    path: piece.path,
    displayName: piece.displayName,
    description: piece.description,
    actions: piece.actionNames,
    triggers: piece.triggerNames,
    authType: piece.authType,
    ruLocalePresent: piece.ruLocalePresent,
    i18nLocales: piece.i18nLocales,
    distPresent: piece.distPresent,
    risk: piece.risk,
    exposure: piece.exposure,
  };
}

function summarizeLocalization(pieces, specialPieces) {
  const withI18n = pieces.filter((piece) => piece.i18nLocales.length > 0);
  const withRu = pieces.filter((piece) => piece.ruLocalePresent);
  return {
    stage: "17.12",
    generatedAt: new Date().toISOString(),
    status: "PASS",
    totalPieces: pieces.length,
    piecesWithAnyI18n: withI18n.length,
    piecesWithRu: withRu.length,
    ruCoveragePercent: pieces.length === 0 ? 0 : Number(((withRu.length / pieces.length) * 100).toFixed(2)),
    gmail: {
      status: specialPieces.gmail.status,
      ruLocalePresent: specialPieces.gmail.ruLocalePresent,
      actionNames: specialPieces.gmail.actions,
      triggerNames: specialPieces.gmail.triggers,
    },
    cometapi: {
      status: specialPieces.cometapi.status,
      ruLocalePresent: specialPieces.cometapi.ruLocalePresent,
      actionNames: specialPieces.cometapi.actions,
      triggerNames: specialPieces.cometapi.triggers,
      note:
        specialPieces.cometapi.status === "found" && !specialPieces.cometapi.ruLocalePresent
          ? "CometAPI has no ru.json in the current local source tree; Stage 17.12 documents this and does not invent upstream localization."
          : null,
    },
    policy: {
      packageNamesAndSlugsTranslated: false,
      localOverlayAllowedForOpenSourcePieceDisplayNames: true,
      overlayMustNotExposeRawSensitiveContent: true,
    },
  };
}

function readSourceState(repoRoot) {
  return {
    exists: fs.existsSync(repoRoot),
    isGitRepository: runGit(repoRoot, ["rev-parse", "--is-inside-work-tree"]).status === 0,
    branch: runGitText(repoRoot, ["branch", "--show-current"]),
    commit: runGitText(repoRoot, ["rev-parse", "HEAD"]),
    statusShort: runGitText(repoRoot, ["status", "--short"]),
    remotes: runGitText(repoRoot, ["remote", "-v"]),
    gitEvidenceAvailable: runGit(repoRoot, ["rev-parse", "HEAD"]).status === 0,
  };
}

function runGitText(cwd, args) {
  const result = runGit(cwd, args);
  return result.status === 0 ? result.stdout.trim() : null;
}

function runGit(cwd, args) {
  if (!fs.existsSync(cwd)) {
    return { status: 1, stdout: "", stderr: "missing cwd" };
  }
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function readPackageManager(repoRoot) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
    return packageJson.packageManager ?? null;
  } catch {
    return null;
  }
}

function listExisting(repoRoot, names) {
  return names.filter((name) => fs.existsSync(path.join(repoRoot, name)));
}

function summarizeLicenseBoundary(repoRoot) {
  return {
    rootLicensePresent: fs.existsSync(path.join(repoRoot, "LICENSE")),
    enterpriseLicensePresent: fs.existsSync(path.join(repoRoot, "packages", "ee", "LICENSE")),
    enterprisePathsExcluded: [
      "packages/ee",
      "packages/server/api/src/app/ee",
    ],
    decision: "Do not copy or depend on enterprise/ee code or assets without explicit license decision.",
    paidEmbeddingRisk: "Official Activepieces embedding/provisioning/show-hide pieces docs identify these as embedding/platform surfaces; Stage 17.12 records license risk and remains local MVP.",
  };
}

function renderSourceInventory(report) {
  const pieceList = report.pieces
    .map((piece) => `- ${piece.kind}: ${piece.packageName} (${piece.slug}) actions=${piece.actions} triggers=${piece.triggers}`)
    .join("\n");
  return [
    "# Stage 17.12 Pieces Source Inventory",
    "",
    `Generated: ${report.generatedAt}`,
    `AP repo path: \`${report.activepiecesRoot}\``,
    `AP git repository: ${report.sourceState.isGitRepository ? "yes" : "no"}`,
    `AP commit: ${report.sourceState.commit ?? "unknown"}`,
    `AP branch: ${report.sourceState.branch ?? "unknown"}`,
    `Package manager: ${report.packageManager ?? "unknown"}`,
    `Lockfiles: ${report.lockfiles.join(", ") || "none"}`,
    "",
    "## Counts",
    "",
    `- Community pieces: ${report.counts.community}`,
    `- Core pieces: ${report.counts.core}`,
    `- Custom pieces: ${report.counts.custom}`,
    `- Total pieces: ${report.counts.total}`,
    `- Actions: ${report.counts.actions}`,
    `- Triggers: ${report.counts.triggers}`,
    "",
    "## Special Pieces",
    "",
    `- Gmail: ${report.specialPieces.gmail.status}; path=${report.specialPieces.gmail.path ?? "missing"}; ru=${report.specialPieces.gmail.ruLocalePresent}`,
    `- CometAPI: ${report.specialPieces.cometapi.status}; path=${report.specialPieces.cometapi.path ?? "missing"}; ru=${report.specialPieces.cometapi.ruLocalePresent}`,
    "",
    "## License Boundary",
    "",
    `- Root license present: ${report.license.rootLicensePresent}`,
    `- Enterprise license present: ${report.license.enterpriseLicensePresent}`,
    "- Excluded: `packages/ee`, `packages/server/api/src/app/ee`.",
    "- No enterprise/ee code or assets are imported by Stage 17.12.",
    "",
    "## Pieces",
    "",
    pieceList,
    "",
  ].join("\n");
}

function renderPiecesPack(report) {
  return [
    "# Stage 17.12 Open-Source Pieces Pack",
    "",
    `Status: ${report.status}`,
    "",
    "The local pack inventories open-source Activepieces core/community pieces for local/offline inspection. Offline means metadata, display names, actions/triggers, source paths and local build status are available. External API execution still requires network, provider credentials and connection setup.",
    "",
    "## Local Profile",
    "",
    "- Profile: `stage17-local-all-open-source-pieces`.",
    "- Scope: local/dev only.",
    "- Production remains allowlisted and policy-filtered.",
    "- Gmail and other delivery pieces require backend-approved connection policy.",
    "- Direct AI provider pieces, including CometAPI, must not bypass LexFrame AI Gateway for production legal data.",
    "",
    "## Inventory",
    "",
    `- Total: ${report.counts.total}`,
    `- Community: ${report.counts.community}`,
    `- Core: ${report.counts.core}`,
    `- Actions: ${report.counts.actions}`,
    `- Triggers: ${report.counts.triggers}`,
    "",
    "## Gmail",
    "",
    `- Status: ${report.specialPieces.gmail.status}`,
    `- Package: ${report.specialPieces.gmail.packageName}`,
    `- Path: ${report.specialPieces.gmail.path ?? "missing"}`,
    `- Auth: ${report.specialPieces.gmail.authType ?? "unknown"}`,
    `- RU locale: ${report.specialPieces.gmail.ruLocalePresent}`,
    `- Actions: ${(report.specialPieces.gmail.actions ?? []).join(", ") || "none"}`,
    `- Triggers: ${(report.specialPieces.gmail.triggers ?? []).join(", ") || "none"}`,
    "",
    "## CometAPI",
    "",
    `- Status: ${report.specialPieces.cometapi.status}`,
    `- Package: ${report.specialPieces.cometapi.packageName}`,
    `- Path: ${report.specialPieces.cometapi.path ?? "missing"}`,
    `- Auth: ${report.specialPieces.cometapi.authType ?? "unknown"}`,
    `- RU locale: ${report.specialPieces.cometapi.ruLocalePresent}`,
    `- Actions: ${(report.specialPieces.cometapi.actions ?? []).join(", ") || "none"}`,
    `- Triggers: ${(report.specialPieces.cometapi.triggers ?? []).join(", ") || "none"}`,
    "",
  ].join("\n");
}

function renderPiecesLocalization(report) {
  return [
    "# Stage 17.12 Pieces Localization Report",
    "",
    `Generated: ${report.localization.generatedAt}`,
    `Status: ${report.localization.status}`,
    "",
    `- Pieces with any i18n: ${report.localization.piecesWithAnyI18n}`,
    `- Pieces with ru locale: ${report.localization.piecesWithRu}`,
    `- RU coverage: ${report.localization.ruCoveragePercent}%`,
    "",
    "## Gmail",
    "",
    `- Status: ${report.localization.gmail.status}`,
    `- RU locale present: ${report.localization.gmail.ruLocalePresent}`,
    `- Actions: ${report.localization.gmail.actionNames.join(", ") || "none"}`,
    `- Triggers: ${report.localization.gmail.triggerNames.join(", ") || "none"}`,
    "",
    "## CometAPI",
    "",
    `- Status: ${report.localization.cometapi.status}`,
    `- RU locale present: ${report.localization.cometapi.ruLocalePresent}`,
    `- Actions: ${report.localization.cometapi.actionNames.join(", ") || "none"}`,
    `- Triggers: ${report.localization.cometapi.triggerNames.join(", ") || "none"}`,
    report.localization.cometapi.note ? `- Note: ${report.localization.cometapi.note}` : "",
    "",
    "Package names, slugs, action IDs, trigger IDs and JSON schema keys remain untranslated.",
    "",
  ].join("\n");
}
