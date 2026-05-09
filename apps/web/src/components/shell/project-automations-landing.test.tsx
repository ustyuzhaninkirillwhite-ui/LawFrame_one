import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectAutomationsLanding } from "./project-automations-landing";

const replace = vi.fn();
const refetch = vi.fn();
const mutate = vi.fn();
const getActivepiecesCanvasReadiness = vi.fn();
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

vi.mock("@/providers/session-provider", () => ({
  useSessionBridge: () => ({
    apiClient: {
      getActivepiecesCanvasReadiness,
    },
  }),
}));

vi.mock("./project-automations", () => ({
  ProjectAutomations: () => <div>automation list</div>,
}));

describe("ProjectAutomationsLanding", () => {
  beforeEach(() => {
    replace.mockReset();
    refetch.mockReset();
    mutate.mockReset();
    getActivepiecesCanvasReadiness.mockReset();
    getActivepiecesCanvasReadiness.mockResolvedValue({
      status: "ready",
      reasonCode: "READY",
      readinessCode: "READY",
      activepiecesProjectId: "ap-project",
      activepiecesFlowId: "ap-flow",
      activepiecesFlowVersionId: null,
      readinessVersion: "readiness_1",
      activepiecesVersion: "0.82.0",
      embedSdkVersion: "0.9.0",
      repairAttempted: false,
      checkedAt: "2026-05-08T10:00:00.000Z",
      checks: [],
      canonicalReplacementRoute: null,
      message: null,
    });
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

  it("repairs a single automation before opening it when runtime binding is missing", async () => {
    automationsState = {
      ...automationsState,
      data: [
        {
          id: "single-not-ready",
          canOpenBuilder: false,
          runtimeProjectId: null,
          runtimeFlowId: null,
        },
      ],
    };

    render(<ProjectAutomationsLanding projectId="project_claim_001" />);

    await waitFor(() => {
      expect(replace).not.toHaveBeenCalled();
    });
    expect(mutate).toHaveBeenCalled();
  });
});
