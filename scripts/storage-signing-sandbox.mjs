import { createServer } from "node:http";
import { createHmac, randomUUID } from "node:crypto";

const port = Number(process.env.STORAGE_SANDBOX_PORT ?? "54321");
const host = process.env.STORAGE_SANDBOX_HOST ?? "0.0.0.0";
const signingSecret =
  (process.env.SUPABASE_SECRET_KEY ?? "stage14_storage_sandbox_secret").trim() ||
  "stage14_storage_sandbox_secret";
const maxEvents = Number(process.env.STORAGE_SANDBOX_MAX_EVENTS ?? "200");

const events = [];

const server = createServer(async (request, response) => {
  const url = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? "localhost"}`,
  );

  if (request.method === "GET" && url.pathname === "/health") {
    return respondJson(response, 200, {
      service: "lexframe-storage-signing-sandbox",
      status: "ok",
      eventCount: events.length,
      lastEventAt: events[0]?.issuedAt ?? null,
    });
  }

  if (request.method === "GET" && url.pathname === "/storage/v1/health") {
    return respondJson(response, 200, {
      name: "storage",
      status: "ok",
    });
  }

  if (request.method === "GET" && url.pathname === "/storage/v1/signing-events") {
    return respondJson(response, 200, {
      events,
    });
  }

  if (
    request.method === "POST" &&
    url.pathname.startsWith("/storage/v1/object/sign/")
  ) {
    if (!hasValidBearer(request.headers.authorization)) {
      return respondJson(response, 401, {
        error: "UNAUTHORIZED",
      });
    }

    let body;
    try {
      body = await readJsonBody(request);
    } catch {
      return respondJson(response, 400, {
        error: "INVALID_JSON",
      });
    }

    const target = decodeStorageTarget(url.pathname);
    if (!target) {
      return respondJson(response, 400, {
        error: "INVALID_STORAGE_TARGET",
      });
    }

    const expiresIn = clampExpiresIn(body?.expiresIn);
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const token = createHmac("sha256", signingSecret)
      .update(`${target.bucket}/${target.objectPath}:${expiresAt}`)
      .digest("hex")
      .slice(0, 40);
    const signedURL =
      `/storage/v1/object/sign/${encodeURIComponent(target.bucket)}/` +
      `${target.objectPath.split("/").map(encodeURIComponent).join("/")}` +
      `?token=${token}&expires=${encodeURIComponent(expiresAt)}`;

    events.unshift({
      id: `storage_sign_${randomUUID()}`,
      issuedAt,
      expiresAt,
      bucket: target.bucket,
      objectPath: target.objectPath,
      expiresIn,
    });
    events.splice(maxEvents);

    return respondJson(response, 200, {
      signedURL,
    });
  }

  return respondJson(response, 404, {
    error: "NOT_FOUND",
    path: url.pathname,
  });
});

server.listen(port, host, () => {
  process.stdout.write(
    `[storage-sandbox] listening on http://${host}:${port}\n`,
  );
});

function decodeStorageTarget(pathname) {
  const prefix = "/storage/v1/object/sign/";
  const rest = pathname.slice(prefix.length);
  const slashIndex = rest.indexOf("/");

  if (slashIndex <= 0 || slashIndex === rest.length - 1) {
    return null;
  }

  return {
    bucket: decodeURIComponent(rest.slice(0, slashIndex)),
    objectPath: rest
      .slice(slashIndex + 1)
      .split("/")
      .map(decodeURIComponent)
      .join("/"),
  };
}

function clampExpiresIn(value) {
  if (!Number.isFinite(Number(value))) {
    return 60;
  }

  return Math.max(1, Math.min(Number(value), 60 * 60));
}

function hasValidBearer(value) {
  return (
    typeof value === "string" &&
    value.startsWith("Bearer ") &&
    value.slice("Bearer ".length).trim().length > 0
  );
}

function respondJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}
