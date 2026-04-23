import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const port = Number(process.env.DELIVERY_SANDBOX_PORT ?? "8091");
const host = process.env.DELIVERY_SANDBOX_HOST ?? "0.0.0.0";
const maxCaptures = Number(process.env.DELIVERY_SANDBOX_MAX_CAPTURES ?? "200");
const bearerToken = (process.env.DELIVERY_SANDBOX_TOKEN ?? "").trim();

/** @type {Array<{
 *   id: string;
 *   receivedAt: string;
 *   payload: Record<string, unknown>;
 *   headers: Record<string, string>;
 * }>} */
const captures = [];

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    return respondJson(response, 200, {
      service: "lexframe-delivery-sandbox",
      status: "ok",
      captureCount: captures.length,
      lastCaptureId: captures[0]?.id ?? null,
      lastCaptureAt: captures[0]?.receivedAt ?? null,
    });
  }

  if (request.method === "GET" && url.pathname === "/captures") {
    return respondJson(response, 200, {
      captures,
    });
  }

  if (request.method === "POST" && url.pathname === "/captures/reset") {
    captures.splice(0, captures.length);
    return respondJson(response, 200, {
      status: "reset",
      captureCount: 0,
    });
  }

  if (request.method === "POST" && url.pathname === "/hooks/delivery") {
    if (
      bearerToken.length > 0 &&
      request.headers.authorization !== `Bearer ${bearerToken}`
    ) {
      return respondJson(response, 401, {
        error: "UNAUTHORIZED",
      });
    }

    let payload;

    try {
      payload = await readJsonBody(request);
    } catch {
      return respondJson(response, 400, {
        error: "INVALID_JSON",
      });
    }
    const capture = {
      id: `capture_${randomUUID()}`,
      receivedAt: new Date().toISOString(),
      payload,
      headers: pickHeaders(request.headers, [
        "content-type",
        "x-request-id",
        "x-trace-id",
      ]),
    };

    captures.unshift(capture);
    captures.splice(maxCaptures);

    return respondJson(response, 200, {
      accepted: true,
      providerMessageId: `sandbox-${capture.id}`,
      captureId: capture.id,
      captureCount: captures.length,
      receivedAt: capture.receivedAt,
    });
  }

  return respondJson(response, 404, {
    error: "NOT_FOUND",
    path: url.pathname,
  });
});

server.listen(port, host, () => {
  process.stdout.write(
    `[delivery-sandbox] listening on http://${host}:${port}\n`,
  );
});

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

function pickHeaders(headers, allowedKeys) {
  return allowedKeys.reduce((accumulator, key) => {
    const value = headers[key];

    if (typeof value === "string" && value.length > 0) {
      accumulator[key] = value;
    }

    return accumulator;
  }, /** @type {Record<string, string>} */ ({}));
}
