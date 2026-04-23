import plannerInputSchemaJson from "./schemas/workflow-planner-input.schema.json";
import { releaseManifestSchema } from "@lexframe/contracts";
import { AI_PROMPT_VERSIONS, AI_SCHEMA_IDS } from "./constants";

export * from "./prompts";
export * from "./fixtures";
export * from "./evals";
export * from "./constants";

export const aiPlannerInputSchema = plannerInputSchemaJson;
export const releaseManifestSchemaJson = releaseManifestSchema;

export interface AiPlannerPromptDocument {
  readonly id: string;
  readonly title: string;
  readonly classification: string;
}

export interface AiPlannerPromptTemplate {
  readonly id: string;
  readonly title: string;
  readonly code: string;
}

export interface AiPlannerPromptEnvelope {
  readonly version: typeof AI_PROMPT_VERSIONS.workflowPlanning;
  readonly schemaId: typeof AI_SCHEMA_IDS.plannerInput;
  readonly message: string;
  readonly documents: readonly AiPlannerPromptDocument[];
  readonly templates: readonly AiPlannerPromptTemplate[];
  readonly profile: Record<string, unknown> | null;
  readonly questions: readonly Record<string, unknown>[];
}

export function buildPlannerPromptEnvelope(input: {
  readonly message: string;
  readonly documents: readonly AiPlannerPromptDocument[];
  readonly templates: readonly AiPlannerPromptTemplate[];
  readonly profile: Record<string, unknown> | null;
  readonly questions: readonly Record<string, unknown>[];
}): AiPlannerPromptEnvelope {
  return {
    version: AI_PROMPT_VERSIONS.workflowPlanning,
    schemaId: AI_SCHEMA_IDS.plannerInput,
    message: input.message,
    documents: input.documents,
    templates: input.templates,
    profile: input.profile,
    questions: input.questions,
  };
}

export const aiGoldenPromptCases = [
  {
    id: "workflow_public_baseline",
    title: "Public workflow planning baseline",
    promptVersion: AI_PROMPT_VERSIONS.workflowPlanning,
    expectedSchemaId: AI_SCHEMA_IDS.workflow,
    classification: "A_PUBLIC",
  },
  {
    id: "workflow_confidential_blocked",
    title: "Confidential workflow requires protected route",
    promptVersion: AI_PROMPT_VERSIONS.workflowPlanning,
    expectedSchemaId: AI_SCHEMA_IDS.workflow,
    classification: "C_CONFIDENTIAL_CLIENT",
  },
  {
    id: "workflow_patch_update",
    title: "Patch existing automation draft",
    promptVersion: AI_PROMPT_VERSIONS.workflowPatch,
    expectedSchemaId: AI_SCHEMA_IDS.workflowPatch,
    classification: "B_INTERNAL_WORKSPACE",
  },
  {
    id: "redaction_preview",
    title: "Preview redaction before external routing",
    promptVersion: AI_PROMPT_VERSIONS.redactionPreview,
    expectedSchemaId: AI_SCHEMA_IDS.redactionPreview,
    classification: "C_CONFIDENTIAL_CLIENT",
  },
] as const;

export const aiEvalThresholds = {
  minimumSchemaSuccessRate: 0.99,
  maximumValidationErrorRate: 0.01,
  maximumBlockedFallbackRate: 0.05,
} as const;
