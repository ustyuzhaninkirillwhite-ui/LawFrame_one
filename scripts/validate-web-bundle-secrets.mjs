import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const allowMissing = process.env.WEB_BUNDLE_SECRET_SCAN_ALLOW_MISSING === "1";
const scanRoots = [
  "apps/web/.next/static",
  "apps/web/.next/server/app",
  "apps/web/public",
];

const forbiddenPatterns = [
  {
    label: "Supabase secret env name",
    regex: /SUPABASE_(?:SECRET|SERVICE_ROLE|SERVICE)_?(?:KEY|ROLE)?/g,
  },
  {
    label: "Supabase secret/service key payload",
    regex: /\b(?:sb_secret_|service_role)[A-Za-z0-9_\-]{10,}\b/g,
  },
  {
    label: "Backend-only Activepieces key",
    regex: /ACTIVEPIECES_API_KEY/g,
  },
  {
    label: "Backend-only signing key",
    regex: /ACTIVEPIECES_SIGNING_PRIVATE_KEY/g,
  },
  {
    label: "AI provider server key name",
    regex: /(OPENAI_API_KEY|XAI_API_KEY|COMETAPI_API_KEY|ANTHROPIC_API_KEY)/g,
  },
  {
    label: "JWT/private signing secret name",
    regex: /(JWT_SECRET|SIGNING_PRIVATE_KEY|LEXFRAME_RUNTIME_MASTER_SECRET)/g,
  },
  {
    label: "Connection secret reference value",
    regex: /vault:\/\/stage16\/[A-Za-z0-9_\-]+/g,
  },
  {
    label: "Confidential Stage 16 fixture text",
    regex: /Confidential Stage 16 audit document|Legal-sensitive Stage 16 audit document/g,
  },
  {
    label: "Signed URL token",
    regex: /(?:signedUrl|signed_url|X-Amz-Signature|X-Goog-Signature|[?&](?:sig|signature)=)[A-Za-z0-9%._\-]{24,}/g,
  },
];

const existingRoots = [];
for (const relativeRoot of scanRoots) {
  const absoluteRoot = path.resolve(root, relativeRoot);
  try {
    const stat = await fs.stat(absoluteRoot);
    if (stat.isDirectory()) {
      existingRoots.push(relativeRoot);
    }
  } catch {
    // Checked after collection so diagnostics can list all missing roots.
  }
}

if (!existingRoots.includes("apps/web/.next/static")) {
  const message = "Web bundle secret scan cannot verify release bundle: apps/web/.next/static does not exist.";
  if (allowMissing) {
    console.log(`${message} WEB_BUNDLE_SECRET_SCAN_ALLOW_MISSING=1, skipping by explicit non-release override.`);
    process.exit(0);
  }
  console.error(message);
  process.exit(1);
}

const scanGlobs = [
  "apps/web/.next/static/**/*.{js,html,json,txt,map}",
  "apps/web/.next/server/app/**/*.{html,json,txt}",
  "apps/web/public/**/*.{js,html,json,txt,map}",
].filter((glob) =>
  existingRoots.some((relativeRoot) =>
    glob.startsWith(relativeRoot.replaceAll("\\", "/")),
  ),
);

const bundleFiles = await fg(
  scanGlobs,
  {
    cwd: root,
    absolute: true,
    onlyFiles: true,
    ignore: ["**/cache/**"],
  },
);

const leaks = [];

for (const file of bundleFiles) {
  const content = await fs.readFile(file, "utf-8").catch(() => null);
  if (content === null) {
    continue;
  }

  for (const pattern of forbiddenPatterns) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(content)) {
      leaks.push(`${pattern.label}: ${path.relative(root, file)}`);
    }
  }
}

console.log(
  `[web-bundle-secrets] scannedRoots=${existingRoots.join(",")} scannedFiles=${bundleFiles.length}`,
);

if (bundleFiles.length === 0) {
  console.error("Frontend bundle secret scan failed: no scannable bundle files found.");
  process.exit(1);
}

if (leaks.length > 0) {
  console.error("Frontend bundle secret scan failed:");
  for (const leak of leaks) {
    console.error(`- ${leak}`);
  }
  process.exit(1);
}

console.log("Frontend bundle secret scan passed.");
