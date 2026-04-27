import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const self = path.normalize("scripts/stage16-validate-compose-helpers.mjs");
const banned = [
  {
    label: "docker compose quiet ps",
    regex: /docker\s+compose\s+ps\s+-q/i,
  },
  {
    label: "compose quiet ps",
    regex: /compose\s+ps\s+-q/i,
  },
  {
    label: "activepieces quiet ps",
    regex: /ps\s+-q\s+activepieces-postgres/i,
  },
  {
    label: "compose args quiet ps",
    regex: /\[\s*["']compose["']\s*,\s*["']ps["']\s*,\s*["']-q["']/i,
  },
  {
    label: "ps args quiet flag",
    regex: /\[\s*["']ps["']\s*,\s*["']-q["']/i,
  },
];

const files = await fg(["scripts/**/*.{js,mjs,ts}", "tests/**/*.{js,mjs,ts}"], {
  cwd: root,
  absolute: false,
  onlyFiles: true,
  ignore: [
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "**/*evidence*/**",
    self.replaceAll("\\", "/"),
    "scripts/stage16-mutation-proof.mjs",
  ],
});

const findings = [];
for (const file of files) {
  const normalized = path.normalize(file);
  const content = await fs.readFile(path.join(root, normalized), "utf8");
  for (const rule of banned) {
    if (rule.regex.test(content)) {
      findings.push(`${rule.label}: ${normalized}`);
    }
  }
}

if (findings.length > 0) {
  console.error("[stage16-compose-helpers] forbidden Docker Compose helper patterns found:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log(`[stage16-compose-helpers] PASS scanned=${files.length}`);
