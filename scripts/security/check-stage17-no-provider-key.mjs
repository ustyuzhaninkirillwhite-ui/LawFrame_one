import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputPath = path.join(
  root,
  "artifacts",
  "stage17",
  "browser-secret-scan.json",
);
const targets = [
  path.join(root, "apps", "web", ".next", "static"),
  path.join(root, "artifacts", "stage17"),
  path.join(root, "docs", "stage17"),
];
const secretPatterns = [
  { label: "OpenAI-like key", regex: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { label: "xAI key", regex: /\bxai-[A-Za-z0-9_-]{20,}\b/g },
  { label: "CometAPI key", regex: /\bcomet(?:api)?[-_][A-Za-z0-9_-]{20,}\b/gi },
  { label: "Anthropic-like key", regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { label: "Bearer provider header", regex: /authorization["']?\s*[:=]\s*["']Bearer\s+[A-Za-z0-9._-]{20,}/gi },
  {
    label: "raw provider key field",
    regex:
      /"(?:api_key|provider_key|private_key)"\s*:\s*"(?!REDACTED|redacted|null|undefined|demo_|test_|example_|placeholder)[^"]{12,}"/gi,
  },
  {
    label: "raw AI material field",
    regex:
      /"(?:raw_prompt|raw_output|document_text|client_material_text)"\s*:\s*"(?!REDACTED|redacted|null|undefined)[^"]{12,}"/gi,
  },
  {
    label: "public provider secret env",
    regex:
      /\bNEXT_PUBLIC_(?:(?:OPENAI|XAI|COMET|ANTHROPIC|GEMINI|GOOGLE|MISTRAL|TOGETHER|OPENROUTER|COHERE|DEEPSEEK|GROQ|PERPLEXITY)_[A-Z0-9_]*(?:KEY|SECRET|TOKEN)|[A-Z0-9_]*(?:PROVIDER|OWNER)[A-Z0-9_]*(?:KEY|SECRET|TOKEN))\b/g,
  },
];
const findings = [];
let scannedFiles = 0;

for (const target of targets) {
  if (!fs.existsSync(target)) {
    continue;
  }
  for (const file of walk(target)) {
    if (!isScannable(file)) {
      continue;
    }
    scannedFiles += 1;
    const content = fs.readFileSync(file, "utf8");
    for (const pattern of secretPatterns) {
      pattern.regex.lastIndex = 0;
      const matches = [...content.matchAll(pattern.regex)];
      if (matches.length > 0) {
        findings.push({
          file: path.relative(root, file),
          label: pattern.label,
          count: matches.length,
        });
      }
    }
  }
}

const result = {
  stage: "17.9",
  status: findings.length === 0 ? "PASS" : "FAIL",
  scanned_files: scannedFiles,
  targets: targets.map((target) => path.relative(root, target)),
  findings,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);

if (findings.length > 0) {
  console.error("[stage17-no-provider-key] FAIL");
  console.error(JSON.stringify(findings, null, 2));
  process.exit(2);
}

console.log(`[stage17-no-provider-key] PASS scannedFiles=${scannedFiles}`);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

function isScannable(file) {
  return /\.(?:js|mjs|json|map|txt|md|html|css|ts|tsx)$/i.test(file);
}
