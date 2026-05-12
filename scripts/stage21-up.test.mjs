import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
);
const stage21UpPath = join(repoRoot, "scripts", "stage21-up.mjs");

test("package exposes stage21-up as the current runtime entrypoint", () => {
  assert.equal(
    packageJson.scripts["stage21-up"],
    "node scripts/stage21-up.mjs",
  );
  assert.equal(existsSync(stage21UpPath), true);
});

test("stage21-up builds the existing integrated compose runtime with Stage 21 identity", async () => {
  assert.equal(existsSync(stage21UpPath), true);
  const stage21Up = await import(pathToFileURL(stage21UpPath));

  assert.deepEqual(stage21Up.buildStage21RuntimeEnv({ BASE: "1" }), {
    BASE: "1",
    LEXFRAME_CONTRACTS_VERSION: "stage21",
    LEXFRAME_RELEASE_SHA: "local-stage21",
    LEXFRAME_RUNTIME_IMAGE_TAG: "stage21-local",
    NEXT_PUBLIC_CONTRACTS_VERSION: "stage21",
    ACTIVEPIECES_IMAGE_TAG: "0.82.0",
    ACTIVEPIECES_EMBED_SDK_VERSION: "0.9.0",
  });

  assert.deepEqual(stage21Up.buildStage21ComposeArgs("up", ["--wait"]), [
    "compose",
    "--env-file",
    ".env.stage17.local",
    "-f",
    join("infra", "docker", "docker-compose.stage17.local-integrated.yml"),
    "--profile",
    "local-integrated",
    "up",
    "-d",
    "--wait",
  ]);
});

test("integrated compose runtime keeps compatibility names but allows Stage 21 version overrides", () => {
  const compose = readFileSync(
    join(repoRoot, "infra", "docker", "docker-compose.stage17.local-integrated.yml"),
    "utf8",
  );

  assert.match(
    compose,
    /LEXFRAME_CONTRACTS_VERSION:\s+\$\{LEXFRAME_CONTRACTS_VERSION:-stage17\}/,
  );
  assert.match(
    compose,
    /LEXFRAME_RELEASE_SHA:\s+\$\{LEXFRAME_RELEASE_SHA:-local-stage17\}/,
  );
  assert.match(
    compose,
    /NEXT_PUBLIC_CONTRACTS_VERSION:\s+\$\{NEXT_PUBLIC_CONTRACTS_VERSION:-stage17\}/,
  );
  assert.match(
    compose,
    /image:\s+lexframe-backend:\$\{LEXFRAME_RUNTIME_IMAGE_TAG:-stage17-local\}/,
  );
  assert.match(
    compose,
    /image:\s+lexframe-web:\$\{LEXFRAME_RUNTIME_IMAGE_TAG:-stage17-local\}/,
  );
});

test("integrated compose runtime passes the backend-only CometAPI key alias", () => {
  const compose = readFileSync(
    join(repoRoot, "infra", "docker", "docker-compose.stage17.local-integrated.yml"),
    "utf8",
  );

  assert.match(compose, /COMETAPI_KEY:\s+\$\{COMETAPI_KEY:-\}/);
  assert.match(
    compose,
    /COMETAPI_API_KEY:\s+\$\{COMETAPI_API_KEY:-stage0_comet_api_key\}/,
  );
});

test("Stage 21 settings migration casts role grants to the workspace_role enum", () => {
  const migration = readFileSync(
    join(repoRoot, "supabase", "migrations", "000053_stage21_settings_ai_preferences.sql"),
    "utf8",
  );

  assert.match(
    migration,
    /insert into app\.role_permissions \(role_code, permission_code\)\s+select role_code::workspace_role, permission_code/s,
  );
});
