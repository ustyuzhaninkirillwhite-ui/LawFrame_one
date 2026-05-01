import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");
const apRoot = process.env.ACTIVEPIECES_SOURCE_DIR ?? "E:/activepieces-main";
const shouldWrite = process.argv.includes("--write");
const outputPath = resolve(packageRoot, "src/tokens/activepieces.generated.json");
const packageJsonPath = resolve(apRoot, "package.json");
const stylesPath = resolve(apRoot, "packages/web/src/styles.css");

if (!existsSync(packageJsonPath) || !existsSync(stylesPath)) {
  fail(`Activepieces source is not readable at ${apRoot}`);
}

const apPackage = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const styles = readFileSync(stylesPath, "utf8");
const source = {
  packageName: "activepieces",
  version: String(apPackage.version ?? "unknown"),
  sourceRoot: apRoot.replaceAll("\\", "/"),
  gitCommit: null,
  gitStatus: existsSync(resolve(apRoot, ".git"))
    ? "available:use-git-before-release"
    : "unavailable:no-git-metadata",
  packageManager: String(apPackage.packageManager ?? "unknown"),
  inspectedPaths: [
    "packages/web/src/styles.css",
    "packages/web/src/styles/globals.css",
    "packages/web/src/components/ui/button.tsx",
    "packages/web/src/components/ui/card.tsx",
    "packages/web/src/components/ui/badge.tsx",
    "packages/web/src/components/providers/theme-provider.tsx",
  ],
  licenseBoundary:
    "Derived from MIT-covered Activepieces web/style sources outside enterprise-only directories; no enterprise-only components or assets are copied.",
};

const cssVar = (name, fallback) => {
  const match = styles.match(new RegExp(`${escapeRegExp(name)}:\\s*([^;]+);`));
  return match?.[1]?.trim() ?? fallback;
};

const generated = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source,
  groups: JSON.parse(readFileSync(outputPath, "utf8")).groups.map((group) => {
    if (group.category !== "color") {
      return group;
    }

    return {
      ...group,
      tokens: group.tokens.map((token) => {
        if (token.name === "primary") {
          return { ...token, value: `hsl(${cssVar("--primary", "210 90% 50%")})` };
        }
        if (token.name === "success") {
          return { ...token, value: `hsl(${cssVar("--success", "160 60% 52%")})` };
        }
        if (token.name === "warning") {
          return { ...token, value: `hsl(${cssVar("--warning", "43 97% 56%")})` };
        }
        if (token.name === "destructive") {
          return { ...token, value: `hsl(${cssVar("--destructive", "351 95% 72%")})` };
        }
        return token;
      }),
    };
  }),
};

if (shouldWrite) {
  writeFileSync(outputPath, `${JSON.stringify(generated, null, 2)}\n`);
  console.log(`Wrote ${outputPath}`);
} else {
  console.log(JSON.stringify(generated, null, 2));
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fail(message) {
  console.error(message);
  console.error(`Repo root: ${repoRoot}`);
  process.exit(1);
}
