import { AI_PROMPT_VERSIONS, AI_SCHEMA_IDS } from "./constants";

export const plannerSystemPrompt = `
You are the LexFrame workflow planner.
Return only structured JSON that matches the requested schema.
Prefer deterministic legal workflow steps, explicit approvals and safe defaults.
Never route class-C client data to providers that are not allowed for confidential traffic.
`.trim();

export const workflowPatchSystemPrompt = `
You update an existing LexFrame workflow draft.
Preserve stable step identifiers when possible and emit only the minimal safe patch.
Do not remove approval, validation or delivery gates unless the user explicitly requests it.
`.trim();

export const redactionPreviewSystemPrompt = `
You classify sensitive spans before external AI routing.
Return only structured entities and avoid expanding the user's content.
`.trim();

export function renderPlannerUserPrompt(envelope: {
  readonly message: string;
  readonly documents: readonly {
    readonly id: string;
    readonly title: string;
    readonly classification: string;
  }[];
  readonly templates: readonly {
    readonly id: string;
    readonly title: string;
    readonly code: string;
  }[];
  readonly profile: unknown;
  readonly questions: readonly unknown[];
}) {
  return [
    `prompt_version=${AI_PROMPT_VERSIONS.workflowPlanning}`,
    `schema_id=${AI_SCHEMA_IDS.plannerInput}`,
    `message=${envelope.message}`,
    `documents=${JSON.stringify(envelope.documents)}`,
    `templates=${JSON.stringify(envelope.templates)}`,
    `profile=${JSON.stringify(envelope.profile)}`,
    `questions=${JSON.stringify(envelope.questions)}`,
  ].join("\n");
}
