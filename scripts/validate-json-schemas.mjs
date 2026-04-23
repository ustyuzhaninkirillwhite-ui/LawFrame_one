import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
});
addFormats(ajv);

const schemaPaths = await fg(["packages/**/src/**/*.schema.json"], {
  ignore: ["**/node_modules/**"],
});

if (schemaPaths.length === 0) {
  console.error("No JSON schemas found.");
  process.exitCode = 1;
} else {
  for (const schemaPath of schemaPaths) {
    const fullPath = path.resolve(schemaPath);
    const schema = JSON.parse(await fs.readFile(fullPath, "utf-8"));
    const valid = ajv.validateSchema(schema);

    if (!valid) {
      console.error(`Schema validation failed: ${schemaPath}`);
      console.error(ajv.errors);
      process.exitCode = 1;
    } else {
      console.log(`Schema OK: ${schemaPath}`);
    }
  }
}
