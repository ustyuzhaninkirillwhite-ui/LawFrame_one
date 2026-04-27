import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export const repoRoot = resolve(import.meta.dirname, "..");
const defaultProfile = "local-integrated";

export function resolveDockerCli() {
  return (
    process.env.DOCKER_CLI_PATH ??
    (process.platform === "win32" ? "docker.exe" : "docker")
  );
}

export function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function runCommand(command, args, options = {}) {
  const cwd = options.cwd ?? repoRoot;
  const result = spawnSync(command, args, {
    cwd,
    encoding: options.encoding ?? "utf8",
    input: options.input,
    stdio: options.stdio ?? "pipe",
    shell: false,
    env: options.env ?? process.env,
    maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
  });

  if (!options.allowFailure && result.status !== 0) {
    throw commandError(command, args, result, {
      cwd,
      service: options.service,
      label: options.label,
    });
  }

  return result;
}

export function compose(args, options = {}) {
  const profile = options.profile ?? defaultProfile;
  const composeArgs = [
    "compose",
    ...(profile === null ? [] : ["--profile", profile]),
    ...args,
  ];
  return runCommand(resolveDockerCli(), composeArgs, {
    ...options,
    label: options.label ?? "docker compose",
  });
}

export function composeExec(service, args, options = {}) {
  return compose(["exec", "-T", service, ...args], {
    ...options,
    service,
    label: options.label ?? `docker compose exec ${service}`,
  });
}

export function composePsql(service, database, psqlArgs = [], input = undefined) {
  const result = composeExec(
    service,
    [
      "psql",
      "-U",
      "postgres",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      ...psqlArgs,
    ],
    {
      input,
      service,
      label: `psql ${service}/${database}`,
    },
  );
  return result.stdout ?? "";
}

export function parseComposePsJson(service = null, options = {}) {
  const result = compose(
    [
      "ps",
      ...(options.all === false ? [] : ["--all"]),
      "--format",
      "json",
      ...(service ? [service] : []),
    ],
    {
      label: "docker compose ps --format json",
    },
  );
  return parseJsonLines(result.stdout ?? "");
}

export function waitForServiceHealthy(
  service,
  { timeoutMs = 180_000, intervalMs = 1_000, requireHealthy = false } = {},
) {
  const start = Date.now();
  let lastState = "missing";

  while (Date.now() - start <= timeoutMs) {
    const rows = parseComposePsJson(service);
    const row = rows.find((item) => item.Service === service) ?? rows[0] ?? null;
    if (row) {
      lastState = serviceStateText(row);
      const isRunning = lastState.includes("running");
      const isHealthy = lastState.includes("healthy");
      const isBad =
        lastState.includes("exited") ||
        lastState.includes("dead") ||
        lastState.includes("unhealthy");

      if (isHealthy || (isRunning && !requireHealthy && !hasHealthState(row))) {
        process.stdout.write(
          `[stage16-compose] ${service} ready state=${lastState}\n`,
        );
        return row;
      }

      if (isBad) {
        process.stdout.write(
          `[stage16-compose] ${service} not ready state=${lastState}\n`,
        );
      }
    }

    sleep(intervalMs);
  }

  throw new Error(
    `service ${service} did not become healthy within ${timeoutMs}ms; lastState=${lastState}`,
  );
}

export function waitForPostgresReady(
  service,
  database,
  { timeoutMs = 180_000, intervalMs = 1_000 } = {},
) {
  waitForServiceHealthy(service, { timeoutMs, intervalMs, requireHealthy: true });
  const start = Date.now();
  let lastError = "not attempted";

  while (Date.now() - start <= timeoutMs) {
    const ready = composeExec(
      service,
      ["pg_isready", "-U", "postgres", "-d", database],
      { allowFailure: true, service, label: `pg_isready ${service}` },
    );
    const query = composePsqlAllowFailure(service, database, ["-Atc", "select 1;"]);
    if (ready.status === 0 && query.status === 0 && query.stdout?.trim() === "1") {
      process.stdout.write(
        `[stage16-compose] ${service}/${database} accepts psql connections\n`,
      );
      return;
    }
    lastError = [
      ready.stderr?.trim() || ready.stdout?.trim() || `pg_isready=${ready.status}`,
      query.stderr?.trim() || query.stdout?.trim() || `psql=${query.status}`,
    ]
      .filter(Boolean)
      .join(" | ");
    process.stdout.write(
      `[stage16-compose] waiting for ${service}/${database}: ${lastError}\n`,
    );
    sleep(intervalMs);
  }

  throw new Error(
    `${service}/${database} did not accept psql connections within ${timeoutMs}ms; lastError=${lastError}`,
  );
}

export function composePsqlAllowFailure(service, database, psqlArgs = [], input) {
  return composeExec(
    service,
    [
      "psql",
      "-U",
      "postgres",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      ...psqlArgs,
    ],
    {
      input,
      service,
      label: `psql ${service}/${database}`,
      allowFailure: true,
    },
  );
}

export function isTransientPostgresError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /No such file or directory|57P01|terminating connection|server closed the connection|database system is starting up|connection refused|could not connect to server/i.test(
    message,
  );
}

export function commandError(command, args, result, context = {}) {
  return new Error(
    [
      context.label ? `${context.label} failed` : "command failed",
      context.service ? `service=${context.service}` : null,
      `command=${command} ${args.join(" ")}`,
      `cwd=${context.cwd ?? repoRoot}`,
      `COMPOSE_PROJECT_NAME=${process.env.COMPOSE_PROJECT_NAME ?? ""}`,
      result.status === undefined ? null : `exitStatus=${result.status}`,
      result.signal ? `signal=${result.signal}` : null,
      result.stdout ? `stdout=${String(result.stdout).trim()}` : null,
      result.stderr ? `stderr=${String(result.stderr).trim()}` : null,
      result.error ? `error=${result.error.message}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function parseJsonLines(output) {
  const text = output.trim();
  if (!text) {
    return [];
  }
  if (text.startsWith("[")) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      const parsed = JSON.parse(line);
      return Array.isArray(parsed) ? parsed : [parsed];
    });
}

function serviceStateText(row) {
  return [
    row.State,
    row.Status,
    row.Health,
    row.health,
    row.ExitCode === 0 ? null : row.ExitCode ? `exit-${row.ExitCode}` : null,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasHealthState(row) {
  return Boolean(row.Health || /healthy|unhealthy/i.test(String(row.Status ?? "")));
}
