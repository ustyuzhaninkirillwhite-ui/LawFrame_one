import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceSwitcher } from "./workspace-switcher";

const switchWorkspace = vi.fn();

vi.mock("@/providers/session-provider", () => ({
  useSessionBridge: () => ({
    sessionContext: {
      state: "ready",
      requestId: "req_test",
      actor: {
        id: "usr_test",
        email: "maria@lexframe.local",
        fullName: "Maria Orlova",
        locale: "ru",
        timezone: "Europe/Berlin",
        onboardingStatus: "ready",
      },
      activeWorkspace: {
        id: "ws_a",
        slug: "orlov-partners",
        name: "Orlov & Partners",
        role: "owner",
        status: "active",
      },
      workspaces: [
        {
          id: "ws_a",
          slug: "orlov-partners",
          name: "Orlov & Partners",
          role: "owner",
          status: "active",
        },
        {
          id: "ws_b",
          slug: "litigation-lab",
          name: "Litigation Lab",
          role: "lawyer",
          status: "active",
        },
      ],
      roles: ["owner"],
      permissions: ["workspace.switch"],
      featureFlags: [],
      dataPolicy: {
        aiAllowed: false,
        directSupabaseRead: false,
        externalDeliveryRequiresApproval: true,
      },
    },
    switchWorkspace,
  }),
}));

describe("WorkspaceSwitcher", () => {
  it("renders the active workspace and available workspace options", () => {
    render(<WorkspaceSwitcher />);

    expect(screen.getAllByText("Orlov & Partners")).toHaveLength(2);
    expect(screen.getByText("orlov-partners")).toBeInTheDocument();
    expect(screen.getByText("Litigation Lab")).toBeInTheDocument();
  });
});
