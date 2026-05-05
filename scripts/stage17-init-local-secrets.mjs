import { createHmac, generateKeyPairSync, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const secretDir = path.join(root, ".local", "secrets", "stage17");
const envPath = path.join(root, ".env.stage17.local");
const localKeysHostDir =
  process.env.LEXFRAME_LOCAL_KEYS_HOST_DIR ??
  path.join(process.env.USERPROFILE ?? process.env.HOME ?? root, ".lexframe", "secrets");

await fs.mkdir(secretDir, { recursive: true });

const secrets = {
  lexframe_product_postgres_password: token("lfpg"),
  ap_postgres_password: token("appg"),
  ap_redis_password: token("apredis"),
  ap_jwt_secret: randomBytes(32).toString("hex"),
  ap_encryption_key: randomBytes(16).toString("hex"),
  activepieces_api_key: token("local_ap"),
  lexframe_runtime_master_secret: token("lfruntime"),
  supabase_secret_key: token("lfstorage"),
};

for (const [name, value] of Object.entries(secrets)) {
  await writeIfMissing(path.join(secretDir, `${name}.txt`), `${value}\n`);
}

const persistedSecrets = {};
for (const name of Object.keys(secrets)) {
  persistedSecrets[name] = await readTrimmed(path.join(secretDir, `${name}.txt`), secrets[name]);
}

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
await writeIfMissing(
  path.join(secretDir, "activepieces_signing_private_key.pem"),
  `${privateKey.export({ type: "pkcs8", format: "pem" })}`,
);

await writeIfMissing(
  envPath,
  [
    "ACTIVEPIECES_SOURCE_DIR=E:\\activepieces-main",
    `LEXFRAME_LOCAL_KEYS_HOST_DIR=${escapeEnv(localKeysHostDir)}`,
    `LEXFRAME_LOCAL_KEYS_FILE=${escapeEnv(path.join(localKeysHostDir, "lexframe.keys.local.json"))}`,
    "LEXFRAME_LOCAL_KEYS_DISABLED=false",
    "LEXFRAME_STAGE17_READINESS_ENABLED=1",
    "LEXFRAME_STAGE17_REQUIRE_WORKER_HEARTBEAT=0",
    "LEXFRAME_STAGE17_REQUIRE_UX_ARTIFACTS=0",
    "LEXFRAME_AP_DESIGN_SYSTEM_ENABLED=1",
    "LEXFRAME_STAGE17_I18N_ARTIFACT_PATH=docs/stage17/17.1/activepieces-i18n-branding-inventory.md",
    "LEXFRAME_STAGE17_BRANDING_ARTIFACT_PATH=docs/stage17/17.1/activepieces-i18n-branding-inventory.md",
    "LEXFRAME_STAGE17_DESIGN_TOKENS_ARTIFACT_PATH=docs/stage17/17.1/activepieces-design-token-inventory.md",
    `LEXFRAME_PRODUCT_POSTGRES_PASSWORD=${persistedSecrets.lexframe_product_postgres_password}`,
    `SUPABASE_SECRET_KEY=${persistedSecrets.supabase_secret_key}`,
    `LEXFRAME_RUNTIME_MASTER_SECRET=${persistedSecrets.lexframe_runtime_master_secret}`,
    `AP_POSTGRES_PASSWORD=${persistedSecrets.ap_postgres_password}`,
    `AP_REDIS_PASSWORD=${persistedSecrets.ap_redis_password}`,
    `AP_JWT_SECRET=${persistedSecrets.ap_jwt_secret}`,
    `AP_ENCRYPTION_KEY=${persistedSecrets.ap_encryption_key}`,
    `AP_WORKER_TOKEN=${signWorkerToken(persistedSecrets.ap_jwt_secret)}`,
    "ACTIVEPIECES_BASE_URL=http://activepieces-app:80",
    "ACTIVEPIECES_PUBLIC_URL=http://localhost:3100/automation-runtime",
    "ACTIVEPIECES_REVERSE_PROXY_HEALTH_URL=http://reverse-proxy/automation-runtime/api/v1/health",
    "ACTIVEPIECES_API_KEY_SECRET_REF=stage17/activepieces/api-key",
    "ACTIVEPIECES_API_KEY_FILE=/run/lexframe-stage17-secrets/activepieces_api_key.txt",
    "ACTIVEPIECES_SIGNING_PRIVATE_KEY_SECRET_REF=stage17/activepieces/signing-private-key",
    "ACTIVEPIECES_SIGNING_PRIVATE_KEY_FILE=/run/lexframe-stage17-secrets/activepieces_signing_private_key.pem",
    "ACTIVEPIECES_SIGNING_KEY_ID=stage17-local-signing-key",
    "ACTIVEPIECES_WORKER_TOKEN_SECRET_REF=stage17/activepieces/worker-token",
    "ACTIVEPIECES_WORKER_HEALTH_URL=",
    "ACTIVEPIECES_WORKER_CACHE_MOUNT_PATH=/usr/src/app/cache",
    "ACTIVEPIECES_POSTGRES_HOST=activepieces-postgres",
    "ACTIVEPIECES_POSTGRES_PORT=5432",
    "ACTIVEPIECES_POSTGRES_DATABASE=activepieces",
    "ACTIVEPIECES_POSTGRES_USERNAME=activepieces",
    "ACTIVEPIECES_POSTGRES_PASSWORD_FILE=/run/lexframe-stage17-secrets/ap_postgres_password.txt",
    "ACTIVEPIECES_REDIS_HOST=activepieces-redis",
    "ACTIVEPIECES_REDIS_PORT=6379",
    "ACTIVEPIECES_REDIS_PASSWORD_FILE=/run/lexframe-stage17-secrets/ap_redis_password.txt",
    "ACTIVEPIECES_REDIS_TYPE=STANDALONE",
    "ACTIVEPIECES_NETWORK_MODE=STRICT",
    "ACTIVEPIECES_SSRF_ALLOW_LIST=http://lexframe-backend:3100",
    "ACTIVEPIECES_MVP_CANVAS_ENABLED=1",
    "ACTIVEPIECES_CATALOG_MODE=max",
    "AP_PIECES_SOURCE=CLOUD_AND_DB",
    "AP_PIECES_SYNC_MODE=OFFICIAL_AUTO",
    "ACTIVEPIECES_FORCE_RU_LOCALE=true",
    "ACTIVEPIECES_BRAND_DISPLAY_NAME=Автоматизация",
    "ACTIVEPIECES_SIMULATE_RUNS=0",
    "NEXT_PUBLIC_API_BASE_URL=http://localhost:3100/api",
    "NEXT_PUBLIC_ACTIVEPIECES_INSTANCE_URL=http://localhost:3100/automation-runtime",
    "NEXT_PUBLIC_ACTIVEPIECES_RUNTIME_URL=http://localhost:3100/automation-runtime",
    "NEXT_PUBLIC_ACTIVEPIECES_MVP_CANVAS_ENABLED=1",
    "NEXT_PUBLIC_LEXFRAME_AP_DESIGN_SYSTEM_ENABLED=1",
    "NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=demo_publishable_key",
    "NEXT_PUBLIC_POSTHOG_KEY=phc_stage_local",
    "NEXT_PUBLIC_CONTRACTS_VERSION=stage17",
    "NEXT_PUBLIC_ENABLE_MSW=0",
    "AI_PROVIDER_MODE=mock",
    "",
  ].join("\n"),
);

const envValues = parseEnv(await readTrimmed(envPath, ""));
const jwtSecret = envValues.AP_JWT_SECRET ?? persistedSecrets.ap_jwt_secret;
const workerToken = signWorkerToken(jwtSecret);
await fs.writeFile(path.join(secretDir, "ap_worker_token.txt"), `${workerToken}\n`, {
  encoding: "utf8",
});
await upsertEnvValues(envPath, {
  AP_JWT_SECRET: jwtSecret,
  AP_WORKER_TOKEN: workerToken,
});

console.log(`[stage17:init-local-secrets] secret directory: ${secretDir}`);
console.log(`[stage17:init-local-secrets] env file: ${envPath}`);
console.log("[stage17:init-local-secrets] generated placeholders are local-only and ignored by Git.");

function token(prefix) {
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}

function signWorkerToken(jwtSecret) {
  const header = {
    alg: "HS256",
    typ: "JWT",
    kid: "1",
  };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    id: randomId(21),
    type: "WORKER",
    iss: "activepieces",
    iat: now,
    exp: now + 100 * 365 * 24 * 60 * 60,
  };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = createHmac("sha256", jwtSecret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

function randomId(length) {
  return randomBytes(Math.ceil((length * 3) / 4))
    .toString("base64url")
    .slice(0, length);
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

async function writeIfMissing(file, content) {
  try {
    await fs.access(file);
    return;
  } catch {
    await fs.writeFile(file, content, { encoding: "utf8", flag: "wx" });
  }
}

async function readTrimmed(file, fallback) {
  try {
    return (await fs.readFile(file, "utf8")).trim();
  } catch {
    return fallback;
  }
}

function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) {
      values[match[1]] = match[2];
    }
  }
  return values;
}

async function upsertEnvValues(file, values) {
  const existing = await readTrimmed(file, "");
  const lines = existing ? existing.split(/\r?\n/) : [];
  const seen = new Set();
  const next = lines.map((line) => {
    const match = /^([A-Z0-9_]+)=/.exec(line);
    if (!match || !(match[1] in values)) {
      return line;
    }
    seen.add(match[1]);
    return `${match[1]}=${values[match[1]]}`;
  });
  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) {
      next.push(`${key}=${value}`);
    }
  }
  await fs.writeFile(file, `${next.join("\n")}\n`, { encoding: "utf8" });
}

function escapeEnv(value) {
  return String(value).replaceAll("\\", "\\\\");
}
