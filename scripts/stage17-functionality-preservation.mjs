import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const backendSessionPath = path.join(
  repoRoot,
  "apps/backend/src/modules/activepieces/activepieces-session.service.ts",
);
const wrapperPath = path.join(
  repoRoot,
  "apps/web/src/features/automation-canvas/activepieces-canvas-wrapper.tsx",
);
const routePath = path.join(
  repoRoot,
  "apps/web/src/features/automation-canvas/activepieces-canvas-route.tsx",
);

const backendSource = fs.readFileSync(backendSessionPath, "utf8");
const wrapperSource = fs.readFileSync(wrapperPath, "utf8");
const routeSource = fs.readFileSync(routePath, "utf8");

const requiredBackendFlags = {
  disableNavigationKept: backendSource.includes("disable_navigation: false"),
  hideFlowNameKept: backendSource.includes("hide_flow_name: false"),
  sidebarKept: backendSource.includes("hide_sidebar: false"),
  flowsNavbarKept: backendSource.includes("hide_flows_page_navbar: false"),
  pageHeaderKept: backendSource.includes("hide_page_header: false"),
  foldersKept: backendSource.includes("hide_folders: false"),
  importExportKept: backendSource.includes(
    "hide_export_and_import_flow: false",
  ),
  duplicateFlowKept: backendSource.includes("hide_duplicate_flow: false"),
};

const requiredFrontendSurfaces = {
  activepiecesWrapperMounted: routeSource.includes("<ActivepiecesCanvasWrapper"),
  pureCanvasRoute: !routeSource.includes("<AutomationTabs"),
  reserveCanvasNotFallback: !routeSource.includes("<WorkflowCanvasPage"),
  sdkEmbeddingUsed: wrapperSource.includes("embedding: {"),
  localeRuSent: wrapperSource.includes('locale: "ru"'),
};

const forbiddenHidingPatterns = [
  /display\s*:\s*["']?none/i,
  /visibility\s*:\s*["']?hidden/i,
  /hideSidebar:\s*true/,
  /hideFolders:\s*true/,
  /hideExportAndImportFlow:\s*true/,
  /hideDuplicateFlow:\s*true/,
  /disableNavigation:\s*true/,
];
const forbiddenHidingHits = forbiddenHidingPatterns
  .filter((pattern) => pattern.test(wrapperSource) || pattern.test(routeSource))
  .map((pattern) => pattern.toString());

const report = {
  requiredBackendFlags,
  requiredFrontendSurfaces,
  forbiddenHidingHits,
};

console.log(JSON.stringify(report, null, 2));

if (
  Object.values(requiredBackendFlags).some((value) => !value) ||
  Object.values(requiredFrontendSurfaces).some((value) => !value) ||
  forbiddenHidingHits.length > 0
) {
  process.exit(1);
}
