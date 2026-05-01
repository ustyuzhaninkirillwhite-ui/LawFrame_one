import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputPath = path.join(root, "artifacts", "stage17", "browser-secret-scan.json");
const configuredTargets = process.env.STAGE17_BROWSER_EVIDENCE_DIRS
  ? process.env.STAGE17_BROWSER_EVIDENCE_DIRS.split(path.delimiter)
  : [
      "artifacts/stage17",
      "tests/e2e/test-results",
      "tests/e2e/playwright-report",
      "apps/web/.next/static",
    ];

const secretPatterns = [
  { label: "OpenAI-like key", regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { label: "xAI key", regex: /\bxai-[A-Za-z0-9_-]{20,}\b/g },
  { label: "CometAPI key", regex: /\bcomet(?:api)?[-_][A-Za-z0-9_-]{20,}\b/gi },
  { label: "Anthropic-like key", regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  {
    label: "Bearer provider header",
    regex: /authorization["']?\s*[:=]\s*["']?Bearer\s+[A-Za-z0-9._-]{24,}/gi,
  },
  {
    label: "raw secret JSON field",
    regex:
      /"(?:api_key|provider_key|private_key|service_role_key|signing_private_key)"\s*:\s*"(?!REDACTED|redacted|null|undefined|demo_|test_|example_|placeholder|<[^>]+>|PASTE_KEY_HERE)[^"]{12,}"/gi,
  },
  {
    label: "public provider secret env",
    regex:
      /\bNEXT_PUBLIC_(?:(?:OPENAI|XAI|COMET|ANTHROPIC|GEMINI|GOOGLE|MISTRAL|TOGETHER|OPENROUTER|COHERE|DEEPSEEK|GROQ|PERPLEXITY)_[A-Z0-9_]*(?:KEY|SECRET|TOKEN)|[A-Z0-9_]*(?:PROVIDER|OWNER)[A-Z0-9_]*(?:KEY|SECRET|TOKEN))\b/g,
  },
  {
    label: "Supabase secret/service payload",
    regex: /\b(?:sb_secret_|service_role)[A-Za-z0-9_-]{10,}\b/gi,
  },
];

const result = {
  stage: "17.10",
  status: "PASS",
  generated_at: new Date().toISOString(),
  targets: configuredTargets,
  scanned_files: 0,
  missing_targets: [],
  findings: [],
};

for (const target of configuredTargets) {
  const absoluteTarget = path.resolve(root, target);
  if (!fs.existsSync(absoluteTarget)) {
    result.missing_targets.push(target);
    continue;
  }

  for (const file of walk(absoluteTarget)) {
    if (!isScannable(file)) {
      continue;
    }

    result.scanned_files += 1;
    const content = fs.readFileSync(file, "utf8");
    for (const pattern of secretPatterns) {
      pattern.regex.lastIndex = 0;
      const matches = [...content.matchAll(pattern.regex)];
      if (matches.length > 0) {
        result.findings.push({
          file: path.relative(root, file),
          label: pattern.label,
          count: matches.length,
        });
      }
    }
  }
}

if (result.scanned_files === 0) {
  result.status = "FAIL";
  result.findings.push({
    file: null,
    label: "no browser evidence files found",
    count: 1,
  });
}

if (result.findings.length > 0) {
  result.status = "FAIL";
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

if (result.status !== "PASS") {
  console.error("[stage17:browser-evidence] FAIL");
  console.error(JSON.stringify(result.findings, null, 2));
  process.exit(2);
}

console.log(`[stage17:browser-evidence] PASS scannedFiles=${result.scanned_files}`);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectory(entry.name)) {
        yield* walk(fullPath);
      }
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

function ignoredDirectory(name) {
  return name === "node_modules" || name === ".git" || name === "cache";
}

function isScannable(file) {
  return /\.(?:har|json|html|js|mjs|map|txt|log|md|css)$/i.test(file);
}
