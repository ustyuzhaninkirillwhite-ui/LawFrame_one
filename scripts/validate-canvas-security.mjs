import fs from "node:fs/promises";
import path from "node:path";

const requiredPermissionCodes = [
  "canvas.add_node",
  "canvas.delete_node",
  "canvas.add_edge",
  "canvas.delete_edge",
  "canvas.edit_layout",
  "canvas.edit_node_config",
  "canvas.edit_bindings",
  "canvas.edit_conditions",
  "canvas.edit_error_handlers",
  "canvas.edit_approval_gates",
  "canvas.edit_delivery_steps",
  "canvas.edit_ai_steps",
  "canvas.edit_runtime_mapping",
  "canvas.compile",
  "canvas.sync_runtime",
  "canvas.view_compile_preview",
  "canvas.resolve_sync_conflict",
  "canvas.policy_override",
  "canvas.security_review",
  "canvas.audit_read",
  "canvas.audit_export",
  "canvas.connection_view",
  "canvas.connection_request",
  "canvas.connection_manage",
];

const canonicalPermissionCodes = [
  "canvas.version.view",
  "canvas.checkpoint.create",
  "canvas.publish.validate",
  "canvas.version.rollback",
  "canvas.version.emergency_disable",
  "canvas.version.restore_as_draft",
  "canvas.runtime.view",
  "canvas.runtime.pull",
  "canvas.runtime.import_preview",
  "canvas.runtime.import_apply",
  "canvas.runtime.reject_import",
  "canvas.runtime.overwrite",
  "canvas.test.validate",
  "canvas.test.view_redacted",
  "canvas.test.view_raw_data",
  "canvas.test.pin_data",
  "canvas.ai.use",
  "canvas.ai.apply_patch",
  "canvas.ai.configure_step",
  "canvas.open_advanced_builder",
  "canvas.view_raw_dsl",
  "canvas.import_runtime",
];

const requiredContractTypes = [
  "CanvasSecurityContext",
  "CanvasAccessDecision",
  "CanvasSecurityPolicy",
  "CanvasPolicyViolation",
  "CanvasAuditEventSummary",
  "CanvasDataVisibilityMode",
];

const requiredSecurityTables = [
  "app.canvas_security_policies",
  "app.canvas_policy_violations",
  "app.canvas_policy_override_requests",
  "app.canvas_runtime_import_reviews",
];

const requiredEmbedColumns = [
  "jti_hash",
  "canvas_role",
  "issued_for_automation_id",
  "issued_for_version_id",
  "revoked_at",
  "issued_reason",
];

const requiredOperationPolicyKeys = [
  "ADD_NODE_FROM_MODULE",
  "ADD_NODE",
  "DUPLICATE_NODE",
  "UPDATE_NODE",
  "MOVE_NODE",
  "DELETE_NODE",
  "ADD_EDGE",
  "DELETE_EDGE",
  "UPDATE_EDGE",
  "UPDATE_NODE_CONFIG",
  "UPDATE_LAYOUT",
  "UPSERT_WORKFLOW_INPUT",
  "DELETE_WORKFLOW_INPUT",
  "UPSERT_WORKFLOW_OUTPUT",
  "DELETE_WORKFLOW_OUTPUT",
  "UPSERT_INPUT_BINDING",
  "DELETE_INPUT_BINDING",
  "PIN_SAMPLE_DATA",
  "UNPIN_SAMPLE_DATA",
  "UPDATE_CONDITION",
  "UPDATE_WORKFLOW_POLICY",
  "UPDATE_NODE_POLICY",
  "SNAPSHOT_RESTORE",
  "RUNTIME_IMPORT_AS_DRAFT",
];

const requiredEndpointPolicyKeys = [
  "'compile-preview'",
  "compile:",
  "'sync-runtime'",
  "publish:",
  "rollback:",
  "'emergency-disable'",
  "'runtime-pull'",
  "'runtime-import-preview'",
  "'runtime-import-apply'",
  "'runtime-import-reject'",
  "'runtime-overwrite'",
  "'advanced-builder'",
  "'audit-read'",
  "'audit-export'",
];

const requiredSecurityEndpoints = [
  "canvas/security/context",
  "canvas/security/policies",
  "canvas/security/check-action",
  "canvas/security/request-override",
  "canvas/security/approve-override",
  "canvas/security/reject-override",
  "canvas/audit",
  "canvas/audit/:eventId",
  "canvas/audit/export",
  "canvas/audit/hash-chain/status",
];

const requiredUiSymbols = [
  "CanvasPermissionGate",
  "SecurityPolicyBadge",
  "RawDataAccessDialog",
  "ReauthRequiredDialog",
  "PolicyBlockBanner",
  "AuditReasonDialog",
  "RuntimeImportReviewDialog",
  "AdvancedBuilderAccessGate",
];

const forbiddenAuditTerms = [
  "raw",
  "prompt",
  "llm",
  "output",
  "token",
  "api[_-]?key",
  "private[_-]?key",
  "password",
  "signed[_-]?url",
  "document[_-]?text",
  "secret[_-]?value",
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

const files = {
  packageJson: "package.json",
  permissions: "packages/contracts/src/permissions/permission-codes.ts",
  contracts: "packages/contracts/src/canvas.ts",
  migration: "supabase/migrations/000044_stage16_16_canvas_security.sql",
  policyMap: "apps/backend/src/modules/canvas/canvas-security-policy-map.ts",
  authorization:
    "apps/backend/src/modules/canvas/canvas-authorization.service.ts",
  audit: "apps/backend/src/modules/canvas/canvas-audit.service.ts",
  dataVisibility:
    "apps/backend/src/modules/canvas/canvas-data-visibility.service.ts",
  controller: "apps/backend/src/modules/canvas/canvas.controller.ts",
  activepiecesService:
    "apps/backend/src/modules/activepieces/activepieces.service.ts",
  apiClient: "packages/api-client/src/index.ts",
  hooks: "apps/web/src/hooks/use-stage0-data.ts",
  securityUi:
    "apps/web/src/features/canvas/components/canvas-security-ui.tsx",
};

for (const file of Object.values(files)) {
  check(await exists(file), `Canvas security file exists: ${file}`);
}

const [
  packageJson,
  permissions,
  contracts,
  migration,
  policyMap,
  authorization,
  audit,
  dataVisibility,
  controller,
  activepiecesService,
  apiClient,
  hooks,
  securityUi,
] = await Promise.all(Object.values(files).map(read));

for (const permission of requiredPermissionCodes) {
  check(
    permissions.includes(`"${permission}"`) || migration.includes(`'${permission}'`),
    `Canvas-specific permission is registered: ${permission}`,
  );
}

for (const permission of canonicalPermissionCodes) {
  check(
    permissions.includes(`"${permission}"`),
    `Canonical Canvas permission remains registered: ${permission}`,
  );
}

for (const typeName of requiredContractTypes) {
  check(
    contracts.includes(typeName),
    `Canvas security contract type exists: ${typeName}`,
  );
}

check(
  await exists(files.migration),
  "Stage 16.16 migration exists",
);
check(
  !migration.includes("public.canvas_audit_events"),
  "Migration does not create duplicate public.canvas_audit_events",
);
check(
  migration.includes("audit.audit_events"),
  "Migration uses canonical audit.audit_events",
);

for (const table of requiredSecurityTables) {
  check(migration.includes(table), `Migration defines security table: ${table}`);
}

for (const column of requiredEmbedColumns) {
  check(
    migration.includes(column),
    `Migration extends activepieces embed sessions with ${column}`,
  );
}

for (const operation of requiredOperationPolicyKeys) {
  check(
    policyMap.includes(`${operation}:`),
    `Operation policy map covers ${operation}`,
  );
}

for (const endpoint of requiredEndpointPolicyKeys) {
  check(
    policyMap.includes(endpoint),
    `Endpoint policy map covers ${endpoint.replaceAll("'", "")}`,
  );
}

for (const endpoint of requiredSecurityEndpoints) {
  check(
    controller.includes(endpoint),
    `Canvas security/audit endpoint is wired: ${endpoint}`,
  );
}

for (const symbol of requiredUiSymbols) {
  check(securityUi.includes(symbol), `Frontend security UI exports ${symbol}`);
}

for (const method of [
  "getAutomationCanvasSecurityContext",
  "listAutomationCanvasSecurityPolicies",
  "checkAutomationCanvasSecurityAction",
  "requestAutomationCanvasPolicyOverride",
  "approveAutomationCanvasPolicyOverride",
  "rejectAutomationCanvasPolicyOverride",
  "listAutomationCanvasAuditEvents",
  "getAutomationCanvasAuditEvent",
  "exportAutomationCanvasAuditEvents",
  "getAutomationCanvasAuditHashChainStatus",
]) {
  check(apiClient.includes(method), `API client exposes ${method}`);
}

for (const hook of [
  "useCanvasSecurityContext",
  "useCanvasSecurityPolicies",
  "useCanvasSecurityCheck",
  "useCanvasPolicyOverrideRequest",
  "useCanvasPolicyOverrideDecision",
  "useCanvasAuditEvents",
]) {
  check(hooks.includes(hook), `Frontend data hook exists: ${hook}`);
}

check(
  authorization.includes("CANVAS_OPERATION_POLICY_MAP") &&
    authorization.includes("assertAutomationOwnership") &&
    authorization.includes("recordDecision"),
  "CanvasAuthorizationService enforces map, ownership and audit decisions",
);

check(
  dataVisibility.includes("metadata_only") &&
    dataVisibility.includes("structured_safe") &&
    dataVisibility.includes("redacted") &&
    dataVisibility.includes("raw") &&
    dataVisibility.includes("canvas.test.view_raw_data"),
  "CanvasDataVisibilityService implements redaction modes and raw permission",
);

for (const term of forbiddenAuditTerms) {
  check(
    audit.includes(term),
    `Canvas audit sanitizer denylist covers ${term}`,
  );
}

check(
  audit.includes("AuditService") && audit.includes("audit.audit_events"),
  "Canvas audit is a facade over canonical audit.audit_events",
);

check(
  activepiecesService.includes("Math.max(") &&
    activepiecesService.includes("Math.min(workspaceSecurity.tokenTtlSeconds, 300)") &&
    activepiecesService.includes("jti_hash") &&
    activepiecesService.includes("token_hash") &&
    activepiecesService.includes("this.hashValue(token)"),
  "Activepieces embed token TTL is capped and token hashes are stored",
);

check(
  packageJson.includes('"validate:canvas-security"'),
  "Root package script validate:canvas-security is registered",
);

check(
  packageJson.includes("validate:canvas-security") &&
    packageJson.includes("check:security"),
  "Canvas security validator is connected to the security gate",
);

if (failures.length > 0) {
  console.error(`\nCanvas security validation failed (${failures.length}).`);
  process.exitCode = 1;
} else {
  console.log("\nCanvas security validation passed.");
}
