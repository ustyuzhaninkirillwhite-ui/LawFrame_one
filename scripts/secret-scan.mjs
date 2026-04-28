import fg from "fast-glob";
import fs from "node:fs/promises";

const ignore = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.next/**",
  "**/coverage/**",
  "**/.env",
  "**/.env.local",
  "**/.env.*.local",
];

const files = await fg(["**/*.{ts,tsx,js,mjs,cjs,json,yaml,yml,env,md,sql}"], {
  ignore,
  dot: true,
});

const suspiciousPatterns = [
  { label: "OpenAI-like secret key", regex: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { label: "Supabase secret/service key", regex: /\b(?:sb_secret_|service_role)[A-Za-z0-9_\-]{10,}\b/g },
  { label: "Private key body", regex: /-----BEGIN (?:RSA|EC|PRIVATE) KEY-----/g },
];

const leaks = [];

for (const file of files) {
  const content = await fs.readFile(file, "utf-8");

  for (const pattern of suspiciousPatterns) {
    if (pattern.regex.test(content)) {
      leaks.push(`${pattern.label}: ${file}`);
    }
  }

  if (
    file.startsWith("apps/web/") &&
    /process\.env\.(SUPABASE_SECRET_KEY|ACTIVEPIECES_API_KEY|ACTIVEPIECES_SIGNING_PRIVATE_KEY|XAI_API_KEY|COMETAPI_API_KEY)/.test(
      content,
    )
  ) {
    leaks.push(`Backend-only env referenced from frontend source: ${file}`);
  }
}

if (leaks.length > 0) {
  console.error("Secret scan failed:");
  for (const leak of leaks) {
    console.error(`- ${leak}`);
  }
  process.exitCode = 1;
} else {
  console.log("Secret scan passed.");
}
