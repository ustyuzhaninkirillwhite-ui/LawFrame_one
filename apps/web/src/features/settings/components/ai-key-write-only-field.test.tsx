import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiKeyWriteOnlyField } from "./ai-key-write-only-field";

describe("AiKeyWriteOnlyField", () => {
  afterEach(() => cleanup());

  it("never prefills an existing secret and shows only safe metadata", () => {
    render(
      <AiKeyWriteOnlyField
        value=""
        onChange={vi.fn()}
        secret={{
          hasSecret: true,
          secretStatus: "active",
          fingerprint: "sha256:abcd1234",
          lastUpdatedAt: "2026-05-07T10:00:00.000Z",
          backend: "dev_mock",
        }}
      />,
    );

    expect(screen.getByText("Ключ сохранён")).toBeInTheDocument();
    expect(screen.getByText(/sha256:abcd1234/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/sk-/)).not.toBeInTheDocument();
  });

  it("allows replacement only after the user chooses replace", () => {
    const onChange = vi.fn();
    render(
      <AiKeyWriteOnlyField
        value=""
        onChange={onChange}
        secret={{
          hasSecret: true,
          secretStatus: "active",
          fingerprint: "sha256:abcd1234",
          lastUpdatedAt: "2026-05-07T10:00:00.000Z",
          backend: "dev_mock",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Заменить ключ" }));
    fireEvent.change(screen.getByLabelText("Новый API key"), {
      target: { value: "sk-new-value" },
    });

    expect(onChange).toHaveBeenCalledWith("sk-new-value");
  });
});
