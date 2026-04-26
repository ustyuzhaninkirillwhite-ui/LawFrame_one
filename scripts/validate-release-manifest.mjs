import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import fs from "node:fs/promises";
import path from "node:path";

const schemaPath = path.resolve("packages/contracts/src/release/release-manifest.schema.json");
const manifestPath = path.resolve(
  process.env.LEXFRAME_RELEASE_MANIFEST_PATH ??
    "infra/deploy/release-manifest.example.json",
);

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
});
addFormats(ajv);

const schema = JSON.parse(await fs.readFile(schemaPath, "utf-8"));
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
const validate = ajv.compile(schema);

if (!validate(manifest)) {
  console.error("Release manifest validation failed.");
  console.error(validate.errors);
  process.exitCode = 1;
} else {
  console.log(`Release manifest is valid: ${manifestPath}`);
}
