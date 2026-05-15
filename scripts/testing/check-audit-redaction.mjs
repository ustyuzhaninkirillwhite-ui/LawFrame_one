import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";

const root = process.cwd();
const requiredFiles = [
  "apps/backend/src/modules/settings/settings-redactor.spec.ts",
  "apps/backend/src/modules/canvas-ai/canvas-ai-redaction.service.spec.ts",
  "apps/backend/src/modules/documents/documents.service.spec.ts",
  "apps/backend/src/modules/settings/ai-settings.service.spec.ts",
  "apps/backend/src/modules/activepieces/activepieces-session.service.spec.ts",
];
const forbiddenAuditMetadataKeys = [
  "apiKey",
  "authorization",
  "Authorization",
  "signedUrl",
  "jwtToken",
  "tokenValue",
  "rawContent",
  "rawProviderResponse",
];
const failures = [];

function check(condition, label) {
  if (condition) {
    console.log(`OK: ${label}`);
    return;
  }

  console.error(`FAIL: ${label}`);
  failures.push(label);
}

for (const file of requiredFiles) {
  check(await exists(file), `Audit/redaction test exists: ${file}`);
}

const sourceFiles = await fg("apps/backend/src/**/*.ts", {
  cwd: root,
  ignore: ["**/*.spec.ts"],
});

for (const relativeFile of sourceFiles) {
  const text = await fs.readFile(path.join(root, relativeFile), "utf-8");
  const auditCalls = text.matchAll(
    /(?:auditService|auditWriter)\.record\(\{[\s\S]{0,1600}?metadata:\s*\{([\s\S]{0,900}?)\}/g,
  );

  for (const match of auditCalls) {
    const metadataBody = match[1] ?? "";
    for (const key of forbiddenAuditMetadataKeys) {
      check(
        !new RegExp(`\\b${key}\\b`).test(metadataBody),
        `${relativeFile} audit metadata does not include raw ${key}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("\nAudit redaction invariant check failed.");
  process.exitCode = 1;
} else {
  console.log("\nAudit redaction invariant check passed.");
}

async function exists(relativePath) {
  try {
    await fs.access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}
