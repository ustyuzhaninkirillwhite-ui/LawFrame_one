import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavSidebar } from "./nav-sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("@/providers/session-provider", () => ({
  useSessionBridge: () => ({
    sessionContext: {
      state: "ready",
      requestId: "req_test",
      actor: {
        id: "usr_test",
        email: "viewer@lexframe.local",
        fullName: "Viewer",
        locale: "ru",
        timezone: "Europe/Berlin",
        onboardingStatus: "ready",
      },
      activeWorkspace: {
        id: "ws_view",
        slug: "viewer-space",
        name: "Viewer Space",
        role: "viewer",
        status: "active",
      },
      workspaces: [
        {
          id: "ws_view",
          slug: "viewer-space",
          name: "Viewer Space",
          role: "viewer",
          status: "active",
        },
      ],
      roles: ["viewer"],
      permissions: ["dashboard.view", "workspace.read", "document.read", "automation.read"],
      featureFlags: [],
      dataPolicy: {
        aiAllowed: false,
        directSupabaseRead: false,
        externalDeliveryRequiresApproval: true,
      },
    },
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-stage0-data", () => ({
  useNotifications: () => ({
    data: {
      items: [],
      nextCursor: null,
      unreadCount: 0,
    },
  }),
}));

vi.mock("./workspace-switcher", () => ({
  WorkspaceSwitcher: () => <div>workspace switcher</div>,
}));

describe("NavSidebar", () => {
  it("hides the admin/security link when the permission is absent", () => {
    render(<NavSidebar />);

    expect(screen.queryByText("Администрирование / безопасность")).not.toBeInTheDocument();
    expect(screen.getByText("Документы")).toBeInTheDocument();
  });
});
