import type { SessionContext } from "@lexframe/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider, useSessionBridge } from "./session-provider";

const api = vi.hoisted(() => ({
  bootstrapCalls: 0,
  bootstrapAuth: vi.fn(() => {
    api.bootstrapCalls += 1;
    if (api.bootstrapCalls === 1) {
      return new Promise(() => undefined);
    }
    return Promise.resolve({ status: "ok" });
  }),
  getSessionContext: vi.fn(() => Promise.resolve(authenticatedContext)),
  switchWorkspace: vi.fn(),
}));

vi.mock("@lexframe/api-client", () => ({
  createApiClient: () => api,
}));

vi.mock("@/lib/browser-auth", () => ({
  clearStoredDevAccessToken: vi.fn(),
  createDevAccessToken: vi.fn(),
  getAccessTokenFromSession: vi.fn(),
  getBrowserSupabaseClient: vi.fn(),
  getPublicEnv: () => ({
    NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:3100",
  }),
  isDemoAuthMode: () => true,
  readStoredDevAccessToken: () => "dev-token",
  storeDevAccessToken: vi.fn(),
}));

describe("SessionProvider", () => {
  beforeEach(() => {
    api.bootstrapCalls = 0;
    api.bootstrapAuth.mockClear();
    api.getSessionContext.mockClear();
    api.switchWorkspace.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("revalidates a stored demo token after browser history restores a pending session page", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SessionProvider>
          <SessionProbe />
        </SessionProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(api.bootstrapCalls).toBe(1);
    });
    expect(screen.getByTestId("session-state")).toHaveTextContent("pending");

    window.dispatchEvent(new Event("pageshow"));

    await waitFor(() => {
      expect(screen.getByTestId("session-state")).toHaveTextContent("ready");
    });
    expect(api.bootstrapCalls).toBe(2);
  });
});

function SessionProbe() {
  const { authPending, sessionContext } = useSessionBridge();

  return (
    <div data-testid="session-state">
      {authPending ? "pending" : sessionContext.state}
    </div>
  );
}

const authenticatedContext: SessionContext = {
  state: "ready",
  requestId: "req-session-test",
  actor: {
    id: "usr-session-test",
    email: "session-test@lexframe.local",
    fullName: "Session Test",
    locale: "ru",
    timezone: "Europe/Berlin",
    onboardingStatus: "ready",
  },
  activeWorkspace: {
    id: "workspace-session-test",
    slug: "session-test",
    name: "Session Test",
    status: "active",
    role: "owner",
  },
  workspaces: [
    {
      id: "workspace-session-test",
      slug: "session-test",
      name: "Session Test",
      status: "active",
      role: "owner",
    },
  ],
  roles: ["owner"],
  permissions: ["automation.read"],
  featureFlags: [],
  dataPolicy: {
    aiAllowed: true,
    directSupabaseRead: false,
    externalDeliveryRequiresApproval: true,
  },
  security: {
    mfaRequired: false,
    ssoRequired: false,
    sessionRisk: "low",
    adminActionsRequireReauth: true,
    aiSensitiveDataPolicy: "block",
    externalDeliveryRequiresApproval: true,
  },
};
