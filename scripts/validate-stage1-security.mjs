import fs from "node:fs/promises";
import path from "node:path";

const requiredPermissions = [
  "workspace.invite",
  "workspace.member.update_role",
  "workspace.member.remove",
  "workspace.security.read",
  "workspace.security.manage",
  "audit.read",
];

const requiredTables = [
  "app.roles",
  "app.permissions",
  "app.role_permissions",
  "app.workspaces",
  "app.profiles",
  "app.workspace_members",
  "app.workspace_invitations",
  "audit.audit_events",
];

const requiredRlsPolicies = [
  "workspaces_select_member",
  "workspaces_update_manager",
  "workspace_members_select_member",
  "workspace_members_insert_inviter",
  "workspace_members_update_role_manager",
  "workspace_members_delete_manager",
  "workspace_invitations_manage",
  "audit_events_read",
];

const files = {
  schemas: "supabase/migrations/000005_stage1_schemas.sql",
  tables: "supabase/migrations/000006_stage1_access_tables.sql",
  rls: "supabase/migrations/000007_stage1_rls.sql",
  lockdown: "supabase/migrations/000008_stage1_lock_stage0_drafts.sql",
  seed: "supabase/seed/000001_stage0_seed.sql",
  pgtapSmoke: "supabase/tests/pgtap/rls_smoke.sql",
  pgtapMatrix: "supabase/tests/pgtap/stage1_access_matrix.sql",
  permissions: "packages/contracts/src/permissions/permission-codes.ts",
  openapi: "docs/contracts/api/openapi.yaml",
};

const loaded = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, relativePath]) => [
      key,
      await fs.readFile(path.resolve(relativePath), "utf-8"),
    ]),
  ),
);

const failures = [];

function check(condition, label) {
  if (condition) {
    console.log(`OK: ${label}`);
    return;
  }

  failures.push(label);
  console.error(`FAIL: ${label}`);
}

check(
  loaded.schemas.includes("create schema if not exists app;") &&
    loaded.schemas.includes("create schema if not exists api;") &&
    loaded.schemas.includes("create schema if not exists audit;") &&
    loaded.schemas.includes("create schema if not exists private;"),
  "Stage 1 schemas are created",
);

check(
  loaded.schemas.includes("revoke all on schema app from anon, authenticated;") &&
    loaded.schemas.includes("revoke all on schema audit from anon, authenticated;") &&
    loaded.schemas.includes("revoke all on schema private from anon, authenticated;"),
  "Private schemas are revoked from anon/authenticated data access",
);

for (const tableName of requiredTables) {
  check(
    loaded.tables.includes(`create table if not exists ${tableName} (`),
    `Required Stage 1 table exists in migration: ${tableName}`,
  );
  check(
    loaded.rls.includes(`alter table ${tableName} enable row level security;`),
    `RLS is enabled for ${tableName}`,
  );
}

check(
  loaded.rls.includes("create or replace function public.is_workspace_member(") &&
    loaded.rls.includes("security definer"),
  "Workspace membership helper function exists as security definer",
);

check(
  loaded.rls.includes("create or replace function public.has_workspace_permission("),
  "Workspace permission helper function exists",
);

for (const policyName of requiredRlsPolicies) {
  check(
    loaded.rls.includes(`create policy ${policyName}`),
    `RLS policy exists: ${policyName}`,
  );
}

for (const permission of requiredPermissions) {
  check(
    loaded.permissions.includes(`"${permission}"`) &&
      loaded.seed.includes(`'${permission}'`),
    `Atomic permission is present in contracts and seed: ${permission}`,
  );
}

check(
  loaded.rls.includes("create or replace view api.workspace_summaries as"),
  "API workspace summary view exists",
);

check(
  loaded.lockdown.includes("revoke all on public.workspaces from anon, authenticated;") &&
    loaded.lockdown.includes("revoke all on public.documents from anon, authenticated;"),
  "Stage 0 draft tables are locked down from direct client access",
);

check(
  loaded.pgtapSmoke.includes("select plan(18);"),
  "pgTAP smoke suite plan matches Stage 1 assertions",
);

check(
  loaded.pgtapMatrix.includes("workspaces_select_member") &&
    loaded.pgtapMatrix.includes("workspace_invitations_manage") &&
    loaded.pgtapMatrix.includes("api.workspace_summaries"),
  "Stage 1 pgTAP access matrix suite exists",
);

for (const route of [
  "/auth/bootstrap",
  "/session/context",
  "/workspaces",
  "/workspace-invitations/accept",
  "/rbac/roles",
  "/rbac/permissions",
  "/account/security",
  "/audit/events",
]) {
  check(
    loaded.openapi.includes(route),
    `OpenAPI documents Stage 1 route: ${route}`,
  );
}

if (failures.length > 0) {
  console.error("\nStage 1 security validation failed.");
  process.exitCode = 1;
} else {
  console.log("\nStage 1 security validation passed.");
}
