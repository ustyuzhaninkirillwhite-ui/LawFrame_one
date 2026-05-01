import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inventory = JSON.parse(
  readFileSync(resolve(root, "src/tokens/activepieces.generated.json"), "utf8"),
);
const mapSource = readFileSync(
  resolve(root, "src/tokens/lexframe-to-activepieces.map.ts"),
  "utf8",
);
const recipeSource = readFileSync(resolve(root, "src/recipes/index.ts"), "utf8");
const cssSource = readFileSync(
  resolve(root, "src/css/activepieces-theme.css"),
  "utf8",
);

const requiredGroups = [
  "color",
  "radius",
  "border",
  "shadow",
  "spacing",
  "typography",
  "componentState",
  "componentRecipe",
];
const groups = new Map(inventory.groups.map((group) => [group.category, group]));

for (const category of requiredGroups) {
  const group = groups.get(category);
  if (!group || !Array.isArray(group.tokens) || group.tokens.length === 0) {
    fail(`Missing required token group: ${category}`);
  }
}

const requiredCssVariables = [
  "--lf-bg-app",
  "--lf-bg-card",
  "--lf-bg-panel",
  "--lf-bg-muted",
  "--lf-text-primary",
  "--lf-text-muted",
  "--lf-border",
  "--lf-border-input",
  "--lf-ring",
  "--lf-primary",
  "--lf-primary-fg",
  "--lf-success",
  "--lf-warning",
  "--lf-destructive",
  "--lf-info",
  "--lf-radius-control",
  "--lf-radius-card",
  "--lf-radius-panel",
  "--lf-shadow-card",
  "--lf-shadow-popover",
  "--lf-state-hover",
  "--lf-state-active",
  "--lf-state-disabled-opacity",
  "--lf-state-skeleton",
  "--lf-state-error-surface",
  "--lf-state-empty-surface",
];

for (const variable of requiredCssVariables) {
  if (!cssSource.includes(variable) || !mapSource.includes(variable)) {
    fail(`Missing CSS/map variable: ${variable}`);
  }
}

const requiredRecipes = [
  "buttonRecipe",
  "badgeRecipe",
  "cardRecipe",
  "formRecipe",
  "navigationRecipe",
  "panelRecipe",
  "tableRecipe",
  "overlayRecipe",
  "tabsRecipe",
  "skeletonRecipe",
];

for (const recipe of requiredRecipes) {
  if (!recipeSource.includes(`export const ${recipe}`)) {
    fail(`Missing recipe export: ${recipe}`);
  }
}

if (recipeSource.includes("packages/ee") || recipeSource.includes("server/api/src/app/ee")) {
  fail("Bridge recipes must not reference enterprise-only Activepieces paths.");
}

console.log("design-system-activepieces-bridge: token map validation passed");

function fail(message) {
  console.error(message);
  process.exit(1);
}
