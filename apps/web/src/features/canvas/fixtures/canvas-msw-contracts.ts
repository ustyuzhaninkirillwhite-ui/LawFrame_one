export const canvasMswContractEndpoints = [
  "GET /automations/:id/canvas",
  "POST /automations/:id/canvas/operations",
  "POST /automations/:id/canvas/validate",
  "POST /automations/:id/canvas/test-step",
  "POST /automations/:id/canvas/test-flow",
  "POST /automations/:id/canvas/compile-preview",
  "POST /automations/:id/canvas/publish",
  "GET /automations/:id/canvas/versions",
  "GET /automations/:id/canvas/runtime/sync-status",
  "POST /automations/:id/canvas/runtime/import-preview",
  "POST /activepieces/embed-token",
] as const;

export const canvasMswErrorFixtures = [
  { status: 403, code: "CANVAS_PERMISSION_DENIED" },
  { status: 409, code: "CANVAS_DRAFT_LOCKED" },
  { status: 409, code: "CANVAS_VERSION_CONFLICT" },
  { status: 422, code: "CANVAS_VALIDATION_FAILED" },
  { status: 422, code: "CANVAS_POLICY_BLOCKED" },
  { status: 424, code: "ACTIVEPIECES_RUNTIME_UNAVAILABLE" },
  { status: 424, code: "CONNECTION_MISSING" },
  { status: 500, code: "CANVAS_INTERNAL_ERROR" },
] as const;

export const canvasMswRequiredScenarios = [
  "valid draft loads",
  "draft loads with validation errors",
  "autosave succeeds",
  "autosave conflict",
  "publish blocked by validation",
  "compile preview succeeds",
  "compile preview fails",
  "runtime unavailable",
  "advanced builder token expired",
  "reverse sync conflict",
] as const;
