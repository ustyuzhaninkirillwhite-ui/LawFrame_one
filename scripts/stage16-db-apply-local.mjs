import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  compose,
  composePsql,
  repoRoot as root,
  waitForPostgresReady,
} from "./stage16-compose-utils.mjs";

const database = process.env.STAGE16_TARGET_DB ?? "stage16_runtime";
const postgresService = "postgres";

function psql(args, input) {
  return composePsql(postgresService, "postgres", args, input);
}

function targetPsql(args, input) {
  return composePsql(postgresService, database, args, input);
}

function resetTargetDatabase() {
  psql([
    "-c",
    `select pg_terminate_backend(pid) from pg_stat_activity where datname=${sqlLiteral(database)} and pid <> pg_backend_pid();`,
    "-c",
    `drop database if exists ${sqlIdentifier(database)};`,
    "-c",
    `create database ${sqlIdentifier(database)};`,
  ]);
}

function sortedSqlFiles(directory) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => join(directory, name));
}

function apply(file) {
  const relative = file.replace(`${root}\\`, "").replace(`${root}/`, "");
  console.log(`[stage16-db-local] apply ${relative}`);
  targetPsql([], readFileSync(file));
}

function stopAppServices() {
  const stopped = compose(["stop", "backend", "web", "stage16-db-bootstrap", "stage16-activepieces-catalog-sync"], {
    allowFailure: true,
    stdio: "inherit",
    label: "stop app/bootstrap services before DB reset",
  });
  if (stopped.status !== 0) {
    console.log("[stage16-db-local] service stop was non-fatal; continuing with DB reset");
  }
  compose(["rm", "-f", "-s", "stage16-db-bootstrap", "stage16-activepieces-catalog-sync"], {
    allowFailure: true,
    stdio: "inherit",
    label: "remove one-shot bootstrap/catalog containers before DB reset",
  });
}

function syncCatalogAndRestartApps() {
  compose(
    [
      "run",
      "--rm",
      "--no-deps",
      "stage16-activepieces-catalog-sync",
    ],
    {
      stdio: "inherit",
      label: "stage16 activepieces catalog sync",
    },
  );
  compose(
    [
      "up",
      "-d",
      "--no-deps",
      "--force-recreate",
      "--build",
      "backend",
      "web",
    ],
    {
      stdio: "inherit",
      label: "recreate backend/web after DB apply",
    },
  );
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

compose(["up", "-d", postgresService], { stdio: "inherit" });
waitForPostgresReady(postgresService, "postgres");
stopAppServices();
waitForPostgresReady(postgresService, "postgres");
resetTargetDatabase();
apply(join(root, "scripts", "bootstrap-local-supabase-compat.sql"));
for (const file of sortedSqlFiles(join(root, "supabase", "migrations"))) {
  apply(file);
}
for (const file of sortedSqlFiles(join(root, "supabase", "seed"))) {
  apply(file);
}

const evidence = targetPsql([
  "-Atc",
  `
    select
      to_regclass('app.automation_canvas_drafts'),
      to_regclass('app.automation_canvas_operations'),
      to_regclass('app.automation_canvas_versions'),
      to_regclass('app.canvas_validation_runs'),
      to_regclass('app.canvas_test_runs'),
      (select count(*) from app.workspaces where slug like 'stage16-live-%'),
      (select count(*) from app.legal_modules where code like 'stage16.audit.%');
  `,
]).trim();

console.log(`[stage16-db-local] verified ${evidence}`);
syncCatalogAndRestartApps();
