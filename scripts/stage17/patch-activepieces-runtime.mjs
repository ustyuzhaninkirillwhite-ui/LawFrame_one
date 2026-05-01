import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const docker =
  process.env.DOCKER_CLI_PATH ?? (process.platform === "win32" ? "docker.exe" : "docker");
const activepiecesRoot =
  process.env.ACTIVEPIECES_SOURCE_DIR ?? "E:/activepieces-main";
const ruLocaleSource = path.join(
  activepiecesRoot,
  "packages/web/public/locales/ru/translation.json",
);

const containers = [
  process.env.STAGE17_ACTIVEPIECES_APP_CONTAINER ??
    "lexframe-stage17-activepieces-app-1",
  process.env.STAGE17_ACTIVEPIECES_WORKER_CONTAINER ??
    "lexframe-stage17-activepieces-worker-1",
];

const copies = [
  {
    source: ruLocaleSource,
    target: "/usr/src/app/packages/react-ui/public/locales/ru/translation.json",
    required: true,
  },
  {
    // The upstream image can still resolve the embedded session through the
    // default language detector. Keep the user-facing default namespace Russian.
    source: ruLocaleSource,
    target: "/usr/src/app/packages/react-ui/public/locales/en/translation.json",
    required: true,
  },
  {
    source: path.join(activepiecesRoot, "packages/web/public/lexframe-automation-icon.svg"),
    target: "/usr/src/app/packages/react-ui/public/lexframe-automation-icon.svg",
    required: true,
  },
  {
    source: path.join(activepiecesRoot, "packages/web/public/lexframe-automation-logo.svg"),
    target: "/usr/src/app/packages/react-ui/public/lexframe-automation-logo.svg",
    required: true,
  },
  {
    source: path.join(activepiecesRoot, "packages/web/public/lexframe-automation-icon.svg"),
    target: "/usr/src/app/packages/react-ui/public/logo.svg",
    required: true,
  },
];

const report = {
  activepiecesRoot,
  containers: [],
};

for (const container of containers) {
  const exists =
    spawn(docker, ["container", "inspect", container], { silent: true }).status === 0;
  if (!exists) {
    report.containers.push({ container, status: "missing" });
    continue;
  }

  const copied = [];
  for (const item of copies) {
    if (!existsSync(item.source)) {
      if (item.required) {
        console.error(
          `[stage17:activepieces:patch-runtime] Missing source: ${item.source}`,
        );
        process.exit(1);
      }
      continue;
    }

    const mkdir = spawn(docker, [
      "exec",
      container,
      "sh",
      "-lc",
      `mkdir -p ${quotePosix(path.posix.dirname(item.target))}`,
    ]);
    if (mkdir.status !== 0) {
      process.exit(mkdir.status ?? 1);
    }

    const copy = spawn(docker, ["cp", item.source, `${container}:${item.target}`]);
    if (copy.status !== 0) {
      process.exit(copy.status ?? 1);
    }
    copied.push(item.target);
  }

  const verify = spawn(docker, [
    "exec",
    container,
    "sh",
    "-lc",
    "node -e \"const fs=require('fs'); for (const lang of ['ru','en']) { const p='/usr/src/app/packages/react-ui/public/locales/'+lang+'/translation.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); if (j.Flows !== 'Сценарии' || j.Runs !== 'Запуски' || j.Publish !== 'Опубликовать' || j.Activepieces !== 'Конструктор автоматизаций' || j['Please select a piece first'] !== 'Сначала выберите модуль') process.exit(2); }\"",
  ]);
  if (verify.status !== 0) {
    process.exit(verify.status ?? 1);
  }

  report.containers.push({ container, status: "patched", copied });
}

console.log(JSON.stringify(report, null, 2));

function spawn(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    stdio: options.silent ? "ignore" : "inherit",
    shell: false,
    encoding: "utf8",
    env: process.env,
  });
}

function quotePosix(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
