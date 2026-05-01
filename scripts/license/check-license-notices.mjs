import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const activepiecesRoot =
  process.env.ACTIVEPIECES_SOURCE_DIR ?? "E:/activepieces-main";

const activepiecesLicensePath = path.join(activepiecesRoot, "LICENSE");
const activepiecesNoticePath = path.join(activepiecesRoot, "NOTICE");
const reportPath = path.join(
  repoRoot,
  "docs/stage17/17.7/license-notice-preservation-report.md",
);

const checks = {
  activepiecesLicensePresent: fileExists(activepiecesLicensePath),
  activepiecesLicenseNonEmpty:
    fileExists(activepiecesLicensePath) &&
    fs.readFileSync(activepiecesLicensePath, "utf8").trim().length > 0,
  activepiecesNoticePresent: fileExists(activepiecesNoticePath),
  activepiecesNoticeNonEmpty:
    !fileExists(activepiecesNoticePath) ||
    fs.readFileSync(activepiecesNoticePath, "utf8").trim().length > 0,
  preservationReportPresent: fileExists(reportPath),
};

const report = {
  activepiecesRoot,
  activepiecesLicensePath,
  activepiecesNoticePath,
  noticePolicy:
    "NOTICE is preserved when present upstream; this Activepieces checkout currently has LICENSE and no NOTICE file.",
  checks,
};

console.log(JSON.stringify(report, null, 2));

if (
  !checks.activepiecesLicensePresent ||
  !checks.activepiecesLicenseNonEmpty ||
  !checks.activepiecesNoticeNonEmpty ||
  !checks.preservationReportPresent
) {
  process.exit(1);
}

function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}
