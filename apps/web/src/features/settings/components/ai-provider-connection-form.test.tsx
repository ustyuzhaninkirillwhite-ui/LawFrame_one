import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiProviderConnectionForm } from "./ai-provider-connection-form";

describe("AiProviderConnectionForm", () => {
  afterEach(() => cleanup());

  it("defaults new workspace CometAPI setup to the attached model settings without prefilling a key", () => {
    const onChange = vi.fn();

    render(
      <AiProviderConnectionForm
        connection={null}
        routeGroup="chat_ai"
        onChange={onChange}
        onTest={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Provider")).toHaveValue("cometapi");
    expect(screen.getByLabelText("Base URL")).toHaveValue(
      "https://api.cometapi.com/v1",
    );
    expect(screen.getByLabelText("Model id")).toHaveValue(
      "grok-4-1-fast-non-reasoning",
    );
    expect(screen.queryByDisplayValue(/^sk-/)).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        providerCode: "cometapi",
        baseUrl: "https://api.cometapi.com/v1",
        modelId: "grok-4-1-fast-non-reasoning",
        apiKey: "",
      }),
    );
  });
});
