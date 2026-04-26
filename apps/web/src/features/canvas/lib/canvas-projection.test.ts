import type {
  CanvasPermissions,
  LexFrameWorkflowV2,
  WorkflowEdge,
  WorkflowNode,
} from "@lexframe/contracts";
import { findCanvasBlockDefinition } from "@lexframe/workflow-dsl";
import { describe, expect, it } from "vitest";
import {
  buildNodeBadges,
  connectionToAddEdgeOperation,
  createInverseOperations,
  createPlaceholderNode,
  explainInvalidConnection,
  handleAlias,
  isValidConnection,
  resolveReadOnlyMode,
  toReactFlowNodes,
  workflowToFlowEdges,
  workflowToFlowNodes,
  wouldCreateForbiddenCycle,
} from "./canvas-projection";

describe("canvas projection", () => {
  it("maps workflow nodes into lightweight React Flow data", () => {
    const workflow = makeWorkflow();
    const nodes = toReactFlowNodes(workflow, viewerPermissions, false);

    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.draggable).toBe(false);
    expect(nodes[0]?.data.workflowNodeId).toBe("trigger_manual_start");
    expect(nodes[0]?.data).not.toHaveProperty("workflowNode");
  });

  it("attaches validation summary to projected node data", () => {
    const workflow = {
      ...makeWorkflow(),
      validation: {
        ...makeWorkflow().validation,
        status: "invalid" as const,
        errors_count: 1,
        issues: [
          {
            id: "node:missing",
            severity: "error" as const,
            scope: "node" as const,
            code: "missing",
            title: "Missing",
            message: "Missing config",
            affected_node_id: "end_success",
          },
        ],
      },
    };

    const nodes = toReactFlowNodes(workflow, editorPermissions, false);

    expect(nodes.find((node) => node.id === "end_success")?.data.validation).toMatchObject({
      state: "invalid",
      issueCount: 1,
    });
  });

  it("uses no-code presentation labels when available", () => {
    const workflow = makeWorkflow();
    const nodes = workflowToFlowNodes(workflow, editorPermissions, false, {
      noCodeNodes: [
        {
          node_id: "end_success",
          title: "Сценарий завершён",
          description: "Показывает, что юридическая процедура закончилась.",
          plain_language_type: "Результат сценария",
          category: "results",
          icon: "check",
          status: "configured",
          risk: {
            level: "low",
            label: "Низкий риск",
            reason: "Не выполняет внешних действий.",
            requires_attention: false,
          },
          inputs: [],
          outputs: [],
          badges: ["готово"],
          actions: [],
          approval_required: false,
          external_action: false,
          ai_used: false,
          data_sensitivity: "workspace_internal",
          last_test_status: "not_tested",
          aria_label: "Сценарий завершён.",
          advanced: null,
        },
      ],
    });

    const end = nodes.find((node) => node.id === "end_success");

    expect(end?.data.title).toBe("Сценарий завершён");
    expect(end?.data.subtitle).toBe("Показывает, что юридическая процедура закончилась.");
    expect(end?.data.noCode?.advanced).toBeNull();
  });

  it("creates ADD_EDGE operations from React Flow connections", () => {
    const operation = connectionToAddEdgeOperation({
      source: "a",
      target: "b",
      sourceHandle: "main_output",
      targetHandle: "main_input",
    });

    expect(operation?.operation_type).toBe("ADD_EDGE");
    expect(operation?.operation_payload.edge).toMatchObject({
      edge_type: "control_flow",
      source_node_id: "a",
      target_node_id: "b",
    });
  });

  it("creates legal placeholder nodes for palette and inline add", () => {
    const block = findCanvasBlockDefinition("case_law_search");
    expect(block).not.toBeNull();

    const node = createPlaceholderNode({
      block: block!,
      x: 10,
      y: 20,
    });

    expect(node.id).toContain("case_law_search");
    expect(node.block_code).toBe("case_law_search");
    expect(node.handles.some((handle) => handle.code === "main_input")).toBe(true);
    expect(node.layout).toMatchObject({ x: 10, y: 20 });
  });

  it("explains invalid connections before save", () => {
    const workflow = makeWorkflow();
    const context = {
      workflow,
      nodesById: new Map(workflow.nodes.map((node) => [node.id, node])),
      edges: workflow.edges,
    };

    expect(
      explainInvalidConnection(
        {
          source: "end_success",
          target: "trigger_manual_start",
          sourceHandle: "main_output",
          targetHandle: "main_input",
        },
        context,
      ),
    ).toContain("Конечный блок");
    expect(
      isValidConnection(
        {
          source: "trigger_manual_start",
          target: "end_success",
          sourceHandle: "main_output",
          targetHandle: "main_input",
        },
        context,
      ),
    ).toBe(false);
  });

  it("detects forbidden cycles", () => {
    const workflow = makeWorkflowWithMiddleNode();
    const context = {
      workflow,
      nodesById: new Map(workflow.nodes.map((node) => [node.id, node])),
      edges: workflow.edges,
    };

    expect(wouldCreateForbiddenCycle("end_success", "middle", context)).toBe(true);
  });

  it("builds inverse operations for undo foundation", () => {
    const workflow = makeWorkflow();
    const edge = workflow.edges[0]!;
    const inverse = createInverseOperations(workflow, [
      {
        client_operation_id: "delete_edge",
        operation_type: "DELETE_EDGE",
        operation_payload: { edge_id: edge.id },
      },
    ]);

    expect(inverse).toHaveLength(1);
    expect(inverse[0]).toMatchObject({
      operation_type: "ADD_EDGE",
      operation_payload: { edge },
    });
  });

  it("normalizes legacy and canonical handle aliases", () => {
    expect(handleAlias("out:success")).toBe("main_output");
    expect(handleAlias("in:control")).toBe("main_input");
  });

  it("resolves read-only mode from permissions and locks", () => {
    expect(
      resolveReadOnlyMode({
        workflow: makeWorkflow(),
        permissions: viewerPermissions,
        lockReadOnly: false,
      }).readOnly,
    ).toBe(true);
    expect(
      resolveReadOnlyMode({
        workflow: makeWorkflow(),
        permissions: editorPermissions,
        lockReadOnly: false,
      }).readOnly,
    ).toBe(false);
  });

  it("maps edge variants for React Flow renderers", () => {
    const workflow = makeWorkflow();
    const edges = workflowToFlowEdges(workflow, editorPermissions, false);

    expect(edges[0]?.type).toBe("control");
    expect(edges[0]?.data?.edgeType).toBe("control_flow");
  });

  it("builds risk and issue badges", () => {
    const workflow = makeWorkflow();
    const delivery = {
      ...workflow.nodes[1]!,
      type: "delivery" as const,
      policy: {
        external_action: true,
        approval_required: true,
        risk_level: "critical" as const,
      },
    };
    const badges = buildNodeBadges(delivery, [
      {
        id: "policy",
        severity: "policy_block",
        scope: "node",
        code: "delivery_without_approval",
        title: "Policy",
        message: "Blocked",
        affected_node_id: delivery.id,
      },
    ]);

    expect(badges.map((badge) => badge.type)).toContain("external");
    expect(badges.map((badge) => badge.type)).toContain("error");
  });
});

const viewerPermissions: CanvasPermissions = {
  can_view: true,
  can_edit: false,
  can_publish: false,
  can_test: false,
  can_open_advanced_builder: false,
  can_debug: false,
};

const editorPermissions: CanvasPermissions = {
  ...viewerPermissions,
  can_edit: true,
};

function makeWorkflowWithMiddleNode(): LexFrameWorkflowV2 {
  const workflow = makeWorkflow();
  const middle: WorkflowNode = {
    id: "middle",
    type: "legalAction",
    block_code: "case_law_search",
    display_name: "Найти практику",
    handles: [
      { code: "main_input", label: "Вход", direction: "input" },
      { code: "main_output", label: "Дальше", direction: "output" },
    ],
    inputs: [],
    outputs: [],
    bindings: {},
    input_bindings: [],
    config: {},
    policy: {},
    runtime_mapping: {},
    layout: { x: 0, y: 140 },
  };
  return {
    ...workflow,
    nodes: [workflow.nodes[0]!, middle, workflow.nodes[1]!],
    edges: [
      connect("trigger_manual_start", "middle"),
      connect("middle", "end_success"),
    ],
  };
}

function makeWorkflow(): LexFrameWorkflowV2 {
  const now = "2026-04-24T00:00:00.000Z";
  const trigger: WorkflowNode = {
    id: "trigger_manual_start",
    type: "trigger",
    block_code: "manual_start",
    display_name: "Запуск вручную",
    handles: [{ code: "main_output", label: "Дальше", direction: "output" }],
    inputs: [],
    outputs: [],
    bindings: {},
    input_bindings: [],
    config: {},
    policy: {},
    runtime_mapping: {},
    layout: { x: 0, y: 0 },
  };
  const end: WorkflowNode = {
    id: "end_success",
    type: "end",
    block_code: "end_success",
    display_name: "Завершение",
    handles: [{ code: "main_input", label: "Вход", direction: "input" }],
    inputs: [],
    outputs: [],
    bindings: {},
    input_bindings: [],
    config: {},
    policy: {},
    runtime_mapping: {},
    layout: { x: 0, y: 140 },
  };

  return {
    schema_version: "2.0",
    id: "workflow_test",
    workspace_id: "workspace_test",
    automation_id: "automation_test",
    draft_version_id: "draft_test",
    metadata: {
      title: "Test",
      status: "draft",
      canvas_mode: "guided_vertical",
    },
    inputs: [],
    outputs: [],
    nodes: [trigger, end],
    edges: [connect(trigger.id, end.id)],
    variables: [],
    validation: {
      status: "valid",
      errors_count: 0,
      warnings_count: 0,
      policy_blocks_count: 0,
      issues: [],
      can_save: true,
      can_test: true,
      can_publish: true,
      can_compile: true,
      can_run: true,
      can_sync: true,
    },
    runtime_projection: {
      status: "not_compiled",
      can_compile: false,
      can_run: false,
      warnings: [],
    },
    layout: {
      mode: "guided_vertical",
    },
    created_at: now,
    updated_at: now,
  };
}

function connect(source: string, target: string): WorkflowEdge {
  return {
    id: `${source}:main_output:${target}:main_input`,
    type: "control",
    edge_type: "control_flow",
    source_node_id: source,
    source_handle: "main_output",
    source_port_id: "main_output",
    target_node_id: target,
    target_handle: "main_input",
    target_port_id: "main_input",
    validation_state: "valid",
  };
}
