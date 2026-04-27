import { spawnSync } from "node:child_process";

const args = [
  "pnpm",
  "--filter",
  "@lexframe/e2e",
  "exec",
  "playwright",
  "test",
  "stage16-live-audit",
  "--project=stage16-live-audit",
  "--reporter=json",
  "--retries=0",
];

const result = spawnSync("corepack", args, {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    LEXFRAME_READINESS_PROFILE:
      process.env.LEXFRAME_READINESS_PROFILE ?? "local-integrated",
    ACTIVEPIECES_SIMULATE_RUNS:
      process.env.ACTIVEPIECES_SIMULATE_RUNS ?? "0",
    NEXT_PUBLIC_ENABLE_MSW: process.env.NEXT_PUBLIC_ENABLE_MSW ?? "0",
  },
  maxBuffer: 100 * 1024 * 1024,
});

if (result.stderr) {
  process.stderr.write(result.stderr);
}

let report = null;
try {
  report = JSON.parse(extractJson(result.stdout ?? ""));
} catch (error) {
  process.stdout.write(result.stdout ?? "");
  console.error(
    `[stage16-live-audit-runner] failed to parse Playwright JSON: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(result.status || 1);
}

const stats = report.stats ?? {};
const executed =
  Number(stats.expected ?? 0) +
  Number(stats.unexpected ?? 0) +
  Number(stats.flaky ?? 0);
const skipped = Number(stats.skipped ?? 0);
const failed = Number(stats.unexpected ?? 0);
const flaky = Number(stats.flaky ?? 0);
const retryCount = countRetries(report);

console.log(
  `[stage16-live-audit-runner] executed=${executed} expected=${stats.expected ?? 0} failed=${failed} skipped=${skipped} flaky=${flaky} retries=${retryCount}`,
);

if (
  result.status !== 0 ||
  executed !== 22 ||
  failed !== 0 ||
  skipped !== 0 ||
  flaky !== 0 ||
  retryCount !== 0
) {
  console.error("[stage16-live-audit-runner] FAIL: expected exactly 22 passed, 0 skipped, 0 failed, 0 retries.");
  process.exit(result.status || 1);
}

console.log("[stage16-live-audit-runner] PASS");

function extractJson(output) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("stdout did not contain a JSON object");
  }
  return output.slice(start, end + 1);
}

function countRetries(playwrightReport) {
  let retries = 0;
  const visitSuite = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = test.results ?? [];
        if (results.length > 1) {
          retries += results.length - 1;
        }
      }
    }
    for (const child of suite.suites ?? []) {
      visitSuite(child);
    }
  };
  for (const suite of playwrightReport.suites ?? []) {
    visitSuite(suite);
  }
  return retries;
}
