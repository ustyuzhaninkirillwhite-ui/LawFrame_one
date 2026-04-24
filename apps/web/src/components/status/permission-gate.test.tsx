import { cleanup, render, screen } from "@testing-library/react";
import type { PermissionCode } from "@lexframe/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureGate, PermissionGate, usePermission } from "./permission-gate";

let permissions: PermissionCode[] = [];
let featureFlags: string[] = [];

vi.mock("@/providers/session-provider", () => ({
  useSessionBridge: () => ({
    sessionContext: {
      permissions,
      featureFlags,
    },
  }),
}));

function Probe({ permission }: { readonly permission: PermissionCode }) {
  return <div>{usePermission(permission) ? "allowed" : "blocked"}</div>;
}

describe("PermissionGate", () => {
  beforeEach(() => {
    cleanup();
    permissions = [];
    featureFlags = [];
  });

  it("renders children when backend session context contains permission", () => {
    permissions = ["dashboard.view"];

    render(
      <PermissionGate permission="dashboard.view">
        <div>Dashboard content</div>
      </PermissionGate>,
    );

    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
  });

  it("renders a blocked state when permission is absent", () => {
    render(
      <PermissionGate permission="dashboard.view">
        <div>Dashboard content</div>
      </PermissionGate>,
    );

    expect(screen.queryByText("Dashboard content")).not.toBeInTheDocument();
    expect(screen.getByText(/permission dashboard\.view/)).toBeInTheDocument();
  });

  it("exposes usePermission for disabled-with-reason controls", () => {
    render(<Probe permission="automation.edit" />);

    expect(screen.getByText("blocked")).toBeInTheDocument();
  });
});

describe("FeatureGate", () => {
  it("renders children only when the feature flag is enabled", () => {
    featureFlags = ["stage15.builder"];

    render(
      <FeatureGate flag="stage15.builder">
        <div>Builder content</div>
      </FeatureGate>,
    );

    expect(screen.getByText("Builder content")).toBeInTheDocument();
  });
});
