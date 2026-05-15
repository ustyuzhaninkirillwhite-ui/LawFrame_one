import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

const navigation = vi.hoisted(() => ({
  pathname: "/app/connectors",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

vi.mock("@/components/shell/project-sidebar", () => ({
  ProjectSidebar: () => <aside>Sidebar</aside>,
}));

vi.mock("@/components/shell/floating-ai-composer", () => ({
  FloatingAiComposer: () => <div>Global floating composer</div>,
}));

vi.mock("@/features/automation-canvas/activepieces-background-canvas-provider", () => ({
  ActivepiecesBackgroundCanvasProvider: ({
    children,
  }: {
    readonly children: ReactNode;
  }) => <>{children}</>,
}));

vi.mock("./system-status-banner", () => ({
  SystemStatusBanner: () => <div>System status</div>,
}));

describe("AppShell", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigation.pathname = "/app/connectors";
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("keeps the global floating composer on non-chat app routes", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.getByText("Global floating composer")).toBeInTheDocument();
    expect(screen.getByTestId("app-shell-panel")).toBeInTheDocument();
    expect(screen.getByTestId("app-shell-root")).toHaveAttribute(
      "data-shell-mode",
      "panel",
    );
  });

  it("hides the global floating composer on project chat routes", () => {
    navigation.pathname = "/app/projects/project_claim_001/chats/thread_existing";

    render(
      <AppShell>
        <div>Chat content</div>
      </AppShell>,
    );

    expect(screen.queryByText("Global floating composer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-shell-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("app-shell-root")).toHaveAttribute(
      "data-shell-mode",
      "immersive",
    );
  });

  it("hides the global floating composer on global chat routes", () => {
    navigation.pathname = "/chat/thread_existing";

    const { container } = render(
      <AppShell>
        <div>Global chat content</div>
      </AppShell>,
    );

    expect(screen.queryByText("Global floating composer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-shell-panel")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("h-screen", "overflow-hidden");
    expect(screen.getByTestId("app-shell-main")).toHaveAttribute(
      "data-route-mode",
      "global-chat",
    );
  });

  it("renders project workspace routes without the legacy dashboard panel shell", () => {
    navigation.pathname = "/app/projects/project_claim_001";

    render(
      <AppShell>
        <div>Project workspace</div>
      </AppShell>,
    );

    expect(screen.getByText("Project workspace")).toBeInTheDocument();
    expect(screen.queryByText("System status")).not.toBeInTheDocument();
    expect(screen.queryByText("Global floating composer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-shell-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("app-shell-main")).toHaveAttribute(
      "data-route-mode",
      "project-workspace",
    );
  });

  it("renders automation canvas routes as bounded immersive routes", () => {
    navigation.pathname = "/app/projects/project_claim_001/automations/automation_001/automation";

    const { container } = render(
      <AppShell>
        <div>Automation canvas</div>
      </AppShell>,
    );

    expect(screen.getByText("Automation canvas")).toBeInTheDocument();
    expect(screen.queryByText("System status")).not.toBeInTheDocument();
    expect(screen.queryByText("Global floating composer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-shell-panel")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("h-screen", "overflow-hidden");
    expect(screen.getByTestId("app-shell-root")).toHaveAttribute(
      "data-shell-mode",
      "canvas",
    );
    expect(screen.getByTestId("app-shell-main")).toHaveAttribute(
      "data-route-mode",
      "automation-canvas",
    );
  });

  it("clears stale Activepieces browser tokens outside the embed route", () => {
    window.sessionStorage.setItem(
      "token",
      [
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        "eyJpc3MiOiJhY3RpdmVwaWVjZXMiLCJ0eXBlIjoiQUNDRVNTIn0",
        "signature",
      ].join("."),
    );

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    expect(window.sessionStorage.getItem("token")).toBeNull();
  });

  it("clears stale Activepieces browser tokens on automation routes too", () => {
    navigation.pathname = "/app/projects/project_claim_001/automations/automation_001/automation";
    const token = [
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      "eyJpc3MiOiJhY3RpdmVwaWVjZXMiLCJ0eXBlIjoiQUNDRVNTIn0",
      "signature",
    ].join(".");
    window.sessionStorage.setItem("token", token);

    render(
      <AppShell>
        <div>Automation canvas</div>
      </AppShell>,
    );

    expect(window.sessionStorage.getItem("token")).toBeNull();
  });
});
