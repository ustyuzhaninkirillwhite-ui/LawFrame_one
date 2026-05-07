import type {
  CanvasValidationSummary,
  LexFrameWorkflowV2,
  WorkflowNode,
} from '@lexframe/contracts';
import {
  canonicalizeWorkflowV2,
  defaultSecretsPolicy,
  defaultWorkflowPolicy,
} from '../canvas/canvas-canonical';
import {
  applyGuidedLayout,
  createWorkflowEdge,
  createWorkflowNode,
} from '../canvas/canvas-model';
import { AppHttpException } from '../../common/errors/app-http.exception';

const LEGACY_WORKFLOW_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const LEGACY_MODULE_BLOCK_CODES: Readonly<Record<string, string>> = {
  'legal.case-search': 'case_law_search',
  'legal.material-analysis': 'case_material_analysis',
  'document.pretrial-draft': 'pretrial_claim_draft',
  'document.structure-check': 'document_structure_check',
  'workflow.internal-approval': 'human_approval',
  'delivery.email-draft': 'email_delivery',
};

export interface CompileSourceWorkflowContext {
  readonly workspaceId: string;
  readonly automationId: string;
  readonly draftId: string;
  readonly title: string;
}

export function normalizeCompileSourceWorkflowV2(
  value: unknown,
  context: CompileSourceWorkflowContext,
): LexFrameWorkflowV2 {
  if (isCanonicalWorkflowV2(value)) {
    return canonicalizeWorkflowV2({
      ...value,
      workspace_id: context.workspaceId,
      automation_id: context.automationId,
      draft_version_id: value.draft_version_id ?? context.draftId,
      published_version_id: value.published_version_id ?? null,
      metadata: {
        ...value.metadata,
        status: value.metadata?.status ?? 'draft',
      },
    });
  }

  if (isLegacyTemplateWorkflow(value)) {
    return buildLegacyTemplateWorkflow(value, context);
  }

  throw new AppHttpException(
    'WORKFLOW_COMPILER_BLOCKED',
    422,
    'Workflow compiler requires canonical LexFrameWorkflowV2.',
  );
}

function buildLegacyTemplateWorkflow(
  workflow: Record<string, unknown>,
  context: CompileSourceWorkflowContext,
): LexFrameWorkflowV2 {
  const nodes = buildLegacyNodes(workflow);
  const edges = buildLegacyEdges(workflow, nodes);
  const converted: LexFrameWorkflowV2 = {
    schema_version: '2.0',
    id: `canvas_${context.automationId}`,
    workspace_id: context.workspaceId,
    project_id: null,
    automation_id: context.automationId,
    draft_version_id: context.draftId,
    published_version_id: null,
    revision_counter: 0,
    metadata: {
      title: context.title,
      description:
        'LexFrame Canvas v2 workflow converted from a legacy template.',
      status: 'draft',
      canvas_mode: 'guided_vertical',
    },
    workflow_inputs: [],
    workflow_outputs: [],
    inputs: [],
    outputs: [],
    nodes,
    edges,
    variables: [],
    secrets_policy: defaultSecretsPolicy(),
    data_contracts: {},
    policies: defaultWorkflowPolicy(),
    validation_state: emptyValidation(),
    validation: emptyValidation(),
    runtime_projection: {
      status: 'not_compiled',
      can_compile: false,
      can_run: false,
      activepieces_flow_id: null,
      sync_hash: null,
      warnings: [
        'Converted from a legacy automation template before runtime compilation.',
      ],
    },
    canvas_layout: {
      layout_version: '1.0',
      mode: 'guided_vertical',
      updated_at: LEGACY_WORKFLOW_TIMESTAMP,
      nodes: Object.fromEntries(
        nodes.map((node) => [node.id, node.canvas ?? node.layout]),
      ),
    },
    layout: {
      mode: 'guided_vertical',
      updated_at: LEGACY_WORKFLOW_TIMESTAMP,
    },
    created_at: LEGACY_WORKFLOW_TIMESTAMP,
    updated_at: LEGACY_WORKFLOW_TIMESTAMP,
  };

  return canonicalizeWorkflowV2(applyGuidedLayout(converted));
}

function buildLegacyNodes(
  workflow: Record<string, unknown>,
): readonly WorkflowNode[] {
  const trigger = createWorkflowNode({
    id: 'trigger_manual_start',
    type: 'trigger',
    blockCode: 'manual_start',
    displayName: 'Manual start',
    description: 'Manual workflow start.',
    triggerKind: 'manual_start',
    x: 160,
    y: 60,
  });
  const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
  const stepNodes: WorkflowNode[] = [];
  steps.forEach((candidate, index) => {
    if (!isRecord(candidate)) {
      return;
    }
    const stepId = stringValue(candidate.stepId) ?? stringValue(candidate.id);
    const moduleCode = stringValue(candidate.moduleCode);
    if (!stepId || !moduleCode) {
      return;
    }
    if (requiresApprovalBeforeStep(candidate, moduleCode)) {
      stepNodes.push(
        withConfig(
          createWorkflowNode({
            id: approvalNodeId(stepId),
            type: 'approval',
            blockCode: 'human_approval',
            displayName: `Approve ${stringValue(candidate.title) ?? stepId}`,
            description:
              'Legacy template approval gate before external delivery.',
            moduleCode: 'workflow.internal-approval',
            x: 160,
            y: 210 + index * 150,
          }),
          {
            reason: 'External delivery approval required by legacy template.',
          },
        ),
      );
    }
    stepNodes.push(
      withLegacyRuntimeConfig(
        createWorkflowNode({
          id: stepId,
          type: nodeTypeForStep(candidate, moduleCode),
          blockCode: blockCodeForLegacyModule(moduleCode),
          displayName:
            stringValue(candidate.title) ??
            stringValue(candidate.name) ??
            `Step ${index + 1}`,
          description: stringValue(candidate.description),
          moduleCode,
          x: 160,
          y: 210 + index * 150,
        }),
        moduleCode,
      ),
    );
  });
  const end = createWorkflowNode({
    id: 'end_success',
    type: 'end',
    blockCode: 'end_success',
    displayName: 'Workflow completed',
    description: 'Explicit workflow completion result.',
    x: 160,
    y: 210 + stepNodes.length * 150,
  });

  return [trigger, ...stepNodes, end];
}

function buildLegacyEdges(
  workflow: Record<string, unknown>,
  nodes: readonly WorkflowNode[],
) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const approvalByTarget = new Map<string, WorkflowNode>();
  for (const node of nodes) {
    if (node.type !== 'approval' || !node.id.startsWith('approval_before_')) {
      continue;
    }
    approvalByTarget.set(node.id.slice('approval_before_'.length), node);
  }
  const stepNodeIds = nodes
    .filter(
      (node) =>
        node.type !== 'trigger' && node.type !== 'end' && node.type !== 'note',
    )
    .map((node) => node.id);

  if (stepNodeIds.length === 0) {
    return [
      createWorkflowEdge({
        source: 'trigger_manual_start',
        target: 'end_success',
      }),
    ];
  }

  const transitionEdges = Array.isArray(workflow.transitions)
    ? workflow.transitions
        .map((candidate) => {
          if (!isRecord(candidate)) {
            return null;
          }
          const from = stringValue(candidate.from);
          const to = stringValue(candidate.to);
          if (!from || !to) {
            return null;
          }
          return createLegacyEdgeFromIds({
            sourceId: from,
            targetId: to,
            nodesById,
            approvalByTarget,
            label: stringValue(candidate.condition),
            condition: stringValue(candidate.condition),
          });
        })
        .filter((edge) => edge !== null)
    : [];

  if (transitionEdges.length > 0) {
    const approvalEdges = [...approvalByTarget.entries()]
      .map(([targetId, approvalNode]) =>
        createLegacyEdgeFromIds({
          sourceId: approvalNode.id,
          targetId,
          nodesById,
          approvalByTarget: new Map(),
        }),
      )
      .filter((edge) => edge !== null);
    const internalEdges = [...transitionEdges, ...approvalEdges];
    const incoming = new Set(internalEdges.map((edge) => edge.target_node_id));
    const outgoing = new Set(internalEdges.map((edge) => edge.source_node_id));
    return [
      createLegacyEdgeFromIds({
        sourceId: 'trigger_manual_start',
        targetId:
          stepNodeIds.find((id) => !incoming.has(id)) ?? stepNodeIds[0]!,
        nodesById,
        approvalByTarget,
      }),
      ...internalEdges,
      createLegacyEdgeFromIds({
        sourceId:
          [...stepNodeIds].reverse().find((id) => !outgoing.has(id)) ??
          stepNodeIds[stepNodeIds.length - 1]!,
        targetId: 'end_success',
        nodesById,
        approvalByTarget,
      }),
    ].filter((edge) => edge !== null);
  }

  const edges = [];
  let previous = nodesById.get('trigger_manual_start')!;
  for (const stepId of stepNodeIds) {
    const next = nodesById.get(stepId);
    if (next) {
      edges.push(createLegacyEdge(previous, next));
      previous = next;
    }
  }
  edges.push(createLegacyEdge(previous, nodesById.get('end_success')!));
  return edges;
}

function createLegacyEdgeFromIds(input: {
  readonly sourceId: string;
  readonly targetId: string;
  readonly nodesById: ReadonlyMap<string, WorkflowNode>;
  readonly approvalByTarget: ReadonlyMap<string, WorkflowNode>;
  readonly label?: string | null;
  readonly condition?: string | null;
}) {
  const source = input.nodesById.get(input.sourceId);
  const redirectedTarget =
    input.approvalByTarget.get(input.targetId) ??
    input.nodesById.get(input.targetId);
  if (!source || !redirectedTarget || source.id === redirectedTarget.id) {
    return null;
  }
  return createLegacyEdge(source, redirectedTarget, {
    label: input.label,
    condition: input.condition,
  });
}

function createLegacyEdge(
  source: WorkflowNode,
  target: WorkflowNode,
  options: {
    readonly label?: string | null;
    readonly condition?: string | null;
  } = {},
) {
  if (source.type === 'approval') {
    return createWorkflowEdge({
      source: source.id,
      target: target.id,
      sourceHandle: 'approved',
      type: 'approval',
      label: options.label,
      condition: options.condition,
    });
  }
  if (source.type === 'delivery') {
    return createWorkflowEdge({
      source: source.id,
      target: target.id,
      sourceHandle: 'sent',
      label: options.label,
      condition: options.condition,
    });
  }
  return createWorkflowEdge({
    source: source.id,
    target: target.id,
    label: options.label,
    condition: options.condition,
  });
}

function isCanonicalWorkflowV2(value: unknown): value is LexFrameWorkflowV2 {
  return (
    isRecord(value) &&
    value.schema_version === '2.0' &&
    Array.isArray(value.nodes) &&
    Array.isArray(value.edges)
  );
}

function isLegacyTemplateWorkflow(
  value: unknown,
): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    Array.isArray(value.steps) &&
    value.steps.every(
      (step) =>
        isRecord(step) &&
        typeof (step.stepId ?? step.id) === 'string' &&
        typeof step.moduleCode === 'string',
    )
  );
}

function nodeTypeForStep(
  candidate: Record<string, unknown>,
  moduleCode: string,
): WorkflowNode['type'] {
  const kind = stringValue(candidate.kind);
  if (kind === 'deliver' || moduleCode.startsWith('delivery.')) {
    return 'delivery';
  }
  if (moduleCode.includes('approval')) {
    return 'approval';
  }
  if (moduleCode.startsWith('ai.')) {
    return 'aiAction';
  }
  return 'legalAction';
}

function requiresApprovalBeforeStep(
  candidate: Record<string, unknown>,
  moduleCode: string,
) {
  return (
    (candidate.requiresApproval === true ||
      moduleCode.startsWith('delivery.')) &&
    nodeTypeForStep(candidate, moduleCode) === 'delivery'
  );
}

function approvalNodeId(stepId: string) {
  return `approval_before_${stepId}`;
}

function blockCodeForLegacyModule(moduleCode: string) {
  return LEGACY_MODULE_BLOCK_CODES[moduleCode] ?? undefined;
}

function withLegacyRuntimeConfig(
  node: WorkflowNode,
  moduleCode: string,
): WorkflowNode {
  if (
    node.type === 'delivery' &&
    blockCodeForLegacyModule(moduleCode) === 'email_delivery'
  ) {
    return withConfig(node, {
      connection_type: 'email_provider',
      connection_id: 'local-integrated-delivery-webhook',
    });
  }
  return node;
}

function withConfig(
  node: WorkflowNode,
  config: Record<string, unknown>,
): WorkflowNode {
  return {
    ...node,
    config: {
      ...node.config,
      ...config,
    },
  };
}

function emptyValidation(): CanvasValidationSummary {
  return {
    status: 'valid',
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
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
