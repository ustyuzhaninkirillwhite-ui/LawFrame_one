import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";

const root = process.cwd();
const failures = [];

function check(condition, label) {
  if (condition) {
    console.log(`OK: ${label}`);
    return;
  }

  console.error(`FAIL: ${label}`);
  failures.push(label);
}

const settingsContract = await read("packages/contracts/src/settings.ts");
const providerDtoBlock = extractInterface(
  settingsContract,
  "AiProviderConnectionDto",
);
const secretDtoBlock = extractInterface(settingsContract, "AiSecretStatusDto");
const createProviderBlock = extractInterface(
  settingsContract,
  "CreateAiProviderConnectionRequest",
);

check(
  /readonly apiKey\?: string/.test(createProviderBlock),
  "Create provider request accepts write-only apiKey",
);
check(
  !/\bapiKey\b|\bkey\b/.test(providerDtoBlock),
  "Provider connection response DTO has no raw key field",
);
check(
  /readonly secret: AiSecretStatusDto/.test(providerDtoBlock) &&
    /hasSecret/.test(secretDtoBlock) &&
    /fingerprint/.test(secretDtoBlock),
  "Provider connection response DTO exposes safe secret metadata",
);
check(
  settingsContract.includes('export type AiRouteGroup = "chat_ai" | "automation_ai"'),
  "AI route group contract keeps chat_ai and automation_ai explicit",
);

const apiClientFiles = await fg("packages/api-client/src/**/*.ts", {
  cwd: root,
  ignore: ["**/*.test.ts"],
});
const directProviderPatterns = [
  /api\.openai\.com/i,
  /api\.cometapi\.com/i,
  /\/chat\/completions/i,
  /\/models\b/i,
];

for (const relativeFile of apiClientFiles) {
  const text = await read(relativeFile);
  for (const pattern of directProviderPatterns) {
    check(
      !pattern.test(text),
      `${relativeFile} does not expose direct provider route ${pattern}`,
    );
  }
}

for (const file of [
  "packages/contracts/src/security-invariants.test.ts",
  "packages/api-client/src/settings-client.test.ts",
  "packages/ai-gateway/src/route-assets.test.ts",
]) {
  check(await exists(file), `Contract/API runtime test exists: ${file}`);
}

if (failures.length > 0) {
  console.error("\nContract security invariant check failed.");
  process.exitCode = 1;
} else {
  console.log("\nContract security invariant check passed.");
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf-8");
}

async function exists(relativePath) {
  try {
    await fs.access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

function extractInterface(text, name) {
  const start = text.indexOf(`export interface ${name}`);
  if (start === -1) {
    return "";
  }
  const next = text.indexOf("\nexport ", start + 1);
  return text.slice(start, next === -1 ? text.length : next);
}
