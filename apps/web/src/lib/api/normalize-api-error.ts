import type { ApiErrorResponse } from "@lexframe/contracts";

export interface NormalizedApiError {
  readonly code: string;
  readonly message: string;
  readonly requestId: string | null;
  readonly details: Record<string, unknown>;
}

export function normalizeApiError(error: unknown): NormalizedApiError {
  if (isApiErrorResponse(error)) {
    return {
      code: error.error.code,
      message: error.error.message,
      requestId: error.requestId,
      details: error.error.details ?? {},
    };
  }

  if (error instanceof Error) {
    return {
      code: "client_error",
      message: error.message,
      requestId: null,
      details: {},
    };
  }

  if (typeof error === "string") {
    return {
      code: "client_error",
      message: error,
      requestId: null,
      details: {},
    };
  }

  return {
    code: "unknown_error",
    message: "Unknown API error",
    requestId: null,
    details: {},
  };
}

function isApiErrorResponse(error: unknown): error is ApiErrorResponse {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as Partial<ApiErrorResponse>;
  return (
    Boolean(candidate.error) &&
    typeof candidate.error?.code === "string" &&
    typeof candidate.error?.message === "string"
  );
}
