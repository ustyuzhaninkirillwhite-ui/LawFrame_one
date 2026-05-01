import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const activepiecesRoot =
  process.env.ACTIVEPIECES_SOURCE_DIR ?? "E:/activepieces-main";

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

const report = {
  forbiddenTerms,
  translationHits,
  stringLiteralHits,
  themeChecks,
};

console.log(JSON.stringify(report, null, 2));

if (
  translationHits.length > 0 ||
  stringLiteralHits.length > 0 ||
  Object.values(themeChecks).some((value) => !value)
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
    ["Activepieces", "Runs", "Publish"].includes(hit.value)
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
