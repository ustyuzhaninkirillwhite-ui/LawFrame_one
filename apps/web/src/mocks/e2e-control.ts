import { HttpResponse, delay } from "msw";

export const block5MswControlStorageKey =
  "lexframe.e2e.block5.msw-control";

interface Block5MswFailure {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
  readonly requestId?: string;
  readonly remaining?: number;
}

interface Block5MswDelay {
  readonly delayMs: number;
}

interface Block5MswControl {
  readonly failures?: Record<string, Block5MswFailure>;
  readonly delays?: Record<string, Block5MswDelay>;
  readonly counts?: Record<string, number>;
}

export async function applyBlock5MswControls(key: string) {
  const control = readBlock5MswControl();
  if (!control) {
    return null;
  }

  const nextCounts = {
    ...(control.counts ?? {}),
    [key]: (control.counts?.[key] ?? 0) + 1,
  };
  writeBlock5MswControl({
    ...control,
    counts: nextCounts,
  });

  const delayConfig = control.delays?.[key] ?? null;
  if (delayConfig && delayConfig.delayMs > 0) {
    await delay(delayConfig.delayMs);
  }

  const latest = readBlock5MswControl();
  const failure = latest?.failures?.[key] ?? null;
  if (!latest || !failure) {
    return null;
  }

  const remaining = Math.max((failure.remaining ?? 1) - 1, 0);
  const nextFailures = { ...(latest.failures ?? {}) };
  if (remaining > 0) {
    nextFailures[key] = { ...failure, remaining };
  } else {
    delete nextFailures[key];
  }

  writeBlock5MswControl({
    ...latest,
    failures: nextFailures,
  });

  return HttpResponse.json(
    {
      requestId:
        failure.requestId ?? `block5-${failure.code.toLowerCase()}`,
      error: {
        code: failure.code,
        message: failure.message,
        details: failure.details ?? {},
      },
    },
    { status: failure.status },
  );
}

function readBlock5MswControl(): Block5MswControl | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(block5MswControlStorageKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Block5MswControl;
  } catch {
    window.sessionStorage.removeItem(block5MswControlStorageKey);
    return null;
  }
}

function writeBlock5MswControl(control: Block5MswControl) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    block5MswControlStorageKey,
    JSON.stringify(control),
  );
}
