import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputPath = path.join(root, "artifacts", "stage17", "readiness-stage17.json");
const readinessUrl =
  process.env.STAGE17_READINESS_URL ?? "http://localhost:3100/api/readiness/stage17";

const [readiness, composePs] = await Promise.all([
  fetchReadiness(),
  readComposePs(),
]);
const evidence = {
  generated_at: new Date().toISOString(),
  readiness_url: readinessUrl,
  readiness,
  compose: {
    services: composePs,
  },
  secret_policy: {
    values_exposed: false,
    forbidden_surfaces: [
      "frontend_bundle",
      "docker_image",
      "activepieces_iframe_payload",
      "activepieces_logs",
      "audit_payload",
    ],
  },
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(`[stage17:readiness:evidence] wrote ${path.relative(root, outputPath)}`);

if (readiness?.overall === "NOT_READY") {
  process.exitCode = 1;
}

async function fetchReadiness() {
  try {
    const response = await fetch(readinessUrl);
    const payload = await response.json().catch(() => null);
    return {
      http_status: response.status,
      ...(payload && typeof payload === "object" ? payload : { payload }),
    };
  } catch (error) {
    return {
      http_status: null,
      overall: "NOT_READY",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readComposePs() {
  const docker = process.env.DOCKER_CLI_PATH ?? (process.platform === "win32" ? "docker.exe" : "docker");
  const result = spawnSync(
    docker,
    [
      "compose",
      "--env-file",
      ".env.stage17.local",
      "-f",
      path.join("infra", "docker", "docker-compose.stage17.local-integrated.yml"),
      "--profile",
      "local-integrated",
      "ps",
      "--format",
      "json",
    ],
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
    },
  );

  if (result.status !== 0) {
    return {
      error: result.stderr?.trim() || result.stdout?.trim() || "docker compose ps failed",
    };
  }

  const text = (result.stdout ?? "").trim();
  if (!text) {
    return [];
  }

  try {
    if (text.startsWith("[")) {
      return JSON.parse(text);
    }
    return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return {
      raw: text,
    };
  }
}
