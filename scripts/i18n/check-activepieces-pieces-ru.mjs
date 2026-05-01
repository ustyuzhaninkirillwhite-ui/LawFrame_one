import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const locale = readLocaleArg();
const filePath = path.join(
  root,
  "packages/activepieces-legal-pieces/src/i18n",
  `${locale}.json`,
);

const requiredPackages = [
  "@lexframe/piece-ai-gateway",
  "@lexframe/piece-callback",
  "@lexframe/piece-legal-search",
  "@lexframe/piece-document-drafting",
  "@lexframe/piece-approval",
  "@lexframe/piece-delivery",
];

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

const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
const missingPackages = requiredPackages.filter((name) => !(name in data));
const shapeIssues = [];
const forbiddenValueHits = [];

for (const packageName of requiredPackages) {
  const entry = data[packageName];
  if (!entry) {
    continue;
  }

  if (!isNonEmptyString(entry.displayName)) {
    shapeIssues.push(`${packageName}: displayName`);
  }
  if (!isNonEmptyString(entry.description)) {
    shapeIssues.push(`${packageName}: description`);
  }
  if (!Array.isArray(entry.categories) || entry.categories.length === 0) {
    shapeIssues.push(`${packageName}: categories`);
  }
  if (!entry.actions && !entry.triggers) {
    shapeIssues.push(`${packageName}: actions/triggers`);
  }

  collectForbiddenHits(packageName, entry, forbiddenValueHits);
}

const report = {
  locale,
  requiredPackages,
  translatedPackages: requiredPackages.length - missingPackages.length,
  missingPackages,
  shapeIssues,
  forbiddenValueHits,
};

console.log(JSON.stringify(report, null, 2));

if (
  missingPackages.length > 0 ||
  shapeIssues.length > 0 ||
  forbiddenValueHits.length > 0
) {
  process.exit(1);
}

function readLocaleArg() {
  const index = process.argv.indexOf("--locale");
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return "ru";
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function collectForbiddenHits(pathPrefix, value, hits) {
  if (typeof value === "string") {
    const visibleValue = value.replace(/\{[^}]+}/g, "");
    for (const term of forbiddenTerms) {
      if (hasForbiddenTerm(visibleValue, term)) {
        hits.push({ path: pathPrefix, term, value });
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectForbiddenHits(`${pathPrefix}[${index}]`, item, hits),
    );
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      collectForbiddenHits(`${pathPrefix}.${key}`, nested, hits);
    }
  }
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
