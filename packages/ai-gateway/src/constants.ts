export const AI_PROMPT_VERSIONS = {
  workflowPlanning: "workflow_planning_v1",
  workflowPatch: "workflow_patch_v1",
  redactionPreview: "redaction_preview_v1",
  documentAnalysis: "document_analysis_v1",
  recommendationToWorkflow: "recommendation_to_workflow_v1",
} as const;

export const AI_SCHEMA_IDS = {
  workflow: "lexframe.workflow.v1",
  workflowPatch: "lexframe.workflow_patch.v1",
  redactionPreview: "ai_redaction_preview_v1",
  plannerInput: "lexframe.ai.workflow_planner_input.v1",
  releaseManifest: "lexframe.release_manifest.v1",
} as const;
