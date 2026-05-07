import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const repoRoot = resolve(import.meta.dirname, "..");

export function resolveBackendRuntimeEntry(root = repoRoot) {
  return resolve(root, "apps", "backend", "dist", "main.js");
}

async function main() {
  process.chdir(repoRoot);
  await import(pathToFileURL(resolveBackendRuntimeEntry(repoRoot)).href);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
