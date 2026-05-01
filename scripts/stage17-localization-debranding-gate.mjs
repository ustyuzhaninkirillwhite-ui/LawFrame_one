import { spawnSync } from "node:child_process";

const checks = [
  ["i18n:check-activepieces-ru", "scripts/i18n/check-activepieces-ru-coverage.mjs"],
  [
    "pieces:i18n:check --locale ru",
    "scripts/i18n/check-activepieces-pieces-ru.mjs",
    "--locale",
    "ru",
  ],
  ["branding:check-visible", "scripts/branding/check-visible.mjs"],
  ["license:check-notices", "scripts/license/check-license-notices.mjs"],
  [
    "stage17:functionality-preservation",
    "scripts/stage17-functionality-preservation.mjs",
  ],
];

const results = [];

for (const [name, script, ...args] of checks) {
  const result = spawnSync(process.execPath, [script, ...args], {
    stdio: "inherit",
    shell: false,
  });
  results.push({ name, status: result.status ?? 1 });

  if (result.status !== 0) {
    console.error(`${name} failed`);
    console.log(JSON.stringify({ results }, null, 2));
    process.exit(result.status ?? 1);
  }
}

console.log(JSON.stringify({ results }, null, 2));
