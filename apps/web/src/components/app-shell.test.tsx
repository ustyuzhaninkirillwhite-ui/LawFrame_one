import { cleanup, render, screen } from "@testing-library/react";
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

vi.mock("./system-status-banner", () => ({
  SystemStatusBanner: () => <div>System status</div>,
}));

describe("AppShell", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigation.pathname = "/app/connectors";
  });

  it("keeps the global floating composer on non-chat app routes", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.getByText("Global floating composer")).toBeInTheDocument();
  });

  it("hides the global floating composer on project chat routes", () => {
    navigation.pathname = "/app/projects/project_claim_001/chats/thread_existing";

    render(
      <AppShell>
        <div>Chat content</div>
      </AppShell>,
    );

    expect(screen.queryByText("Global floating composer")).not.toBeInTheDocument();
  });
});
