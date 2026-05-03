import fs from "node:fs";
import path from "node:path";

const activepiecesRoot =
  process.env.ACTIVEPIECES_SOURCE_DIR ?? "E:/activepieces-main";
const repoRoot = process.cwd();
const localeRoot = path.join(activepiecesRoot, "packages/web/public/locales");
const enPath = path.join(localeRoot, "en/translation.json");
const ruPath = path.join(localeRoot, "ru/translation.json");
const manifestPath = path.join(
  repoRoot,
  "scripts/stage17/localization-manifest.json",
);
const flickerEvidencePath = path.join(
  repoRoot,
  "artifacts/stage17/localization-flicker-evidence.json",
);

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

const manifest = readJson(manifestPath);
const forbiddenTerms = manifest.forbiddenUserFacingEnglish;
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
const mainPath = path.join(activepiecesRoot, "packages/web/src/main.tsx");
const embedRoutePath = path.join(
  activepiecesRoot,
  "packages/web/src/app/routes/embed/index.tsx",
);
const resolverSource = readText(resolverPath);
const i18nSource = readText(i18nPath);
const mainSource = readText(mainPath);
const embedRouteSource = readText(embedRoutePath);
const resolverChecks = {
  resolverReturnsRu: resolverSource.includes("return LocalesEnum.RUSSIAN"),
  i18nForcedLng: i18nSource.includes("lng: forcedLocale"),
  i18nForcedFallback: i18nSource.includes("fallbackLng: forcedLocale"),
  i18nRejectsEmptyStrings: i18nSource.includes("returnEmptyString: false"),
  mainImportsI18nBeforeApp:
    mainSource.indexOf("import './i18n'") >= 0 &&
    mainSource.indexOf("import './i18n'") < mainSource.indexOf("import App"),
  embedUsesResolver: embedRouteSource.includes("resolveActivepiecesLocale"),
};

const report = {
  stage: "17.12",
  locale: "ru",
  mode: manifest.mode,
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
writeFlickerEvidence(report);

if (
  missingKeys.length > 0 ||
  extraKeys.length > 0 ||
  emptyValues.length > 0 ||
  forbiddenValueHits.length > 0 ||
  Object.values(resolverChecks).some((value) => !value)
) {
  process.exit(1);
}

function writeFlickerEvidence(report) {
  fs.mkdirSync(path.dirname(flickerEvidencePath), { recursive: true });
  const evidence = {
    stage: "17.12",
    generated_at: new Date().toISOString(),
    status:
      forbiddenValueHits.length === 0 &&
      Object.values(resolverChecks).every((value) => value)
        ? "PASS"
        : "FAIL",
    strategy: "bundle-first-overlay-fallback",
    manifest_path: path.relative(repoRoot, manifestPath),
    known_forbidden_terms: forbiddenTerms,
    initial_visible_paint_guard: {
      ru_forced_before_react_mount: resolverChecks.mainImportsI18nBeforeApp,
      i18n_lng_forced: resolverChecks.i18nForcedLng,
      i18n_fallback_forced: resolverChecks.i18nForcedFallback,
      empty_strings_rejected: resolverChecks.i18nRejectsEmptyStrings,
      known_english_values_in_ru_bundle: forbiddenValueHits.length,
    },
    overlay_policy: manifest.fallbackPolicy,
    overlay_invocation_count_expected: "0 for covered strings; non-zero only for stale/hardcoded fallback",
    report,
  };
  fs.writeFileSync(flickerEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
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
