import SwaggerParser from "@apidevtools/swagger-parser";
import path from "node:path";

const openApiPath = path.resolve("docs/contracts/api/openapi.yaml");

try {
  await SwaggerParser.validate(openApiPath);
  console.log(`OpenAPI contract is valid: ${openApiPath}`);
} catch (error) {
  console.error("OpenAPI validation failed.");
  console.error(error);
  process.exitCode = 1;
}

