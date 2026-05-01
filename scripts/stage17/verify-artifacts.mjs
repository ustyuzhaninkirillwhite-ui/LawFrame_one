import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mode = readMode(process.argv.slice(2));
const artifactsDir = path.join(root, "artifacts", "stage17");
const docsDir = path.join(root, "docs", "stage17");

fs.mkdirSync(artifactsDir, { recursive: true });
fs.mkdirSync(docsDir, { recursive: true });

const requiredArtifacts = [
  ["P0", "docs/stage17/17.1/ADR-17.1-local-owner-key-vault.md"],
  ["P0", "docs/stage17/17.1/ADR-17.2-activepieces-design-unification.md"],
  ["P1", "docs/stage17/17.1/source-inventory.md"],
  ["P0", "docs/stage17/secret-surface-inventory.md"],
  ["P1", "docs/stage17/localization-coverage-report.md"],
  ["P1", "docs/stage17/debranding-coverage-report.md"],
  ["P1", "docs/stage17/design-token-mapping.md"],
  ["P1", "docs/stage17/functionality-preservation-report.md"],
  ["P0", "docs/stage17/local-key-vault-security-report.md"],
  ["P0", "docs/stage17/activepieces-runtime-evidence.md"],
  ["P0", "docs/stage17/visual-regression-report.md"],
  ["P0", "docs/stage17/stage17-release-gate-report.md"],
  ["P0", "artifacts/stage17/release-gate.json"],
  ["P0", "artifacts/stage17/runtime-evidence.json"],
  ["P0", "artifacts/stage17/browser-secret-scan.json"],
  ["P1", "scripts/secrets/init-local-keys.ps1"],
  ["P0", "scripts/security/check-no-local-secrets.mjs"],
  ["P0", "scripts/stage17/release-gate.mjs"],
  ["P0", "scripts/stage17/verify-artifacts.mjs"],
  ["P0", "scripts/stage17/collect-runtime-evidence.mjs"],
  ["P0", "scripts/stage17/scan-browser-evidence.mjs"],
  ["P1", "packages/design-system-activepieces-bridge/src/index.ts"],
  ["P0", "apps/backend/src/modules/local-owner-key-vault/local-owner-key-vault.service.ts"],
  ["P0", "apps/backend/src/modules/activepieces/activepieces-session.service.ts"],
  ["P0", "apps/web/src/features/automation-canvas/activepieces-canvas-route.tsx"],
  ["P0", "tests/e2e/stage17-activepieces-canvas.spec.ts"],
  ["P0", "tests/e2e/stage17-local-keys-security.spec.ts"],
  ["P0", "tests/e2e/stage17-design-convergence.spec.ts"],
];

const stopListRules = [
  {
    id: "SL-01",
    severity: "P0",
    label: "raw API key JSON value",
    regex:
      /"api_key"\s*:\s*"(?!REDACTED|redacted|PASTE_KEY_HERE|test-only-not-a-real-secret|test_|demo_|example_|placeholder|<[^>]+>)[^"]{12,}"/i,
  },
  {
    id: "SL-03",
    severity: "P0",
    label: "browser-exposed provider secret env",
    regex:
      /\bNEXT_PUBLIC_(?:(?:OPENAI|XAI|COMET|ANTHROPIC|GEMINI|GOOGLE|MISTRAL|TOGETHER|OPENROUTER|COHERE|DEEPSEEK|GROQ|PERPLEXITY)_[A-Z0-9_]*(?:KEY|SECRET|TOKEN)|[A-Z0-9_]*(?:PROVIDER|OWNER|PRIVATE|SIGNING)[A-Z0-9_]*(?:KEY|SECRET|TOKEN))\b/,
  },
  {
    id: "SL-04",
    severity: "P0",
    label: "private key block",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/i,
  },
  {
    id: "SL-07",
    severity: "P0",
    label: "Activepieces navigation hidden",
    regex: /disableNavigation\s*:\s*true|hideSidebar\s*:\s*true|hideFolders\s*:\s*true|hideExportAndImportFlow\s*:\s*true|hideDuplicateFlow\s*:\s*true/,
  },
  {
    id: "SL-14",
    severity: "P0",
    label: "direct provider key in public runtime",
    regex: /provider_key\s*[:=]\s*(?!null|undefined|REDACTED|redacted)[A-Za-z0-9_.-]{12,}/i,
  },
];

let failed = false;
if (mode === "artifacts" || mode === "all") {
  failed = verifyArtifacts() || failed;
}

if (mode === "stop-list" || mode === "all") {
  failed = verifyStopList() || failed;
}

if (failed) {
  process.exit(1);
}

function verifyArtifacts() {
  const entries = requiredArtifacts.map(([severity, relativePath]) => {
    const absolutePath = path.join(root, relativePath);
    const exists = fs.existsSync(absolutePath);
    const stats = exists ? fs.statSync(absolutePath) : null;
    return {
      path: relativePath,
      severity,
      status:
        exists && (stats?.isDirectory() || Number(stats?.size ?? 0) > 0)
          ? "PASS"
          : "FAIL",
      bytes: stats?.isFile() ? stats.size : null,
    };
  });
  const result = {
    stage: "17.10",
    generated_at: new Date().toISOString(),
    status: entries.every((entry) => entry.status === "PASS") ? "PASS" : "FAIL",
    entries,
  };

  fs.writeFileSync(
    path.join(artifactsDir, "artifact-manifest.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(docsDir, "artifact-manifest.md"),
    renderArtifactManifest(result),
    "utf8",
  );

  if (result.status !== "PASS") {
    console.error("[stage17:artifacts] FAIL");
    for (const entry of entries.filter((entry) => entry.status !== "PASS")) {
      console.error(`- ${entry.severity} missing: ${entry.path}`);
    }
    return true;
  }

  console.log(`[stage17:artifacts] PASS entries=${entries.length}`);
  return false;
}

function verifyStopList() {
  const files = listRepoFiles();
  const findings = [];
  for (const file of files) {
    if (isIgnoredScanPath(file)) {
      continue;
    }

    const normalized = file.replaceAll("\\", "/");
    if (blockedSecretFilename(normalized)) {
      findings.push({
        id: "SL-02",
        severity: "P0",
        file,
        label: "blocked local secret filename",
      });
      continue;
    }

    const absolutePath = path.join(root, file);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      continue;
    }
    if (!isTextFile(file)) {
      continue;
    }

    const content = fs.readFileSync(absolutePath, "utf8");
    for (const rule of stopListRules) {
      rule.regex.lastIndex = 0;
      if (rule.regex.test(content) && !isAllowedStopListMention(file, rule.id)) {
        findings.push({
          id: rule.id,
          severity: rule.severity,
          file,
          label: rule.label,
        });
      }
    }
  }

  const result = {
    stage: "17.10",
    generated_at: new Date().toISOString(),
    status: findings.length === 0 ? "PASS" : "FAIL",
    scanned_files: files.length,
    findings,
  };
  fs.writeFileSync(
    path.join(artifactsDir, "stop-list-compliance.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(docsDir, "stop-list-checklist.md"),
    renderStopList(result),
    "utf8",
  );

  if (findings.length > 0) {
    console.error("[stage17:stop-list] FAIL");
    for (const finding of findings) {
      console.error(`- ${finding.id} ${finding.file}: ${finding.label}`);
    }
    return true;
  }

  console.log(`[stage17:stop-list] PASS scannedFiles=${files.length}`);
  return false;
}

function listRepoFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: root,
      encoding: "buffer",
    },
  );

  return output
    .toString("utf8")
    .split("\0")
    .map((file) => file.trim())
    .filter(Boolean);
}

function blockedSecretFilename(file) {
  if (/\.example$/i.test(file)) {
    return false;
  }

  return (
    /(^|\/)lexframe\.keys\.local\.json$/i.test(file) ||
    /(^|\/)\.env\.local$/i.test(file) ||
    /(^|\/)\.env\..*\.local$/i.test(file) ||
    /\.keys\.local\.json$/i.test(file) ||
    /\.secrets\.json$/i.test(file) ||
    /private-key.*\.pem$/i.test(file) ||
    /signing-key.*\.pem$/i.test(file)
  );
}

function isIgnoredScanPath(file) {
  return /(^|\/)(node_modules|dist|build|coverage|\.next|playwright-report|test-results|\.codex-runtime|\.git)\//i.test(
    file.replaceAll("\\", "/"),
  );
}

function isTextFile(file) {
  return /\.(?:ts|tsx|js|mjs|cjs|json|md|css|html|yml|yaml|sql|txt|ps1)$/i.test(
    file,
  );
}

function isAllowedStopListMention(file, ruleId) {
  const normalized = file.replaceAll("\\", "/");
  if (normalized.startsWith("docs/stage17/")) {
    return true;
  }
  if (normalized.startsWith("scripts/stage17/") && ruleId !== "SL-07") {
    return true;
  }
  if (/^scripts\/stage17-[a-z0-9-]+\.mjs$/i.test(normalized)) {
    return true;
  }
  if (normalized === "scripts/security/check-no-local-secrets.mjs") {
    return true;
  }
  if (normalized === "scripts/security/check-stage17-no-provider-key.mjs") {
    return true;
  }
  return false;
}

function renderArtifactManifest(result) {
  return [
    "# Stage 17.10 Artifact Manifest",
    "",
    `Status: ${result.status}`,
    `Generated: ${result.generated_at}`,
    "",
    "| Severity | Status | Path | Bytes |",
    "| --- | --- | --- | ---: |",
    ...result.entries.map((entry) =>
      [entry.severity, entry.status, `\`${entry.path}\``, entry.bytes ?? "-"].join(" | "),
    ),
    "",
  ].join("\n");
}

function renderStopList(result) {
  const rows =
    result.findings.length > 0
      ? result.findings.map((finding) =>
          [
            finding.id,
            finding.severity,
            "FAIL",
            `\`${finding.file}\``,
            finding.label,
          ].join(" | "),
        )
      : [["G9", "P0", "PASS", "-", "Stop-list violations not found."].join(" | ")];

  return [
    "# Stage 17.10 Stop-list Compliance",
    "",
    `Status: ${result.status}`,
    `Scanned files: ${result.scanned_files}`,
    `Generated: ${result.generated_at}`,
    "",
    "| Rule | Severity | Status | File | Finding |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

function readMode(argv) {
  const modeArg = argv.find((arg) => arg.startsWith("--mode="));
  if (modeArg) {
    return modeArg.slice("--mode=".length);
  }
  if (argv.includes("--stop-list")) {
    return "stop-list";
  }
  if (argv.includes("--all")) {
    return "all";
  }
  return "artifacts";
}
