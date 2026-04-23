import {
  AI_PROMPT_VERSIONS,
  AI_SCHEMA_IDS,
  aiGoldenPromptCases,
  aiPlannerInputSchema,
  aiEvalThresholds,
} from "../packages/ai-gateway/dist/index.js";

const failures = [];

function check(condition, label) {
  if (condition) {
    console.log(`OK: ${label}`);
    return;
  }

  console.error(`FAIL: ${label}`);
  failures.push(label);
}

check(Object.values(AI_PROMPT_VERSIONS).length >= 3, "AI prompt versions are published");
check(Object.values(AI_SCHEMA_IDS).length >= 4, "AI schema ids are published");
check(aiGoldenPromptCases.length >= 4, "Golden prompt cases are available");
check(aiEvalThresholds.minimumSchemaSuccessRate >= 0.95, "Schema success rate threshold is strict enough");
check(aiPlannerInputSchema?.$id === AI_SCHEMA_IDS.plannerInput, "Planner input schema id matches exported constant");

for (const promptCase of aiGoldenPromptCases) {
  check(
    typeof promptCase.promptVersion === "string" && promptCase.promptVersion.length > 0,
    `Prompt case ${promptCase.id} has a prompt version`,
  );
  check(
    typeof promptCase.expectedSchemaId === "string" && promptCase.expectedSchemaId.length > 0,
    `Prompt case ${promptCase.id} has an expected schema id`,
  );
}

if (failures.length > 0) {
  console.error("\nAI asset validation failed.");
  process.exitCode = 1;
} else {
  console.log("\nAI asset validation passed.");
}
