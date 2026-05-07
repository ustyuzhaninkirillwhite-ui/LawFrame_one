import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectAutomationsLanding } from "./project-automations-landing";

const replace = vi.fn();
const refetch = vi.fn();
const mutate = vi.fn();
let automationsState: Record<string, unknown>;
let ensureState: Record<string, unknown>;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
  }),
}));

vi.mock("@/hooks/domain/stage15", () => ({
  useStage15ProjectAutomations: () => automationsState,
  useEnsureStage17CanvasAutomation: () => ensureState,
}));

vi.mock("./project-automations", () => ({
  ProjectAutomations: () => <div>automation list</div>,
}));

describe("ProjectAutomationsLanding", () => {
  beforeEach(() => {
    replace.mockReset();
    refetch.mockReset();
    mutate.mockReset();
    automationsState = {
      data: [],
      isLoading: false,
      isSuccess: true,
      isError: false,
      refetch,
    };
    ensureState = {
      isPending: false,
      isError: false,
      mutate,
      reset: vi.fn(),
    };
  });

  it("opens the ready ActivePieces automation when legacy entries are also present", async () => {
    automationsState = {
      ...automationsState,
      data: [
        {
          id: "legacy-canvas",
          canOpenBuilder: false,
          runtimeProjectId: null,
          runtimeFlowId: null,
        },
        {
          id: "activepieces-canvas",
          canOpenBuilder: true,
          runtimeProjectId: "ap-project",
          runtimeFlowId: "ap-flow",
        },
      ],
    };

    render(<ProjectAutomationsLanding projectId="project_claim_001" />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        "/app/projects/project_claim_001/automations/activepieces-canvas/automation",
      );
    });
  });
});
