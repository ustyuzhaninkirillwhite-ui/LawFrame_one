import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const repoRoot = resolve(import.meta.dirname, "..");

export function resolveBackendRuntimeEntry(root = repoRoot) {
  return resolve(root, "apps", "backend", "dist", "main.js");
}

async function main() {
  process.chdir(repoRoot);
  applyLocalRuntimeDefaults();
  await import(pathToFileURL(resolveBackendRuntimeEntry(repoRoot)).href);
}

export function applyLocalRuntimeDefaults() {
  process.env.PORT ??= process.env.STAGE16_BACKEND_PORT ?? "3104";
  process.env.AI_PROVIDER_MODE ??= "controlled-real";
  process.env.LEXFRAME_AI_SECRET_BACKEND ??= "supabase_vault";
  process.env.LEXFRAME_READINESS_PROFILE ??= "local-integrated";
  process.env.SUPABASE_DB_URL ??=
    process.env.STAGE16_SUPABASE_DB_URL ??
    "postgresql://postgres:postgres@127.0.0.1:54322/stage16_runtime";
  process.env.ACTIVEPIECES_POSTGRES_HOST ??= "127.0.0.1";
  process.env.ACTIVEPIECES_POSTGRES_PORT ??= "54323";
  process.env.ACTIVEPIECES_POSTGRES_DATABASE ??= "activepieces";
  process.env.ACTIVEPIECES_POSTGRES_USERNAME ??= "postgres";
  process.env.ACTIVEPIECES_POSTGRES_PASSWORD ??= "postgres";
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
