"use client";

export function clearActivepiecesBrowserSessionTokens() {
  for (const storage of [window.sessionStorage, window.localStorage]) {
    for (const key of ["token", "activepieces-token", "activepieces_token"]) {
      const value = storage.getItem(key);
      if (value && isActivepiecesJwt(value)) {
        storage.removeItem(key);
      }
    }
  }
}

function isActivepiecesJwt(value: string) {
  const parts = value.split(".");
  if (parts.length !== 3) {
    return false;
  }
  const payload = decodeJwtJson(parts[1] ?? "");
  return payload?.iss === "activepieces";
}

function decodeJwtJson(segment: string): Record<string, unknown> | null {
  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    return JSON.parse(window.atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
