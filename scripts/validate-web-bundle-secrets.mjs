import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";

const staticDir = path.resolve("apps/web/.next/static");
const forbiddenPatterns = [
  {
    label: "Supabase secret env name",
    regex: /SUPABASE_SECRET_KEY/g,
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
    regex: /(XAI_API_KEY|COMETAPI_API_KEY)/g,
  },
];

try {
  await fs.access(staticDir);
} catch {
  console.log("Web bundle secret scan skipped: apps/web/.next/static does not exist yet.");
  process.exit(0);
}

const bundleFiles = await fg(["**/*.{js,html,json,txt,map}"], {
  cwd: staticDir,
  absolute: true,
  onlyFiles: true,
});

const leaks = [];

for (const file of bundleFiles) {
  const content = await fs.readFile(file, "utf-8");

  for (const pattern of forbiddenPatterns) {
    if (pattern.regex.test(content)) {
      leaks.push(`${pattern.label}: ${path.relative(process.cwd(), file)}`);
    }
  }
}

if (leaks.length > 0) {
  console.error("Frontend bundle secret scan failed:");
  for (const leak of leaks) {
    console.error(`- ${leak}`);
  }
  process.exitCode = 1;
} else {
  console.log("Frontend bundle secret scan passed.");
}
