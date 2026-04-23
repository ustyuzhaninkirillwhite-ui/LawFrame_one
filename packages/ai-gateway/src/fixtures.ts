import { AI_PROMPT_VERSIONS, AI_SCHEMA_IDS } from "./constants";

export const aiPlannerFixtureInput = {
  message: "Подготовить автоматизацию претензионного порядка для клиента.",
  documents: [
    {
      id: "doc_claim_template",
      title: "Претензия",
      classification: "client_material",
    },
  ],
  templates: [
    {
      id: "tpl_claim",
      title: "Шаблон претензии",
      code: "claim-template",
    },
  ],
  profile: {
    jurisdiction: "RU",
    practiceArea: "litigation",
  },
  questions: [],
} as const;

export const aiSchemaCompatibilityMatrix = [
  {
    promptVersion: AI_PROMPT_VERSIONS.workflowPlanning,
    schemaId: AI_SCHEMA_IDS.workflow,
  },
  {
    promptVersion: AI_PROMPT_VERSIONS.workflowPatch,
    schemaId: AI_SCHEMA_IDS.workflowPatch,
  },
  {
    promptVersion: AI_PROMPT_VERSIONS.redactionPreview,
    schemaId: AI_SCHEMA_IDS.redactionPreview,
  },
] as const;
