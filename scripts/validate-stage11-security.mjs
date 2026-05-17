import fs from "node:fs/promises";
import path from "node:path";

const mode = process.argv.includes("--mode=rls") ? "rls" : "full";

const migrationFiles = [
  "supabase/migrations/000026_stage11_identity_sessions.sql",
  "supabase/migrations/000027_stage11_security_rls.sql",
  "supabase/migrations/000028_stage11_audit_secrets.sql",
  "supabase/migrations/000029_stage11_ai_documents_activepieces.sql",
  "supabase/migrations/000030_stage11_compliance_incidents_access_reviews.sql",
  "supabase/migrations/000031_stage11_release_gates.sql",
];

const routeChecks = [
  "/admin/security/overview",
  "/admin/security/sessions",
  "/admin/security/workspace-policies",
  "/security/reauth/challenge",
  "/security/reauth/verify",
  "/admin/security/secrets",
  "/admin/security/audit-events",
  "/admin/security/ai/policies",
  "/admin/security/activepieces",
  "/admin/security/alerts",
  "/admin/security/incidents",
  "/admin/compliance/processing-activities",
  "/admin/compliance/retention-policies",
  "/admin/compliance/dsr",
  "/admin/compliance/access-reviews",
];

const uiFiles = [
  "apps/web/src/app/(app)/admin/security/sessions/page.tsx",
  "apps/web/src/app/(app)/admin/security/policies/page.tsx",
  "apps/web/src/app/(app)/admin/security/secrets/page.tsx",
  "apps/web/src/app/(app)/admin/security/audit/page.tsx",
  "apps/web/src/app/(app)/admin/security/ai/page.tsx",
  "apps/web/src/app/(app)/admin/security/activepieces/page.tsx",
  "apps/web/src/app/(app)/admin/security/alerts/page.tsx",
  "apps/web/src/app/(app)/admin/security/incidents/page.tsx",
  "apps/web/src/app/(app)/admin/compliance/page.tsx",
  "apps/web/src/app/(app)/admin/access-reviews/page.tsx",
];

const failures = [];

async function read(relativePath) {
  return fs.readFile(path.resolve(relativePath), "utf-8");
}

async function exists(relativePath) {
  try {
    await fs.access(path.resolve(relativePath));
    return true;
  } catch {
    return false;
  }
}

function check(condition, label) {
  if (condition) {
    console.log(`OK: ${label}`);
    return;
  }

  console.error(`FAIL: ${label}`);
  failures.push(label);
}

for (const file of migrationFiles) {
  check(await exists(file), `Stage 11 migration exists: ${file}`);
}

if (mode === "full") {
  const [packageJson, openapi, apiClient, webPanels] = await Promise.all([
    read("package.json"),
    read("docs/contracts/api/openapi.yaml"),
    read("packages/api-client/src/index.ts"),
    read("apps/web/src/components/stage11-security-panels.tsx"),
  ]);

  check(packageJson.includes("\"validate:stage11-security\""), "Root package script registered: validate:stage11-security");

  for (const route of routeChecks) {
    check(openapi.includes(route), `OpenAPI documents Stage 11 route: ${route}`);
  }

  for (const method of [
    "listSecuritySessions",
    "createReauthChallenge",
    "listSecretsInventory",
    "listAiProviderPolicies",
    "getActivepiecesSecurityOverview",
    "listSecurityIncidents",
    "listAccessReviewCampaigns",
  ]) {
    check(apiClient.includes(`${method}:`), `API client exposes Stage 11 method: ${method}`);
  }

  for (const file of uiFiles) {
    check(await exists(file), `Admin UI route exists: ${file}`);
  }

  check(
    webPanels.includes("Stage11SecurityScaffold") &&
      webPanels.includes("ReauthCard") &&
      webPanels.includes("Stage11OverviewPanel"),
    "Security control plane panels are wired in the web app",
  );
}

if (failures.length > 0) {
  console.error(`\nStage 11 security validation failed (${mode}).`);
  process.exitCode = 1;
} else {
  console.log(`\nStage 11 security validation passed (${mode}).`);
}
