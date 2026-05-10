import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsButton } from "./settings-button";
import { useSettingsDialogStore } from "./settings-dialog-store";

vi.mock("./settings-shell", () => ({
  SettingsShell: ({ onClose }: { readonly onClose?: () => void }) => (
    <div>
      <h1>Settings shell</h1>
      {onClose ? (
        <button type="button" onClick={onClose}>
          Закрыть настройки
        </button>
      ) : null}
    </div>
  ),
}));

describe("SettingsButton", () => {
  afterEach(() => {
    cleanup();
    useSettingsDialogStore.getState().setOpen(false);
  });

  it("keeps the settings dialog open when the sidebar button remounts after session refresh", async () => {
    const { unmount } = render(<SettingsButton />);

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    expect(screen.getByRole("dialog")).toBeVisible();

    unmount();
    render(<SettingsButton />);

    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("closes the shared settings dialog when the close action is clicked", async () => {
    render(<SettingsButton />);

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    fireEvent.click(screen.getByRole("button", { name: "Закрыть настройки" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the shared settings dialog with Escape", async () => {
    render(<SettingsButton />);

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
