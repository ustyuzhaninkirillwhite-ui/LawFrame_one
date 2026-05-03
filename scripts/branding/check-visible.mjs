import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const activepiecesRoot =
  process.env.ACTIVEPIECES_SOURCE_DIR ?? "E:/activepieces-main";
const manifestPath = path.join(repoRoot, "scripts/stage17/debranding-manifest.json");
const iconEvidencePath = path.join(repoRoot, "artifacts/stage17/debranding-icon-evidence.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const forbiddenTerms = [
  "Powered by Activepieces",
  "Activepieces",
  "Connections",
  "Settings",
  "Warning",
  "Publish",
  "Error",
  "Runs",
  "Save",
  "Run",
];

const translationPath = path.join(
  activepiecesRoot,
  "packages/web/public/locales/ru/translation.json",
);
const translation = JSON.parse(fs.readFileSync(translationPath, "utf8"));
const translationHits = Object.entries(translation)
  .filter(([, value]) => typeof value === "string")
  .flatMap(([key, value]) => {
    const visibleValue = stripPlaceholders(value);
    return forbiddenTerms
      .filter((term) => hasForbiddenTerm(visibleValue, term))
      .map((term) => ({
        surface: "activepieces-ru-translation",
        key,
        term,
        value,
      }));
  });

const visibleStringFiles = [
  "apps/web/src/features/automation-canvas/activepieces-canvas-route.tsx",
  "apps/web/src/features/automation-canvas/activepieces-canvas-wrapper.tsx",
  "apps/web/src/features/automation-canvas/automation-tabs.tsx",
  "apps/web/src/features/automation-canvas/builder-unavailable-state.tsx",
  "apps/web/src/features/automation-canvas/diagnostics-panel.tsx",
  "apps/web/src/features/automation-canvas/local-keys-warning-banner.tsx",
  "apps/web/src/features/activepieces/embedded-builder.tsx",
];
const stringLiteralHits = visibleStringFiles.flatMap((relativePath) => {
  const filePath = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  return extractStringLiterals(source).flatMap((value) =>
    forbiddenTerms
      .filter((term) => hasForbiddenTerm(stripPlaceholders(value), term))
      .map((term) => ({ surface: relativePath, term, value }))
      .filter((hit) => !isRuntimeTranslationOverlayLiteral(hit)),
  );
});

const themePath = path.join(
  activepiecesRoot,
  "packages/server/api/src/app/flags/theme.ts",
);
const themeSource = fs.readFileSync(themePath, "utf8");
const indexPath = path.join(activepiecesRoot, "packages/web/index.html");
const indexSource = fs.readFileSync(indexPath, "utf8");
const themeChecks = {
  websiteNameDebranded: !themeSource.includes("websiteName: 'Activepieces'"),
  cdnBrandAssetsRemoved: !themeSource.includes("cdn.activepieces.com/brand"),
  localAutomationLogo: themeSource.includes("/lexframe-automation-logo.svg"),
  localAutomationIcon: themeSource.includes("/lexframe-automation-icon.svg"),
  htmlLangRu: indexSource.includes('<html lang="ru">'),
  htmlNoDefaultLogoSvg: !indexSource.includes('href="/logo.svg"'),
};
const neutralAssetChecks = Object.fromEntries(
  manifest.neutralAssets.map((assetPath) => {
    const absolutePath = path.isAbsolute(assetPath)
      ? assetPath
      : path.join(repoRoot, assetPath);
    const exists = fs.existsSync(absolutePath);
    const content = exists ? fs.readFileSync(absolutePath, "utf8") : "";
    const repoAsset = assetPath.startsWith("apps/web/public/");
    return [
      assetPath,
      {
        exists,
        local: !/(?:href|src)=["']https?:\/\//i.test(content),
        noActivepiecesMark: !/activepieces/i.test(content),
        hasAccessibleTitle: repoAsset
          ? /<title[^>]*>LexFrame Automation<\/title>/i.test(content)
          : true,
      },
    ];
  }),
);
const remoteBrandAssetHits = [
  themeSource,
  indexSource,
  ...manifest.neutralAssets
    .map((assetPath) => {
      const absolutePath = path.isAbsolute(assetPath)
        ? assetPath
        : path.join(repoRoot, assetPath);
      return fs.existsSync(absolutePath)
        ? fs.readFileSync(absolutePath, "utf8")
        : "";
    }),
].flatMap((content, index) =>
  manifest.remoteBrandAssetForbiddenPatterns
    .filter((pattern) => content.includes(pattern))
    .map((pattern) => ({ sourceIndex: index, pattern })),
);

const report = {
  stage: "17.12",
  forbiddenTerms,
  translationHits,
  stringLiteralHits,
  themeChecks,
  neutralAssetChecks,
  remoteBrandAssetHits,
};

console.log(JSON.stringify(report, null, 2));
fs.mkdirSync(path.dirname(iconEvidencePath), { recursive: true });
fs.writeFileSync(iconEvidencePath, `${JSON.stringify({
  stage: "17.12",
  generated_at: new Date().toISOString(),
  status:
    translationHits.length === 0 &&
    stringLiteralHits.length === 0 &&
    remoteBrandAssetHits.length === 0 &&
    Object.values(themeChecks).every((value) => value) &&
    Object.values(neutralAssetChecks).every((check) =>
      Object.values(check).every((value) => value),
    )
      ? "PASS"
      : "FAIL",
  report,
}, null, 2)}\n`, "utf8");

if (
  translationHits.length > 0 ||
  stringLiteralHits.length > 0 ||
  remoteBrandAssetHits.length > 0 ||
  Object.values(themeChecks).some((value) => !value) ||
  Object.values(neutralAssetChecks).some((check) =>
    Object.values(check).some((value) => !value),
  )
) {
  process.exit(1);
}

function stripPlaceholders(value) {
  return value.replace(/\{[^}]+}/g, "");
}

function isRuntimeTranslationOverlayLiteral(hit) {
  return (
    hit.surface ===
      "apps/web/src/features/automation-canvas/activepieces-canvas-wrapper.tsx" &&
    [
      "Activepieces",
      "Runs",
      "Publish",
      "Manual Run",
      "Connections",
      "Trigger",
      "Action",
      "Router",
      "Code",
      "Versions",
      "Step settings",
      "No results",
      "Create connection",
      "Test step",
      "Choose a piece",
      "Select a piece first",
      "Please select a piece first",
      "Loop on Items",
      "Manage Flow",
    ].includes(hit.value)
  );
}

function extractStringLiterals(source) {
  const literals = [];
  const pattern = /(["'`])((?:\\.|(?!\1)[\s\S])*)\1/g;
  let match;
  while ((match = pattern.exec(source))) {
    literals.push(match[2]);
  }
  return literals;
}

function hasForbiddenTerm(value, term) {
  if (term.includes(" ")) {
    return value.includes(term);
  }

  return new RegExp(`\\b${escapeRegExp(term)}\\b`).test(value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
