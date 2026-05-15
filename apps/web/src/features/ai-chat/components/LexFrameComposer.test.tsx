import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LexFrameComposer } from "./LexFrameComposer";

describe("LexFrameComposer", () => {
  afterEach(() => {
    cleanup();
  });

  it("guards two submit events in the same render batch", () => {
    const onSend = vi.fn(() => new Promise<void>(() => undefined));
    const { container } = render(
      <LexFrameComposer
        disabled={false}
        isRunning={false}
        onCancel={vi.fn()}
        onSend={onSend}
      />,
    );

    fireEvent.change(screen.getByTestId("chat-composer-input"), {
      target: { value: "BLOCK3_DOUBLE_SUBMIT" },
    });
    const form = container.querySelector("form");
    expect(form).not.toBeNull();

    act(() => {
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("BLOCK3_DOUBLE_SUBMIT", []);
  });
});
