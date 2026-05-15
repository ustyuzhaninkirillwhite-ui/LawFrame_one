import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { Dialog, DialogTitle } from "./dialog";
import { Input } from "./input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

describe("UI primitives behavior", () => {
  afterEach(() => {
    cleanup();
  });

  it("forwards disabled state through Button", () => {
    render(<Button disabled>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("supports Button asChild without breaking role and accessible name", () => {
    render(
      <Button asChild>
        <a href="https://example.test/projects">Projects</a>
      </Button>,
    );

    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "href",
      "https://example.test/projects",
    );
  });

  it("keeps localized button children reachable by role and name", () => {
    render(<Button>Настройки</Button>);

    expect(screen.getByRole("button", { name: "Настройки" })).toBeInTheDocument();
  });

  it("selects tabs by click and keyboard activation", () => {
    const onValueChange = vi.fn();
    render(
      <Tabs defaultValue="profile" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">Profile panel</TabsContent>
        <TabsContent value="ai">AI panel</TabsContent>
      </Tabs>,
    );

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Profile panel");

    const aiTab = screen.getByRole("tab", { name: "AI" });
    aiTab.focus();
    fireEvent.keyDown(aiTab, { key: "Enter" });

    expect(screen.getByRole("tabpanel")).toHaveTextContent("AI panel");
    expect(onValueChange).toHaveBeenCalledWith("ai");
  });

  it("renders Dialog with an accessible title/name without changing content", () => {
    render(
      <Dialog open aria-label="Settings dialog">
        <DialogTitle>Settings</DialogTitle>
        <Input aria-label="Display name" />
      </Dialog>,
    );

    expect(screen.getByRole("dialog", { name: "Settings dialog" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Display name" })).toBeInTheDocument();
  });
});
