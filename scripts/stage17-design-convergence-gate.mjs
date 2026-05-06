import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "packages/design-system-activepieces-bridge/package.json",
  "packages/design-system-activepieces-bridge/src/tokens/activepieces.generated.json",
  "packages/design-system-activepieces-bridge/src/tokens/lexframe-to-activepieces.map.ts",
  "packages/design-system-activepieces-bridge/src/css/activepieces-theme.css",
  "packages/design-system-activepieces-bridge/src/tailwind/activepieces.preset.ts",
  "packages/design-system-activepieces-bridge/src/recipes/index.ts",
  "apps/web/src/providers/theme-provider.tsx",
  "docs/stage17/17.8/design-token-mapping.md",
  "docs/stage17/17.8/acceptance-report.md",
  "docs/evidence/stage17/17.8/evidence-manifest.json",
];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) {
    fail(`Missing required 17.8 artifact: ${file}`);
  }
}

const webPackage = readJson("apps/web/package.json");
if (!webPackage.dependencies?.["@lexframe/design-system-activepieces-bridge"]) {
  fail("apps/web must depend on @lexframe/design-system-activepieces-bridge.");
}

const globals = read("apps/web/src/app/globals.css");
for (const importPath of [
  "@lexframe/design-system-activepieces-bridge/css/activepieces-theme.css",
  "@lexframe/design-system-activepieces-bridge/css/activepieces-theme.dark.css",
]) {
  if (!globals.includes(importPath)) {
    fail(`globals.css does not import ${importPath}`);
  }
}

const rootLayout = read("apps/web/src/app/layout.tsx");
if (!rootLayout.includes("lexframe-ui-theme") || !rootLayout.includes("suppressHydrationWarning")) {
  fail("Root layout must bootstrap the persisted light/dark theme before hydration.");
}

const appProviders = read("apps/web/src/providers/app-providers.tsx");
if (!appProviders.includes("ThemeProvider")) {
  fail("AppProviders must wrap the app with ThemeProvider.");
}

for (const file of [
  "apps/web/src/components/ui/button.tsx",
  "apps/web/src/components/ui/card.tsx",
  "apps/web/src/components/ui/badge.tsx",
  "apps/web/src/components/ui/input.tsx",
  "apps/web/src/components/ui/textarea.tsx",
]) {
  if (!read(file).includes("@lexframe/design-system-activepieces-bridge/recipes")) {
    fail(`${file} does not consume bridge recipes.`);
  }
}

const canvasWrapper = read("apps/web/src/features/automation-canvas/activepieces-canvas-wrapper.tsx");
for (const forbidden of ["hideFlowName: true", "disableNavigation: true", "hideExportAndImportFlow: true"]) {
  if (canvasWrapper.includes(forbidden)) {
    fail(`Activepieces Canvas wrapper contains forbidden stock-like drift: ${forbidden}`);
  }
}
if (!canvasWrapper.includes("styling") || !canvasWrapper.includes("mode: themeRef.current")) {
  fail("Activepieces Canvas wrapper must pass the selected light/dark mode through embedding.styling.mode.");
}

const provisioning = read("apps/backend/src/modules/activepieces/activepieces-canvas-provisioning.service.ts");
if (provisioning.includes("'#1688fe'")) {
  fail("Activepieces provisioning must not use the LexFrame blue as the AP platform primary.");
}

const bridgeSource = read("packages/design-system-activepieces-bridge/src/recipes/index.ts");
for (const forbidden of ["packages/ee", "server/api/src/app/ee"]) {
  if (bridgeSource.includes(forbidden)) {
    fail(`Bridge recipes reference enterprise-only path: ${forbidden}`);
  }
}

for (const variable of [
  "--lf-ap-primary",
  "--lf-ap-primary-hover",
  "--lf-domain-primary",
  "--lf-domain-primary-hover",
]) {
  if (!globals.includes(variable) && !read("packages/design-system-activepieces-bridge/src/css/activepieces-theme.css").includes(variable)) {
    fail(`Missing hybrid accent token: ${variable}`);
  }
}

console.log("stage17-design-convergence-gate: passed");

function read(file) {
  return readFileSync(resolve(root, file), "utf8");
}

function readJson(file) {
  return JSON.parse(read(file));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
