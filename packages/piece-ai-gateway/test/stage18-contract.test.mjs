import assert from "node:assert/strict";
import {
  buildInvokeAiGatewayPayload,
  lexframeAiGatewayPieceContract,
} from "../dist/index.js";

const payload = buildInvokeAiGatewayPayload({
  route: "agent_general",
  task: "analyze_case_materials",
  inputRefs: [{ type: "document_version", id: "docv_test" }],
  outputSchema: "lexframe.ai.legal_analysis.v1",
});

assert.deepEqual(payload, {
  route: "agent_general",
  task: "analyze_case_materials",
  input_refs: [{ type: "document_version", id: "docv_test" }],
  output_schema: "lexframe.ai.legal_analysis.v1",
});

assert.equal(
  lexframeAiGatewayPieceContract.actions.invoke_ai_gateway.acceptsProviderKeyProps,
  false,
);

for (const forbidden of ["apiKey", "api_key", "provider", "model", "baseUrl", "prompt"]) {
  assert.throws(
    () =>
      buildInvokeAiGatewayPayload({
        route: "agent_general",
        task: "analyze_case_materials",
        inputRefs: [],
        outputSchema: "lexframe.ai.legal_analysis.v1",
        [forbidden]: "forbidden",
      }),
    /Forbidden Stage 18 AI Gateway piece field/,
  );
}

console.log("piece-ai-gateway stage18 contract tests passed");
