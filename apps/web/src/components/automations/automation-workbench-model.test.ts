import { describe, expect, it } from "vitest";
import {
  addPaletteNodeToCanvas,
  addComposerAttachment,
  createEmptyWorkflowCanvas,
  createDefaultWorkflowCanvas,
  createsCycleWithEdge,
  insertPaletteNodeAfter,
  insertPaletteNodeOnEdge,
  isBlockingCanvasIssue,
  legalBlockPalette,
  removeCanvasEdge,
  removeCanvasNode,
  removeComposerAttachment,
  updateCanvasEdge,
  updateCanvasNode,
  updateCanvasNodePosition,
  validateCanvasGraph,
  type AutomationComposerAttachment,
  type WorkflowCanvasDraft,
} from "./automation-workbench-model";

describe("automation workbench canvas model", () => {
  it("starts an empty canvas draft without nodes or validation errors", () => {
    const draft = createEmptyWorkflowCanvas();

    expect(draft.nodes).toEqual([]);
    expect(draft.edges).toEqual([]);
    expect(validateCanvasGraph(draft.nodes, draft.edges)).toEqual([]);
  });

  it("creates a custom block with a stable position", () => {
    const draft = createEmptyWorkflowCanvas();
    const nextDraft = addPaletteNodeToCanvas(draft, legalBlockPalette[0]!, "custom_1", {
      x: 240,
      y: 180,
    });

    expect(nextDraft.nodes).toEqual([
      expect.objectContaining({
        id: "custom_1",
        kind: "custom",
        position: {
          x: 240,
          y: 180,
        },
        title: "Свой блок",
      }),
    ]);
    expect(nextDraft.edges).toEqual([]);
  });

  it("creates a valid default legal automation chain", () => {
    const draft = createDefaultWorkflowCanvas();

    expect(draft.nodes.map((node) => node.title)).toEqual([
      "Триггер",
      "Документы",
      "Юридический анализ",
      "Генерация",
      "Согласование",
      "Отправка/Сохранение",
    ]);
    expect(draft.nodes[3]?.position).toEqual({
      x: 520,
      y: 590,
    });
    expect(validateCanvasGraph(draft.nodes, draft.edges)).toEqual([]);
  });

  it("inserts palette nodes between existing blocks without branching", () => {
    const draft = createDefaultWorkflowCanvas();
    const nextDraft = insertPaletteNodeAfter(
      draft,
      "documents",
      legalBlockPalette[1]!,
      "find_practice",
    );

    expect(nextDraft.nodes.map((node) => node.id)).toEqual([
      "trigger_manual",
      "documents",
      "find_practice",
      "legal_analysis",
      "generation",
      "approval",
      "delivery",
    ]);
    expect(nextDraft.edges.find((edge) => edge.sourceNodeId === "documents")?.targetNodeId).toBe(
      "find_practice",
    );
    expect(validateCanvasGraph(nextDraft.nodes, nextDraft.edges)).toEqual([]);
  });

  it("inserts palette nodes on a selected edge", () => {
    const draft = createDefaultWorkflowCanvas();
    const nextDraft = insertPaletteNodeOnEdge(
      draft,
      "edge_documents_legal_analysis",
      legalBlockPalette[0]!,
      "custom_review",
    );

    expect(nextDraft.nodes.some((node) => node.id === "custom_review")).toBe(true);
    expect(nextDraft.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceNodeId: "documents",
          targetNodeId: "custom_review",
        }),
        expect.objectContaining({
          sourceNodeId: "custom_review",
          targetNodeId: "legal_analysis",
        }),
      ]),
    );
    expect(nextDraft.edges.some((edge) => edge.id === "edge_documents_legal_analysis")).toBe(false);
  });

  it("updates node settings without changing edges", () => {
    const draft = createDefaultWorkflowCanvas();
    const nextDraft = updateCanvasNode(draft, "generation", {
      title: "Проект иска",
      prompt: "Сформируй проект иска с отдельным разделом по рискам.",
      inputBindings: {
        analysis: "$state.analysis",
        template: "$state.templates.claim",
      },
      connectionBindings: {
        storage: "$connections.storage",
      },
    });

    const node = nextDraft.nodes.find((item) => item.id === "generation");

    expect(nextDraft.edges).toEqual(draft.edges);
    expect(node).toEqual(
      expect.objectContaining({
        title: "Проект иска",
        prompt: "Сформируй проект иска с отдельным разделом по рискам.",
        inputBindings: {
          analysis: "$state.analysis",
          template: "$state.templates.claim",
        },
        connectionBindings: {
          storage: "$connections.storage",
        },
      }),
    );
    expect(validateCanvasGraph(nextDraft.nodes, nextDraft.edges)).toEqual([]);
  });

  it("moves one node without changing edges or other positions", () => {
    const draft = createDefaultWorkflowCanvas();
    const originalDocumentsPosition = draft.nodes.find((node) => node.id === "documents")?.position;
    const nextDraft = updateCanvasNodePosition(draft, "generation", {
      x: 860,
      y: 310,
    });

    expect(nextDraft.edges).toEqual(draft.edges);
    expect(nextDraft.nodes.find((node) => node.id === "generation")?.position).toEqual({
      x: 860,
      y: 310,
    });
    expect(nextDraft.nodes.find((node) => node.id === "documents")?.position).toEqual(
      originalDocumentsPosition,
    );
  });

  it("adds and removes composer attachments without duplicates", () => {
    const automation: AutomationComposerAttachment = {
      id: "automation_1",
      required: true,
      title: "Претензия",
      type: "automation",
    };
    const document: AutomationComposerAttachment = {
      id: "document_1",
      required: true,
      title: "Договор",
      type: "document",
    };

    const withAutomation = addComposerAttachment([], automation);
    const deduped = addComposerAttachment(withAutomation, automation);
    const withDocument = addComposerAttachment(deduped, document);

    expect(deduped).toHaveLength(1);
    expect(withDocument).toEqual([automation, document]);
    expect(removeComposerAttachment(withDocument, automation)).toEqual([document]);
  });

  it("marks disconnected nodes as non-blocking warnings", () => {
    const draft = createDefaultWorkflowCanvas();
    const disconnectedDraft: WorkflowCanvasDraft = {
      nodes: [
        ...draft.nodes,
        {
          id: "orphan",
          kind: "document",
          title: "Оторванный блок",
          description: "Не должен быть доступен для запуска.",
          prompt: "Не запускай этот блок без связи с основной цепочкой.",
          position: {
            x: 920,
            y: 160,
          },
          inputBindings: {
            case: "$state.case",
          },
          outputBindings: {
            documents: "$state.orphan",
          },
          connectionBindings: {},
          requiresApproval: false,
          runtimeRequirement: null,
          policyState: "ok",
        },
      ],
      edges: draft.edges,
    };

    const issues = validateCanvasGraph(disconnectedDraft.nodes, disconnectedDraft.edges);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "disconnected_node",
          nodeId: "orphan",
        }),
      ]),
    );
    expect(issues.filter(isBlockingCanvasIssue)).toEqual([]);
  });

  it("allows branching without validation errors", () => {
    const draft = createDefaultWorkflowCanvas();
    const branchedDraft: WorkflowCanvasDraft = {
      nodes: draft.nodes,
      edges: [
        ...draft.edges,
        {
          id: "edge_documents_generation_branch",
          sourceNodeId: "documents",
          targetNodeId: "generation",
          condition: "if_ready",
        },
      ],
    };

    expect(validateCanvasGraph(branchedDraft.nodes, branchedDraft.edges)).toEqual([]);
  });

  it("detects self-loop cycles before connecting", () => {
    const draft = createDefaultWorkflowCanvas();

    expect(
      createsCycleWithEdge(draft.nodes, draft.edges, {
        id: "edge_generation_generation",
        sourceNodeId: "generation",
        targetNodeId: "generation",
        condition: "always",
      }),
    ).toBe(true);
  });

  it("updates and removes edges and nodes", () => {
    const draft = createDefaultWorkflowCanvas();
    const withCondition = updateCanvasEdge(draft, "edge_documents_legal_analysis", {
      condition: "if_documents_ready",
    });
    const withoutEdge = removeCanvasEdge(withCondition, "edge_documents_legal_analysis");
    const withoutNode = removeCanvasNode(withCondition, "generation");

    expect(withCondition.edges.find((edge) => edge.id === "edge_documents_legal_analysis")).toEqual(
      expect.objectContaining({
        condition: "if_documents_ready",
      }),
    );
    expect(withoutEdge.edges.some((edge) => edge.id === "edge_documents_legal_analysis")).toBe(
      false,
    );
    expect(withoutNode.nodes.some((node) => node.id === "generation")).toBe(false);
    expect(withoutNode.edges.some((edge) => edge.sourceNodeId === "generation")).toBe(false);
    expect(withoutNode.edges.some((edge) => edge.targetNodeId === "generation")).toBe(false);
  });

  it("blocks cycles", () => {
    const draft = createDefaultWorkflowCanvas();
    const cyclicDraft: WorkflowCanvasDraft = {
      nodes: draft.nodes,
      edges: [
        ...draft.edges,
        {
          id: "edge_delivery_trigger",
          sourceNodeId: "delivery",
          targetNodeId: "trigger_manual",
          condition: "always",
        },
      ],
    };

    expect(validateCanvasGraph(cyclicDraft.nodes, cyclicDraft.edges)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "cycle_detected",
        }),
      ]),
    );
  });

  it("blocks legal blocks without required inputs", () => {
    const draft = createDefaultWorkflowCanvas();
    const noInputDraft: WorkflowCanvasDraft = {
      nodes: draft.nodes.map((node) =>
        node.id === "generation"
          ? {
              ...node,
              inputBindings: {},
            }
          : node,
      ),
      edges: draft.edges,
    };

    expect(validateCanvasGraph(noInputDraft.nodes, noInputDraft.edges)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_required_input",
          nodeId: "generation",
        }),
      ]),
    );
  });
});
