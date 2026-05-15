import { AI_PROMPT_VERSIONS, AI_SCHEMA_IDS } from "./constants";
import {
  aiPlannerFixtureInput,
  aiSchemaCompatibilityMatrix,
} from "./fixtures";

test("AI gateway package assets expose schemas and prompts without provider secrets", () => {
  const serialized = JSON.stringify({
    AI_PROMPT_VERSIONS,
    AI_SCHEMA_IDS,
    aiPlannerFixtureInput,
    aiSchemaCompatibilityMatrix,
  });

  assertOk(Object.values(AI_PROMPT_VERSIONS).length >= 3);
  assertOk(
    Object.values(AI_SCHEMA_IDS).includes(
      "lexframe.ai.workflow_planner_input.v1",
    ),
  );
  assertEqual(serialized.includes("sk-"), false);
  assertEqual(serialized.includes("Authorization"), false);
  assertEqual(serialized.includes("apiKey"), false);
});

test("AI gateway schema compatibility matrix has no direct provider endpoint contract", () => {
  for (const item of aiSchemaCompatibilityMatrix) {
    assertMatch(item.promptVersion, /^[a-z0-9_]+_v\d+$/);
    assertMatch(item.schemaId, /^lexframe\.|^ai_/);
  }

  const serialized = JSON.stringify(aiSchemaCompatibilityMatrix);
  assertEqual(serialized.includes("/chat/completions"), false);
  assertEqual(serialized.includes("/models"), false);
  assertEqual(serialized.includes("api.openai.com"), false);
  assertEqual(serialized.includes("api.cometapi.com"), false);
});

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function assertOk(value: unknown, message = "Expected value to be truthy"): asserts value {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertMatch(actual: string, regex: RegExp): void {
  if (!regex.test(actual)) {
    throw new Error(`Expected ${actual} to match ${regex}`);
  }
}
