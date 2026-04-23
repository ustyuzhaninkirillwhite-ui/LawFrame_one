export * from "./ai";
export * from "./domain";
export * from "./legal";
export * from "./stage7";
export * from "./stage8";
export * from "./stage12";
export * from "./enums/data-classification";
export * from "./errors/error-codes";
export * from "./events/event-catalog";
export * from "./permissions/permission-codes";
export * from "./fixtures/demo-data";
export * from "./fixtures/ai-fixtures";
export * from "./fixtures/legal-fixtures";
export * from "./fixtures/recommendation-fixtures";

import workflowSchemaJson from "./workflow/workflow.schema.json";
import workflowPatchSchemaJson from "./workflow/workflow-patch.schema.json";
import releaseManifestSchemaJson from "./release/release-manifest.schema.json";

export const workflowSchema = workflowSchemaJson;
export const workflowPatchSchema = workflowPatchSchemaJson;
export const releaseManifestSchema = releaseManifestSchemaJson;
