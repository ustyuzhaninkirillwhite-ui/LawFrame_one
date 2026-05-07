import net from "node:net";
import { spawnSync } from "node:child_process";

export async function assertStage17HostPortsAvailable({
  docker,
  root,
  ports = [3100],
}) {
  for (const port of ports) {
    if (await canBindPort(port)) {
      continue;
    }

    const owners = listDockerPortOwners(docker, root, port);
    if (
      owners.length > 0 &&
      owners.every((owner) => isControlledStage17PortOwner(owner))
    ) {
      continue;
    }

    throw new Error(formatPortConflictMessage(port, owners));
  }
}

export function isControlledStage17PortOwner(name) {
  return /^lexframe-stage17-reverse-proxy-\d+$/.test(name);
}

export function formatPortConflictMessage(port, owners) {
  const ownerText =
    owners.length > 0
      ? ` Docker owner(s): ${owners.join(", ")}.`
      : " No Docker owner was detected; a local process may be bound to the port.";
  return (
    `[stage17:compose] port ${port} is already in use.` +
    ownerText +
    " stage17:down only manages lexframe-stage17 containers; stop the conflicting service manually or choose a non-conflicting runtime before rerunning stage17:up."
  );
}

function listDockerPortOwners(docker, root, port) {
  const result = spawnSync(
    docker,
    ["ps", "--filter", `publish=${port}`, "--format", "{{.Names}}"],
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
      env: process.env,
    },
  );
  if (result.status !== 0 || !result.stdout) {
    return [];
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function canBindPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}
