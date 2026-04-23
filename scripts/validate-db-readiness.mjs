import fs from "node:fs/promises";
import path from "node:path";

const requiredFiles = [
  "supabase/README.md",
  "supabase/migrations/000001_extensions.sql",
  "supabase/tests/pgtap/rls_smoke.sql",
];

const requiredDirs = [
  "supabase/migrations",
  "supabase/tests/pgtap",
  "supabase/seed",
];

const failures = [];

async function exists(relativePath) {
  try {
    await fs.access(path.resolve(relativePath));
    return true;
  } catch {
    return false;
  }
}

function check(condition, label) {
  if (condition) {
    console.log(`OK: ${label}`);
    return;
  }

  console.error(`FAIL: ${label}`);
  failures.push(label);
}

for (const directory of requiredDirs) {
  check(await exists(directory), `Database directory exists: ${directory}`);
}

for (const file of requiredFiles) {
  check(await exists(file), `Database readiness file exists: ${file}`);
}

if (failures.length > 0) {
  console.error("\nDatabase readiness validation failed.");
  process.exitCode = 1;
} else {
  console.log("\nDatabase readiness validation passed.");
}
