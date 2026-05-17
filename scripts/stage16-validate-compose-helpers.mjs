import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

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
  console.error(
    "[stage16-compose-helpers] forbidden Docker Compose helper patterns found:",
  );
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

const compose = parse(
  await fs.readFile(path.join(root, "compose.yaml"), "utf8"),
);
const backendEnvironment = compose?.services?.backend?.environment ?? {};
const requiredBackendActivepiecesDbEnvironment = {
  ACTIVEPIECES_POSTGRES_HOST: "activepieces-postgres",
  ACTIVEPIECES_POSTGRES_PORT: 5432,
  ACTIVEPIECES_POSTGRES_DATABASE: "activepieces",
  ACTIVEPIECES_POSTGRES_USERNAME: "postgres",
  ACTIVEPIECES_POSTGRES_PASSWORD: "postgres",
};

const missingBackendActivepiecesDbEnvironment = Object.entries(
  requiredBackendActivepiecesDbEnvironment,
).filter(
  ([key, expected]) =>
    String(backendEnvironment[key] ?? "") !== String(expected),
);

if (missingBackendActivepiecesDbEnvironment.length > 0) {
  console.error(
    "[stage16-compose-helpers] backend is missing internal ActivePieces Postgres settings:",
  );
  for (const [key, expected] of missingBackendActivepiecesDbEnvironment) {
    console.error(`- ${key}: expected ${expected}`);
  }
  process.exit(1);
}

const requiredBackendSigningEnvironment = {
  ACTIVEPIECES_PUBLIC_URL: "http://127.0.0.1:3100",
  ACTIVEPIECES_SIGNING_PRIVATE_KEY: "stage0_signing_private_key",
  ACTIVEPIECES_SIGNING_PRIVATE_KEY_FILE:
    "/run/lexframe-stage17-secrets/activepieces_signing_private_key.pem",
  ACTIVEPIECES_SIGNING_PRIVATE_KEY_SECRET_REF:
    "stage17/activepieces/signing-private-key",
  ACTIVEPIECES_SIGNING_KEY_ID: "stage17-local-signing-key",
  AP_JWT_SECRET:
    "${AP_JWT_SECRET:-00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff}",
};
const missingBackendSigningEnvironment = Object.entries(
  requiredBackendSigningEnvironment,
).filter(
  ([key, expected]) =>
    String(backendEnvironment[key] ?? "") !== String(expected),
);

if (missingBackendSigningEnvironment.length > 0) {
  console.error(
    "[stage16-compose-helpers] backend is missing file-backed ActivePieces signing settings:",
  );
  for (const [key, expected] of missingBackendSigningEnvironment) {
    console.error(`- ${key}: expected ${expected}`);
  }
  process.exit(1);
}

const backendVolumes = compose?.services?.backend?.volumes ?? [];
const hasStage17SecretsMount = backendVolumes.some(
  (volume) =>
    volume &&
    typeof volume === "object" &&
    volume.target === "/run/lexframe-stage17-secrets" &&
    volume.read_only === true,
);

if (!hasStage17SecretsMount) {
  console.error(
    "[stage16-compose-helpers] backend must mount /run/lexframe-stage17-secrets read-only for ActivePieces signing.",
  );
  process.exit(1);
}

console.log(`[stage16-compose-helpers] PASS scanned=${files.length}`);
