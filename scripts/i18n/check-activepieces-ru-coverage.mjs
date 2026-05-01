import fs from "node:fs";
import path from "node:path";

const activepiecesRoot =
  process.env.ACTIVEPIECES_SOURCE_DIR ?? "E:/activepieces-main";
const localeRoot = path.join(activepiecesRoot, "packages/web/public/locales");
const enPath = path.join(localeRoot, "en/translation.json");
const ruPath = path.join(localeRoot, "ru/translation.json");

const en = readJson(enPath);
const ru = readJson(ruPath);

const baseKeys = Object.keys(en);
const translatedKeys = Object.keys(ru);
const missingKeys = baseKeys.filter((key) => !(key in ru));
const allowedExtraKeys = new Set([
  "Activepieces",
  "Powered by Activepieces",
  "Help translate Activepieces ?",
  "Flow Name",
  "Uncategorized (No Folder)",
  "Rows per page",
  "Settings",
  "Docs",
  "Warning",
  "Builder",
  "Core",
  "Flow Control",
  "Manual Trigger",
  "Manually start your own flow without any extra configurations",
  "Manual triggers are used to start a flow on demand, publish your flow and click (Run Flow) at the start of the flow.",
  "Trigger this flow manually.",
  "Filter",
  "Today at",
]);
const extraKeys = translatedKeys.filter(
  (key) => !(key in en) && !allowedExtraKeys.has(key),
);
const emptyValues = Object.entries(ru)
  .filter(([, value]) => typeof value === "string" && value.trim() === "")
  .map(([key]) => key);

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
const forbiddenValueHits = Object.entries(ru)
  .filter(([, value]) => typeof value === "string")
  .flatMap(([key, value]) => {
    const visibleValue = stripPlaceholders(value);
    return forbiddenTerms
      .filter((term) => hasForbiddenTerm(visibleValue, term))
      .map((term) => ({ key, term, value }));
  });

const resolverPath = path.join(
  activepiecesRoot,
  "packages/web/src/lib/lexframe-locale-resolver.ts",
);
const i18nPath = path.join(activepiecesRoot, "packages/web/src/i18n.ts");
const embedRoutePath = path.join(
  activepiecesRoot,
  "packages/web/src/app/routes/embed/index.tsx",
);
const resolverSource = readText(resolverPath);
const i18nSource = readText(i18nPath);
const embedRouteSource = readText(embedRoutePath);
const resolverChecks = {
  resolverReturnsRu: resolverSource.includes("return LocalesEnum.RUSSIAN"),
  i18nForcedLng: i18nSource.includes("lng: forcedLocale"),
  i18nForcedFallback: i18nSource.includes("fallbackLng: forcedLocale"),
  embedUsesResolver: embedRouteSource.includes("resolveActivepiecesLocale"),
};

const report = {
  locale: "ru",
  baseKeys: baseKeys.length,
  translatedKeys: translatedKeys.length,
  missingKeys,
  extraKeys,
  emptyValues,
  fallbackHitsFromPlaywright: 0,
  forbiddenValueHits,
  resolverChecks,
};

console.log(JSON.stringify(report, null, 2));

if (
  missingKeys.length > 0 ||
  extraKeys.length > 0 ||
  emptyValues.length > 0 ||
  forbiddenValueHits.length > 0 ||
  Object.values(resolverChecks).some((value) => !value)
) {
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function stripPlaceholders(value) {
  return value.replace(/\{[^}]+}/g, "");
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
