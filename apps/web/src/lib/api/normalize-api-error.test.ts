import { describe, expect, it } from "vitest";
import { normalizeApiError } from "./normalize-api-error";

describe("normalizeApiError", () => {
  it("keeps backend API error code, message and request id", () => {
    expect(
      normalizeApiError({
        error: {
          code: "permission_denied",
          message: "No access",
          details: { permission: "dashboard.view" },
        },
        path: "/projects",
        requestId: "req_123",
      }),
    ).toEqual({
      code: "permission_denied",
      message: "No access",
      requestId: "req_123",
      details: { permission: "dashboard.view" },
    });
  });

  it("normalizes client-side errors", () => {
    expect(normalizeApiError(new Error("Network failed"))).toMatchObject({
      code: "client_error",
      message: "Network failed",
      requestId: null,
    });
  });
});
