import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";

const root = process.cwd();
const files = await fg(["supabase/migrations/**/*.sql", "supabase/tests/**/*.sql", "supabase/seed/**/*.sql"], {
  cwd: root,
});
const patterns = [
  {
    name: "OpenAI-style API key",
    regex: /\bsk-[A-Za-z0-9]{16,}\b/g,
  },
  {
    name: "JWT-like literal",
    regex: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "signed URL-like artifact",
    regex: /https?:\/\/[^\s'"]+(?:X-Amz-Signature|Signature=|access_token=|token=)[^\s'"]*/gi,
  },
  {
    name: "private key block",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g,
  },
];
const failures = [];

for (const relativeFile of files) {
  const text = await fs.readFile(path.join(root, relativeFile), "utf-8");
  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern.regex)];
    for (const match of matches) {
      failures.push(`${relativeFile}: ${pattern.name}: ${match[0].slice(0, 80)}`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  console.error("\nDB secret-like value check failed.");
  process.exitCode = 1;
} else {
  console.log(`OK: scanned ${files.length} SQL files for secret-like literals.`);
  console.log("\nDB secret-like value check passed.");
}
