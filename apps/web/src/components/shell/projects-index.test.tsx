import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectsIndex } from "./projects-index";

const push = vi.fn();
const createProject = vi.fn().mockResolvedValue({
  project: { id: "project_created", name: "Новый спор" },
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/hooks/domain/stage15", () => ({
  useCreateStage15Project: () => ({
    isPending: false,
    mutateAsync: createProject,
  }),
  useStage15Projects: () => ({
    data: {
      items: [
        {
          id: "project_claim_001",
          name: "Досудебная претензия",
          description: "Материалы дела",
          status: "active",
          counters: {
            chats: 2,
            automations: 1,
            documents: 0,
            activeRuns: 0,
            pendingApprovals: 0,
            recommendations: 0,
            missingConnections: 0,
          },
        },
      ],
    },
    isLoading: false,
  }),
}));

describe("ProjectsIndex", () => {
  it("renders projects and creates a new project from the index", async () => {
    render(<ProjectsIndex />);

    expect(screen.getByRole("heading", { name: "Проекты" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Досудебная претензия/ })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Название проекта"), {
      target: { value: "Новый спор" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать проект" }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith({
        name: "Новый спор",
        description: "",
        color: "#3B82F6",
      });
      expect(push).toHaveBeenCalledWith("/app/projects/project_created");
    });
  });
});
