import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FloatingAiComposer } from "./floating-ai-composer";

const push = vi.fn();
const createProjectChat = vi.fn().mockResolvedValue({
  chat: { id: "chat_created", projectId: "project_claim_001" },
});
const streamChatMessage = vi.fn().mockResolvedValue({ streamId: "stream_1" });
let pathname = "/app/projects/project_claim_001/automations/automation_001/automation";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}));

vi.mock("@/providers/session-provider", () => ({
  useSessionBridge: () => ({
    apiClient: {
      createProjectChat,
      streamChatMessage,
    },
    sessionContext: {
      permissions: ["chat.create"],
    },
  }),
}));

vi.mock("@/hooks/domain/stage15", () => ({
  useStage15Projects: () => ({
    data: {
      items: [{ id: "project_claim_001", name: "Досудебная претензия" }],
    },
    isLoading: false,
  }),
}));

describe("FloatingAiComposer", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    push.mockReset();
    createProjectChat.mockClear();
    streamChatMessage.mockClear();
    pathname = "/app/projects/project_claim_001/automations/automation_001/automation";
  });

  it("floats at the canvas edge and starts a new project chat with automation context", async () => {
    render(<FloatingAiComposer canvasMode={true} />);

    expect(screen.getByTestId("floating-ai-composer")).toHaveAttribute(
      "data-position",
      "canvas-bottom",
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Запрос к LexFrame AI" }), {
      target: { value: "Проверь сценарий автоматизации" },
    });
    fireEvent.submit(screen.getByTestId("floating-ai-composer-form"));

    await waitFor(() => {
      expect(createProjectChat).toHaveBeenCalledWith("project_claim_001", {
        title: "Проверь сценарий автоматизации",
        source: "global_chat",
        currentAutomationId: "automation_001",
      });
      expect(streamChatMessage).toHaveBeenCalledWith("chat_created", {
        text: "Проверь сценарий автоматизации",
      });
      expect(push).toHaveBeenCalledWith(
        "/app/projects/project_claim_001/chats/chat_created",
      );
    });
  });

  it("uses a compact project-bottom composer without visible reasoning mode text", () => {
    pathname = "/app/projects/project_claim_001";

    render(<FloatingAiComposer canvasMode={false} />);

    const input = screen.getByRole("textbox", { name: "Запрос к LexFrame AI" });

    expect(screen.getByTestId("floating-ai-composer")).toHaveAttribute(
      "data-position",
      "project-bottom",
    );
    expect(screen.queryByText(/Продвинутое рассужд/i)).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("placeholder");
  });
});
