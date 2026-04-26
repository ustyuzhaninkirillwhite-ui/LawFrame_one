import type {
  RuntimeGraph,
  RuntimeGraphEdge,
  RuntimeGraphNode,
  RuntimeGraphNote,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { stableStringify } from '../canvas/canvas-canonical';

interface ParseInput {
  readonly snapshot: unknown;
  readonly flowId: string | null;
  readonly projectId: string | null;
  readonly flowVersionId: string | null;
}

@Injectable()
export class ActivepiecesFlowParser {
  parse(input: ParseInput): RuntimeGraph {
    const root = isRecord(input.snapshot) ? input.snapshot : {};
    const version = isRecord(root.version) ? root.version : root;
    const trigger = findTrigger(root, version);
    const rawSteps = collectRuntimeSteps(root, version, trigger);
    const notes = collectNotes(root, version);
    const nodes = rawSteps.map((step, index) =>
      toRuntimeGraphNode(step, index),
    );
    const triggerNode = trigger ? toRuntimeGraphNode(trigger, -1) : null;
    const orderedNodes = [
      ...(triggerNode ? [triggerNode] : []),
      ...nodes.filter(
        (node) => node.runtimeNodeId !== triggerNode?.runtimeNodeId,
      ),
    ];

    return {
      source: 'activepieces',
      flowId: stringOr(
        root.id,
        stringOr(root.flowId, input.flowId ?? 'unknown'),
      ),
      flowVersionId:
        input.flowVersionId ??
        nullableString(root.versionId) ??
        nullableString(root.version_id) ??
        nullableString(root.publishedVersionId) ??
        nullableString(version.id),
      displayName: stringOr(
        root.displayName,
        stringOr(root.display_name, 'Activepieces flow'),
      ),
      trigger: triggerNode,
      nodes: orderedNodes,
      edges: buildEdges(orderedNodes, root, version),
      notes,
      metadata: {
        activepiecesProjectId:
          input.projectId ??
          nullableString(root.projectId) ??
          nullableString(root.project_id),
        status: nullableString(root.status),
        operationStatus:
          nullableString(root.operationStatus) ??
          nullableString(root.operation_status),
        schemaVersion:
          nullableString(root.schemaVersion) ??
          nullableString(root.schema_version) ??
          nullableString(version.schemaVersion),
        connectionIds: collectConnectionRefs(orderedNodes),
        publishedVersionId:
          nullableString(root.publishedVersionId) ??
          nullableString(root.published_version_id),
      },
    };
  }
}

function findTrigger(
  root: Record<string, unknown>,
  version: Record<string, unknown>,
) {
  const candidate =
    root.trigger ??
    version.trigger ??
    (isRecord(root.flowVersion) ? root.flowVersion.trigger : null);
  return isStep(candidate) ? candidate : null;
}

function collectRuntimeSteps(
  root: Record<string, unknown>,
  version: Record<string, unknown>,
  trigger: Record<string, unknown> | null,
) {
  const steps = new Map<string, Record<string, unknown>>();
  const add = (candidate: unknown) => {
    if (!isStep(candidate)) {
      return;
    }
    if (trigger && candidate === trigger) {
      return;
    }
    const id = stepId(candidate);
    if (!steps.has(id)) {
      steps.set(id, candidate);
    }
  };

  for (const source of [
    root.actions,
    version.actions,
    version.steps,
    root.steps,
    isRecord(root.flowVersion) ? root.flowVersion.actions : null,
  ]) {
    if (Array.isArray(source)) {
      for (const item of source) {
        add(item);
      }
    }
  }

  const visited = new WeakSet<object>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const child of value) {
        visit(child);
      }
      return;
    }
    if (!isRecord(value) || visited.has(value)) {
      return;
    }
    visited.add(value);
    add(value);
    for (const key of [
      'nextAction',
      'next_action',
      'firstLoopAction',
      'first_loop_action',
      'children',
      'steps',
      'branches',
      'actions',
      'onFailureAction',
      'on_failure_action',
    ]) {
      visit(value[key]);
    }
  };
  visit(root);
  return [...steps.values()].sort((left, right) => {
    const leftIndex = numberOr(left.orderIndex, numberOr(left.order_index, 0));
    const rightIndex = numberOr(
      right.orderIndex,
      numberOr(right.order_index, 0),
    );
    return leftIndex - rightIndex || stepId(left).localeCompare(stepId(right));
  });
}

function collectNotes(
  root: Record<string, unknown>,
  version: Record<string, unknown>,
): readonly RuntimeGraphNote[] {
  const notes: RuntimeGraphNote[] = [];
  for (const source of [root.notes, version.notes]) {
    if (!Array.isArray(source)) {
      continue;
    }
    for (const item of source) {
      if (!isRecord(item)) {
        continue;
      }
      notes.push({
        id: stringOr(item.id, stableHash(item).slice(0, 12)),
        text: stringOr(item.text, stringOr(item.content, 'Runtime note')),
        raw: sanitizeValue(item),
      });
    }
  }
  return notes;
}

function toRuntimeGraphNode(
  step: Record<string, unknown>,
  index: number,
): RuntimeGraphNode {
  const settings = isRecord(step.settings) ? step.settings : {};
  const input = isRecord(settings.input)
    ? settings.input
    : isRecord(step.input)
      ? step.input
      : {};
  const lexframeInput = isRecord(input.lexframe) ? input.lexframe : {};
  const pieceName =
    nullableString(step.pieceName) ??
    nullableString(step.piece_name) ??
    nullableString(settings.pieceName) ??
    nullableString(settings.piece_name) ??
    nullableString(lexframeInput.pieceName) ??
    nullableString(lexframeInput.piece_name);
  const actionName =
    nullableString(step.actionName) ??
    nullableString(step.action_name) ??
    nullableString(settings.actionName) ??
    nullableString(settings.action_name) ??
    nullableString(lexframeInput.actionName) ??
    nullableString(lexframeInput.action_name);
  const triggerName =
    nullableString(step.triggerName) ??
    nullableString(step.trigger_name) ??
    nullableString(settings.triggerName) ??
    nullableString(settings.trigger_name) ??
    nullableString(lexframeInput.triggerName) ??
    nullableString(lexframeInput.trigger_name);
  const metadata = isRecord(step.metadata) ? sanitizeValue(step.metadata) : {};

  return {
    runtimeNodeId: stepId(step),
    name: stringOr(step.name, stringOr(step.id, `runtime_${index + 1}`)),
    displayName: stringOr(
      step.displayName,
      stringOr(step.display_name, 'Runtime step'),
    ),
    runtimeType: runtimeType(step, pieceName, actionName, triggerName),
    pieceName,
    pieceVersion:
      nullableString(step.pieceVersion) ??
      nullableString(step.piece_version) ??
      nullableString(settings.pieceVersion) ??
      nullableString(settings.piece_version),
    actionName,
    triggerName,
    input: sanitizeInput(input),
    authRef: connectionRef(settings) ?? connectionRef(input),
    parentRuntimeNodeId:
      nullableString(step.parentStep) ??
      nullableString(step.parent_step) ??
      nullableString(step.parentRuntimeNodeId),
    branchName:
      nullableString(step.branchName) ??
      nullableString(step.branch_name) ??
      nullableString(step.branch),
    orderIndex: index,
    metadata: isRecord(metadata) ? metadata : {},
    raw: sanitizeValue(step),
  };
}

function runtimeType(
  step: Record<string, unknown>,
  pieceName: string | null,
  actionName: string | null,
  triggerName: string | null,
): RuntimeGraphNode['runtimeType'] {
  const raw = (nullableString(step.type) ?? '').toUpperCase();
  const piece = String(pieceName ?? '').toLowerCase();
  if (raw === 'CODE' && piece.startsWith('@lexframe/')) {
    return triggerName ? 'PIECE_TRIGGER' : 'PIECE_ACTION';
  }
  if (raw === 'PIECE_TRIGGER' || triggerName) {
    return 'PIECE_TRIGGER';
  }
  if (raw === 'CODE' || piece.includes('code')) {
    return 'CODE';
  }
  if (raw === 'ROUTER') {
    return 'ROUTER';
  }
  if (raw === 'BRANCH') {
    return 'BRANCH';
  }
  if (raw === 'LOOP' || raw === 'LOOP_ON_ITEMS') {
    return 'LOOP_ON_ITEMS';
  }
  if (raw === 'NOTE') {
    return 'NOTE';
  }
  if (raw === 'PIECE' || raw === 'PIECE_ACTION' || actionName || pieceName) {
    return 'PIECE_ACTION';
  }
  return 'UNKNOWN';
}

function buildEdges(
  nodes: readonly RuntimeGraphNode[],
  root: Record<string, unknown>,
  version: Record<string, unknown>,
): readonly RuntimeGraphEdge[] {
  const byName = new Map(nodes.map((node) => [node.name, node.runtimeNodeId]));
  const edges: RuntimeGraphEdge[] = [];
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const source = nodes[index];
    const target = nodes[index + 1];
    if (!source || !target) {
      continue;
    }
    edges.push({
      sourceRuntimeNodeId: source.runtimeNodeId,
      targetRuntimeNodeId: target.runtimeNodeId,
      edgeType: 'control_flow',
    });
  }

  const addExplicitEdge = (
    source: unknown,
    target: unknown,
    edgeType: RuntimeGraphEdge['edgeType'],
    condition?: unknown,
  ) => {
    const sourceId =
      typeof source === 'string' ? (byName.get(source) ?? source) : null;
    const targetId =
      typeof target === 'string' ? (byName.get(target) ?? target) : null;
    if (!sourceId || !targetId || sourceId === targetId) {
      return;
    }
    if (
      edges.some(
        (edge) =>
          edge.sourceRuntimeNodeId === sourceId &&
          edge.targetRuntimeNodeId === targetId &&
          edge.edgeType === edgeType,
      )
    ) {
      return;
    }
    edges.push({
      sourceRuntimeNodeId: sourceId,
      targetRuntimeNodeId: targetId,
      edgeType,
      condition,
    });
  };

  for (const source of [
    root.edges,
    version.edges,
    root.branches,
    version.branches,
  ]) {
    if (!Array.isArray(source)) {
      continue;
    }
    for (const item of source) {
      if (!isRecord(item)) {
        continue;
      }
      addExplicitEdge(
        item.source ?? item.from ?? item.sourceStep,
        item.target ?? item.to ?? item.targetStep,
        (nullableString(item.type) ?? '').toLowerCase().includes('branch')
          ? 'branch_true'
          : 'control_flow',
        sanitizeValue(item.condition),
      );
    }
  }
  return edges;
}

function collectConnectionRefs(nodes: readonly RuntimeGraphNode[]) {
  return [
    ...new Set(
      nodes
        .map((node) => node.authRef)
        .filter(
          (ref): ref is string => typeof ref === 'string' && ref.length > 0,
        ),
    ),
  ].sort();
}

function isStep(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }
  const settings = isRecord(value.settings) ? value.settings : {};
  return (
    typeof value.name === 'string' ||
    typeof value.id === 'string' ||
    typeof settings.pieceName === 'string' ||
    typeof settings.actionName === 'string' ||
    typeof settings.triggerName === 'string' ||
    typeof value.type === 'string'
  );
}

function stepId(step: Record<string, unknown>) {
  return stringOr(step.id, stringOr(step.name, stableHash(step).slice(0, 16)));
}

function sanitizeInput(value: Record<string, unknown>) {
  const sanitized = sanitizeValue(value);
  return isRecord(sanitized) ? sanitized : {};
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (!isRecord(value)) {
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (isSecretKey(key)) {
      output[key] = '[redacted]';
      continue;
    }
    if (isConnectionKey(key) && typeof child === 'string') {
      output[key] = `connection:${stableHash(child).slice(0, 12)}`;
      continue;
    }
    output[key] = sanitizeValue(child);
  }
  return output;
}

function connectionRef(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    if (isConnectionKey(key) && typeof child === 'string' && child.length > 0) {
      return `connection:${stableHash(child).slice(0, 12)}`;
    }
  }
  return null;
}

function isSecretKey(key: string) {
  const lower = key.toLowerCase();
  return (
    lower.includes('secret') ||
    lower.includes('token') ||
    lower.includes('apikey') ||
    lower.includes('api_key') ||
    lower.includes('password') ||
    lower.includes('jwt') ||
    lower.includes('bearer')
  );
}

function isConnectionKey(key: string) {
  const lower = key.toLowerCase();
  return (
    lower === 'auth' ||
    lower === 'connection' ||
    lower === 'connectionid' ||
    lower === 'connection_id' ||
    lower.endsWith('connectionid') ||
    lower.endsWith('connection_id')
  );
}

function stableHash(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
