import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  compose,
  composePsql,
  isTransientPostgresError,
  repoRoot as root,
  waitForPostgresReady,
} from "./stage16-compose-utils.mjs";

const dbName = process.env.STAGE16_DB_NAME ?? "stage16_audit";
const keepDb = process.env.STAGE16_DB_KEEP === "1";
const postgresService = "postgres";

const requiredRelations = [
  "app.automation_canvas_drafts",
  "app.automation_canvas_operations",
  "app.automation_canvas_versions",
  "app.automation_canvas_locks",
  "app.automation_canvas_snapshots",
  "app.automation_canvas_validation_results",
  "app.automation_canvas_validation_issues",
  "app.canvas_validation_runs",
  "app.canvas_validation_issues",
  "app.automation_canvas_test_runs",
  "app.automation_canvas_test_run_steps",
  "app.canvas_test_runs",
  "app.canvas_test_run_steps",
  "app.automation_compile_reports",
  "app.activepieces_flow_snapshots",
  "app.automation_runtime_sync_events",
  "app.automation_runtime_bindings",
  "app.automation_runtime_projections",
  "audit.audit_events",
];

const requiredIndexes = [
  "idx_canvas_operations_draft_idempotency",
  "idx_canvas_drafts_automation",
  "idx_canvas_operations_draft_revision",
  "idx_canvas_versions_automation",
  "idx_canvas_validation_results_cache",
  "idx_canvas_test_runs_lookup",
  "idx_compile_reports_automation",
];

function psql(database, args, input) {
  return composePsql(postgresService, database, args, input);
}

function applyFile(database, filePath) {
  const relative = filePath.replace(`${root}\\`, "").replace(`${root}/`, "");
  process.stdout.write(`[stage16-db] apply ${relative}\n`);
  psql(database, [], readFileSync(filePath));
}

function sortedSqlFiles(directory) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => join(directory, name));
}

function resetDatabase() {
  psql("postgres", [
    "-c",
    `select pg_terminate_backend(pid) from pg_stat_activity where datname=${sqlLiteral(dbName)} and pid <> pg_backend_pid();`,
    "-c",
    `drop database if exists ${sqlIdentifier(dbName)};`,
    "-c",
    `create database ${sqlIdentifier(dbName)};`,
  ]);
}

function verify() {
  const relationSql = `
    select rel::text, coalesce(c.relkind::text, 'missing') as kind
    from unnest(array[${requiredRelations.map((rel) => `'${rel}'::text`).join(",")}]) as r(rel)
    left join pg_class c on c.oid = to_regclass(r.rel);
  `;
  const relations = psql(dbName, ["-Atc", relationSql]).trim().split(/\r?\n/).filter(Boolean);
  const missingRelations = relations.filter((line) => line.endsWith("|missing"));
  if (missingRelations.length > 0) {
    throw new Error(`missing Stage 16 relations:\n${missingRelations.join("\n")}`);
  }

  const indexSql = `
    select idx::text, exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'i' and c.relname = idx
    )
    from unnest(array[${requiredIndexes.map((idx) => `'${idx}'::text`).join(",")}]) as r(idx);
  `;
  const indexes = psql(dbName, ["-Atc", indexSql]).trim().split(/\r?\n/).filter(Boolean);
  const missingIndexes = indexes.filter((line) => line.endsWith("|f"));
  if (missingIndexes.length > 0) {
    throw new Error(`missing Stage 16 indexes:\n${missingIndexes.join("\n")}`);
  }

  const seedSql = `
    select
      (select count(*) from app.workspaces where slug like 'stage16-live-%') as workspaces,
      (select count(*) from app.workspace_members where workspace_id='16000000-0000-4000-8000-00000000100a') as workspace_a_members,
      (select count(*) from app.legal_modules where code like 'stage16.audit.%') as modules,
      (select count(*) from app.runtime_connections where code like 'stage16-%' or code = 'email_provider') as connections,
      (select count(*) from app.installed_automations where id='16000000-0000-4000-8000-000000008001') as automations,
      (select count(*) from app.role_permissions where permission_code like 'canvas.%') as canvas_role_permissions;
  `;
  const seedEvidence = psql(dbName, ["-Atc", seedSql]).trim();
  const [workspaces, members, modules, connections, automations, canvasPermissions] = seedEvidence.split("|").map(Number);
  if (workspaces < 2 || members < 5 || modules < 11 || connections < 4 || automations < 1 || canvasPermissions < 1) {
    throw new Error(`Stage 16 seed verification failed: ${seedEvidence}`);
  }

  const constraintSql = `
    select conname
    from pg_constraint
    where conname in (
      'permissions_scope_check',
      'automation_canvas_operations_operation_type_check',
      'automation_canvas_versions_status_check',
      'automation_runtime_bindings_status_check'
    )
    order by conname;
  `;
  const constraints = psql(dbName, ["-Atc", constraintSql]).trim().split(/\r?\n/).filter(Boolean);
  if (constraints.length < 4) {
    throw new Error(`Stage 16 constraint verification failed: ${constraints.join(", ")}`);
  }

  process.stdout.write(`[stage16-db] verified relations=${relations.length} indexes=${indexes.length} seed=${seedEvidence}\n`);
}

function cleanup() {
  if (keepDb) {
    process.stdout.write(`[stage16-db] keeping ${dbName} because STAGE16_DB_KEEP=1\n`);
    return;
  }
  psql("postgres", [
    "-c",
    `select pg_terminate_backend(pid) from pg_stat_activity where datname=${sqlLiteral(dbName)} and pid <> pg_backend_pid();`,
    "-c",
    `drop database if exists ${sqlIdentifier(dbName)};`,
  ]);
  process.stdout.write(`[stage16-db] cleaned ${dbName}\n`);
}

function withPostgresRetry(label, fn) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      waitForPostgresReady(postgresService, "postgres");
      return fn();
    } catch (error) {
      if (attempt === 2 || !isTransientPostgresError(error)) {
        throw error;
      }
      process.stdout.write(
        `[stage16-db] ${label} hit transient postgres readiness error; waiting and retrying once\n`,
      );
      waitForPostgresReady(postgresService, "postgres");
    }
  }
  return null;
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

process.stdout.write("[stage16-db] ensuring local-integrated postgres is running\n");
compose(["up", "-d", postgresService], { stdio: "inherit" });
waitForPostgresReady(postgresService, "postgres");

let verified = false;

try {
  withPostgresRetry("reset", resetDatabase);
  applyFile(dbName, join(root, "scripts", "bootstrap-local-supabase-compat.sql"));
  for (const file of sortedSqlFiles(join(root, "supabase", "migrations"))) {
    applyFile(dbName, file);
  }
  for (const file of sortedSqlFiles(join(root, "supabase", "seed"))) {
    applyFile(dbName, file);
  }
  verify();
  verified = true;
} finally {
  cleanup();
}

if (!verified) {
  process.exitCode = 1;
}
