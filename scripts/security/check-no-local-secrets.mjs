import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const scanAll = process.argv.includes('--all') || process.env.CI === 'true';

const blockedFilePatterns = [
  /(^|[\\/])lexframe\.keys\.local\.json$/i,
  /(^|[\\/])\.env\.local$/i,
  /(^|[\\/])\.env\..*\.local$/i,
  /(^|[\\/])\.local[\\/]secrets[\\/]/i,
  /\.keys\.local\.json$/i,
  /\.secrets\.json$/i,
  /private-key.*\.pem$/i,
  /signing-key.*\.pem$/i,
];

const allowedEnvPlaceholders =
  '(?:REDACTED|example|test|test_|placeholder|local_|stage0_|stage14_|local_stage|PASTE_|YOUR_|change_me|<[^>]+>|"?"?)';

const blockedContentPatterns = [
  {
    label: 'local owner api_key value',
    regex:
      /"api_key"\s*:\s*"(?!PASTE_KEY_HERE|REDACTED|example|test_|local_|stage0_|stage14_)[^"]{12,}"/i,
  },
  {
    label: 'private key block',
    regex: /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/i,
  },
  {
    label: 'bearer token',
    regex: /Authorization:\s*Bearer\s+[A-Za-z0-9._-]{20,}/i,
  },
  {
    label: 'provider token',
    regex: /\b(?!(?:sk_test)_)(sk|xai|gsk|ghp|github_pat)_[A-Za-z0-9_-]{20,}\b/i,
  },
  {
    label: 'supabase service role',
    regex: new RegExp(
      `SUPABASE_SERVICE_ROLE_KEY\\s*=\\s*(?!${allowedEnvPlaceholders})\\S{12,}`,
      'i',
    ),
  },
  {
    label: 'activepieces signing key',
    regex: new RegExp(
      `ACTIVEPIECES_SIGNING_PRIVATE_KEY\\s*=\\s*(?!${allowedEnvPlaceholders})\\S{12,}`,
      'i',
    ),
  },
];

const files = scanAll ? trackedFiles() : stagedFiles();
const violations = [];

for (const file of files) {
  if (blockedFilePatterns.some((pattern) => pattern.test(file))) {
    violations.push(`blocked secret filename: ${file}`);
    continue;
  }

  if (!existsSync(file)) {
    continue;
  }

  let content = '';
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const pattern of blockedContentPatterns) {
    if (pattern.regex.test(content)) {
      violations.push(`${pattern.label}: ${file}`);
    }
  }
}

if (violations.length > 0) {
  console.error('Local secret safety check failed:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    'Incident rule: any real provider key found in Git, PRs, CI artifacts, logs, or telemetry must be revoked and rotated; history cleanup alone is not remediation.',
  );
  process.exit(1);
}

console.log(
  `Local secret safety check passed (${scanAll ? 'tracked files' : 'staged files'}).`,
);

function stagedFiles() {
  return gitFiles(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
}

function trackedFiles() {
  return gitFiles(['ls-files']);
}

function gitFiles(args) {
  const output = execFileSync('git', args, {
    encoding: 'utf8',
  });

  return output
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean)
    .filter((file) => !ignoredGeneratedPath(file));
}

function ignoredGeneratedPath(file) {
  return /(^|[\\/])(node_modules|dist|build|coverage|\.next|playwright-report)[\\/]/i.test(
    file,
  );
}
