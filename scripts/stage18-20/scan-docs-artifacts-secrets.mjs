import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = resolve('.');
const targets = [join(root, 'artifacts'), join(root, 'docs')];
const reportPath = join(
  root,
  'artifacts',
  'stage18-20',
  'audit',
  'security',
  'docs-artifacts-secret-scan.json',
);
const excludedExtensions = new Set([
  '.gif',
  '.jpeg',
  '.jpg',
  '.mp4',
  '.png',
  '.webm',
  '.zip',
]);
const secretPatterns = [
  { name: 'openai_style_key', regex: /\bsk-[A-Za-z0-9_-]{10,}\b/g },
  { name: 'xai_style_key', regex: /\bxai-[A-Za-z0-9_-]{10,}\b/g },
  { name: 'bearer_token', regex: /\bBearer\s+[A-Za-z0-9._-]{30,}\b/g },
  { name: 'private_key_block', regex: /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/g },
  { name: 'signed_url', regex: /https?:\/\/[^\s"'<>]+[?&](?:X-Amz-Signature|token|signature|sig)=/gi },
  {
    name: 'secret_assignment',
    regex:
      /\b[A-Z0-9_]*(?:API_KEY|PRIVATE_KEY|JWT_SECRET|ENCRYPTION_KEY|SERVICE_ROLE|SERVICE_ROLE_KEY|ACTIVEPIECES_API_KEY|AP_JWT_SECRET|AP_ENCRYPTION_KEY)[A-Z0-9_]*\b\s*[:=]\s*["']?(?!<redacted>|redacted|REDACTED)[A-Za-z0-9._+/=-]{8,}/g,
  },
  {
    name: 'provider_key_assignment',
    regex:
      /\b(?:COMET|COMETAPI|OPENAI|DEEPSEEK|ANTHROPIC)[A-Z0-9_]*(?:API_KEY|KEY|SECRET)\b\s*[:=]\s*["']?(?!<redacted>|redacted|REDACTED)[A-Za-z0-9._+/=-]{8,}/g,
  },
];

const findings = [];

for (const filePath of walkTargets(targets)) {
  let content = '';
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    continue;
  }
  const lines = content.split(/\r?\n/);
  for (const pattern of secretPatterns) {
    pattern.regex.lastIndex = 0;
    for (const match of content.matchAll(pattern.regex)) {
      const lineNumber = lineNumberForOffset(content, match.index ?? 0);
      findings.push({
        file: filePath.replace(`${root}\\`, '').replaceAll('\\', '/'),
        line: lineNumber,
        pattern: pattern.name,
        preview: redactLine(lines[lineNumber - 1] ?? ''),
      });
    }
  }
}

mkdirSync(resolve(reportPath, '..'), { recursive: true });
writeFileSync(
  reportPath,
  `${JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      status: findings.length === 0 ? 'PASS' : 'FAIL',
      scanned_roots: targets.map((target) => target.replace(`${root}\\`, '').replaceAll('\\', '/')),
      findings,
    },
    null,
    2,
  )}\n`,
);

if (findings.length > 0) {
  console.error(`docs_artifacts_secret_scan=FAIL findings=${findings.length}`);
  for (const finding of findings.slice(0, 25)) {
    console.error(`${finding.file}:${finding.line} ${finding.pattern} ${finding.preview}`);
  }
  process.exitCode = 1;
} else {
  console.log('docs_artifacts_secret_scan=PASS');
  console.log(`report=${reportPath}`);
}

function* walkTargets(paths) {
  for (const target of paths) {
    yield* walk(target);
  }
}

function* walk(dir) {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (!excludedExtensions.has(extname(entry.name).toLowerCase())) {
      yield path;
    }
  }
}

function lineNumberForOffset(content, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (content.charCodeAt(index) === 10) {
      line += 1;
    }
  }
  return line;
}

function redactLine(line) {
  return line
    .replace(/\bsk-[A-Za-z0-9_-]{10,}\b/g, '<redacted>')
    .replace(/\bxai-[A-Za-z0-9_-]{10,}\b/g, '<redacted>')
    .replace(/\bBearer\s+[A-Za-z0-9._-]{30,}\b/g, 'Bearer <redacted>')
    .slice(0, 220);
}
