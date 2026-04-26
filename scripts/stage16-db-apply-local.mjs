import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const database = process.env.STAGE16_TARGET_DB ?? "stage16_runtime";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    input: options.input,
    stdio: options.stdio ?? "pipe",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return result.stdout ?? "";
}

function container() {
  const id = run("docker", ["compose", "ps", "-q", "postgres"]).trim();
  if (!id) {
    throw new Error("postgres container not found");
  }
  return id;
}

function psql(id, args, input) {
  return run("docker", ["exec", "-i", id, "psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", ...args], {
    input,
  });
}

function resetTargetDatabase(id) {
  run("docker", [
    "exec",
    "-i",
    id,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `select pg_terminate_backend(pid) from pg_stat_activity where datname='${database}';`,
    "-c",
    `drop database if exists ${database};`,
    "-c",
    `create database ${database};`,
  ]);
}

function sortedSqlFiles(directory) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => join(directory, name));
}

function apply(id, file) {
  const relative = file.replace(`${root}\\`, "").replace(`${root}/`, "");
  console.log(`[stage16-db-local] apply ${relative}`);
  psql(id, [], readFileSync(file));
}

const id = container();
resetTargetDatabase(id);
apply(id, join(root, "scripts", "bootstrap-local-supabase-compat.sql"));
for (const file of sortedSqlFiles(join(root, "supabase", "migrations"))) {
  apply(id, file);
}
for (const file of sortedSqlFiles(join(root, "supabase", "seed"))) {
  apply(id, file);
}

const evidence = psql(id, [
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
