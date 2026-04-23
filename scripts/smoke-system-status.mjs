const baseUrl = process.env.LEXFRAME_SMOKE_BASE_URL ?? "http://127.0.0.1:3100";
const endpoints = [
  "/health/live",
  "/health/ready",
  "/health/dependencies",
  "/system/status",
  "/metrics",
];

const failures = [];

for (const endpoint of endpoints) {
  const response = await fetch(`${baseUrl}${endpoint}`);
  if (!response.ok) {
    console.error(`FAIL: ${endpoint} -> ${response.status}`);
    failures.push(endpoint);
    continue;
  }

  console.log(`OK: ${endpoint} -> ${response.status}`);
}

if (failures.length > 0) {
  process.exitCode = 1;
}
