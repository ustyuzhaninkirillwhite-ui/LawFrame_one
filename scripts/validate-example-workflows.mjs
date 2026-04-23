import { validateExampleWorkflows } from "../packages/workflow/dist/index.js";

const result = validateExampleWorkflows();

if (!result.ok) {
  console.error("Workflow example validation failed.");
  for (const issue of result.issues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
} else {
  console.log("Workflow example validation passed.");
}

