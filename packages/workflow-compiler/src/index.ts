export type ActivepiecesFlowActionType =
  | 'PIECE'
  | 'CODE'
  | 'LOOP_ON_ITEMS'
  | 'ROUTER';

export type ActivepiecesTriggerType = 'EMPTY' | 'PIECE_TRIGGER';

export interface ActivepiecesFlowVersionTemplate {
  readonly displayName: string;
  readonly valid: boolean;
  readonly schemaVersion: string;
  readonly trigger: ActivepiecesTrigger;
  readonly state?: 'DRAFT' | 'LOCKED';
  readonly connectionIds?: readonly string[];
  readonly notes?: readonly unknown[];
}

export interface ActivepiecesTrigger {
  readonly name: string;
  readonly displayName: string;
  readonly type: ActivepiecesTriggerType;
  readonly settings?: Record<string, unknown>;
  readonly nextAction?: ActivepiecesAction;
}

export interface ActivepiecesAction {
  readonly name: string;
  readonly displayName: string;
  readonly type: ActivepiecesFlowActionType;
  readonly settings: Record<string, unknown>;
  readonly nextAction?: ActivepiecesAction;
  readonly firstLoopAction?: ActivepiecesAction;
  readonly children?: readonly ActivepiecesAction[];
}

export interface LexFrameWorkflowLike {
  readonly id?: string;
  readonly name?: string;
  readonly title?: string;
  readonly version?: string;
  readonly steps?: readonly LexFrameStepLike[];
  readonly metadata?: Record<string, unknown>;
}

export interface LexFrameStepLike {
  readonly id?: string;
  readonly name?: string;
  readonly title?: string;
  readonly type?: string;
  readonly moduleCode?: string;
  readonly input?: Record<string, unknown>;
  readonly config?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

export interface CompileOptions {
  readonly displayName?: string;
  readonly trigger?: ActivepiecesTrigger;
  readonly schemaVersion?: string;
  readonly state?: 'DRAFT' | 'LOCKED';
}

export interface ReverseSyncProjection {
  readonly displayName: string;
  readonly schemaVersion: string;
  readonly triggerType: ActivepiecesTriggerType;
  readonly steps: readonly RuntimeProjectionStep[];
  readonly containsExternalAdvancedStep: boolean;
  readonly warnings: readonly string[];
}

export interface RuntimeProjectionStep {
  readonly id: string;
  readonly displayName: string;
  readonly activepiecesType: string;
  readonly lexFrameType: string;
  readonly requiredPiece: string | null;
  readonly raw: ActivepiecesAction;
}

export interface FlowDiffEntry {
  readonly kind:
    | 'added_step'
    | 'removed_step'
    | 'changed_action'
    | 'changed_connection'
    | 'changed_external_delivery'
    | 'new_forbidden_piece'
    | 'changed_branch_or_loop';
  readonly stepId: string;
  readonly before?: RuntimeProjectionStep;
  readonly after?: RuntimeProjectionStep;
}

const DEFAULT_SCHEMA_VERSION = '20';

export function compileLexFrameWorkflowToActivepiecesFlow(
  workflow: LexFrameWorkflowLike,
  options: CompileOptions = {},
): ActivepiecesFlowVersionTemplate {
  const trigger = options.trigger ?? createManualTrigger();
  const actions = (workflow.steps ?? []).map((step, index) =>
    compileStep(step, index),
  );
  const chainedTrigger = {
    ...trigger,
    nextAction: chainActions(actions),
  };

  return {
    displayName: options.displayName ?? workflow.title ?? workflow.name ?? 'LexFrame Automation',
    valid: true,
    schemaVersion: options.schemaVersion ?? DEFAULT_SCHEMA_VERSION,
    state: options.state ?? 'DRAFT',
    connectionIds: extractConnectionIds(actions),
    trigger: chainedTrigger,
    notes: [],
  };
}

export function reverseSyncActivepiecesFlowToLexFrameProjection(
  flow: ActivepiecesFlowVersionTemplate,
): ReverseSyncProjection {
  const warnings: string[] = [];
  const steps: RuntimeProjectionStep[] = [];

  for (const action of flattenActions(flow.trigger.nextAction)) {
    const pieceName = extractPieceName(action);
    const lexFrameType = mapActivepiecesActionToLexFrameType(action);
    if (lexFrameType === 'external_advanced_step') {
      warnings.push(
        `Preserved unsupported Activepieces action ${action.name} as external_advanced_step.`,
      );
    }
    steps.push({
      id: action.name,
      displayName: action.displayName,
      activepiecesType: action.type,
      lexFrameType,
      requiredPiece: pieceName,
      raw: action,
    });
  }

  return {
    displayName: flow.displayName,
    schemaVersion: flow.schemaVersion,
    triggerType: flow.trigger.type,
    steps,
    containsExternalAdvancedStep: steps.some(
      (step) => step.lexFrameType === 'external_advanced_step',
    ),
    warnings,
  };
}

export function diffActivepiecesProjection(
  before: ReverseSyncProjection,
  after: ReverseSyncProjection,
): readonly FlowDiffEntry[] {
  const entries: FlowDiffEntry[] = [];
  const beforeById = new Map(before.steps.map((step) => [step.id, step]));
  const afterById = new Map(after.steps.map((step) => [step.id, step]));

  for (const [stepId, afterStep] of afterById) {
    const beforeStep = beforeById.get(stepId);
    if (!beforeStep) {
      entries.push({ kind: 'added_step', stepId, after: afterStep });
      if (isForbiddenPiece(afterStep.requiredPiece)) {
        entries.push({ kind: 'new_forbidden_piece', stepId, after: afterStep });
      }
      continue;
    }

    if (
      beforeStep.activepiecesType !== afterStep.activepiecesType ||
      beforeStep.requiredPiece !== afterStep.requiredPiece
    ) {
      entries.push({
        kind: 'changed_action',
        stepId,
        before: beforeStep,
        after: afterStep,
      });
    }

    if (hasChangedConnection(beforeStep.raw, afterStep.raw)) {
      entries.push({
        kind: 'changed_connection',
        stepId,
        before: beforeStep,
        after: afterStep,
      });
    }

    if (hasExternalDelivery(afterStep.requiredPiece) && beforeStep.raw !== afterStep.raw) {
      entries.push({
        kind: 'changed_external_delivery',
        stepId,
        before: beforeStep,
        after: afterStep,
      });
    }

    if (
      beforeStep.activepiecesType !== afterStep.activepiecesType &&
      (afterStep.activepiecesType === 'ROUTER' || afterStep.activepiecesType === 'LOOP_ON_ITEMS')
    ) {
      entries.push({
        kind: 'changed_branch_or_loop',
        stepId,
        before: beforeStep,
        after: afterStep,
      });
    }
  }

  for (const [stepId, beforeStep] of beforeById) {
    if (!afterById.has(stepId)) {
      entries.push({ kind: 'removed_step', stepId, before: beforeStep });
    }
  }

  return entries;
}

function compileStep(
  step: LexFrameStepLike,
  index: number,
): ActivepiecesAction {
  const activepiecesOverride = isRecord(step.metadata?.activepieces)
    ? step.metadata.activepieces
    : null;

  if (activepiecesOverride && typeof activepiecesOverride.type === 'string') {
    return {
      name: step.id ?? `step_${index + 1}`,
      displayName: step.title ?? step.name ?? `Step ${index + 1}`,
      type: activepiecesOverride.type as ActivepiecesFlowActionType,
      settings: isRecord(activepiecesOverride.settings)
        ? activepiecesOverride.settings
        : {},
    };
  }

  return {
    name: step.id ?? `step_${index + 1}`,
    displayName: step.title ?? step.name ?? `Step ${index + 1}`,
    type: 'PIECE',
    settings: {
      pieceName: inferPieceName(step),
      pieceVersion: 'latest',
      actionName: inferActionName(step),
      input: step.input ?? step.config ?? {},
      propertySettings: {},
      errorHandlingOptions: {
        continueOnFailure: false,
        retryOnFailure: true,
      },
    },
  };
}

function createManualTrigger(): ActivepiecesTrigger {
  return {
    name: 'trigger',
    displayName: 'Manual Trigger',
    type: 'PIECE_TRIGGER',
    settings: {
      pieceName: '@activepieces/piece-manual-trigger',
      pieceVersion: 'latest',
      triggerName: 'manual_trigger',
      input: {},
      propertySettings: {},
      sampleData: {},
    },
  };
}

function chainActions(
  actions: readonly ActivepiecesAction[],
): ActivepiecesAction | undefined {
  let nextAction: ActivepiecesAction | undefined;
  for (const action of [...actions].reverse()) {
    nextAction = nextAction ? { ...action, nextAction } : action;
  }
  return nextAction;
}

function flattenActions(
  action: ActivepiecesAction | undefined,
): readonly ActivepiecesAction[] {
  if (!action) {
    return [];
  }

  return [
    action,
    ...flattenActions(action.firstLoopAction),
    ...(action.children ?? []).flatMap((child) => flattenActions(child)),
    ...flattenActions(action.nextAction),
  ];
}

function inferPieceName(step: LexFrameStepLike): string {
  const activepieces = isRecord(step.metadata?.activepieces)
    ? step.metadata.activepieces
    : {};
  if (typeof activepieces.pieceName === 'string') {
    return activepieces.pieceName;
  }
  const moduleCode = step.moduleCode ?? step.type ?? '';
  if (moduleCode.startsWith('legal')) {
    return '@lexframe/piece-legal';
  }
  if (moduleCode.startsWith('document')) {
    return '@lexframe/piece-document';
  }
  if (moduleCode.startsWith('delivery')) {
    return '@lexframe/piece-delivery';
  }
  if (moduleCode.startsWith('workflow')) {
    return '@lexframe/piece-callback';
  }
  return '@lexframe/piece-gateway';
}

function inferActionName(step: LexFrameStepLike): string {
  const activepieces = isRecord(step.metadata?.activepieces)
    ? step.metadata.activepieces
    : {};
  if (typeof activepieces.actionName === 'string') {
    return activepieces.actionName;
  }
  return step.moduleCode ?? step.type ?? 'execute';
}

function extractConnectionIds(
  actions: readonly ActivepiecesAction[],
): readonly string[] {
  const ids = new Set<string>();
  for (const action of actions) {
    visit(action.settings, (key, value) => {
      if ((key === 'connectionId' || key === 'connectionName') && typeof value === 'string') {
        ids.add(value);
      }
    });
  }
  return [...ids].sort();
}

function extractPieceName(action: ActivepiecesAction): string | null {
  const pieceName = action.settings.pieceName;
  return typeof pieceName === 'string' ? pieceName : null;
}

function mapActivepiecesActionToLexFrameType(
  action: ActivepiecesAction,
): string {
  if (action.type === 'PIECE') {
    return 'piece_step';
  }
  if (action.type === 'CODE') {
    return 'code_step';
  }
  if (action.type === 'LOOP_ON_ITEMS') {
    return 'loop_step';
  }
  if (action.type === 'ROUTER') {
    return 'router_step';
  }
  return 'external_advanced_step';
}

function isForbiddenPiece(pieceName: string | null): boolean {
  return Boolean(pieceName && /supabase|service-role|internal-network/.test(pieceName));
}

function hasExternalDelivery(pieceName: string | null): boolean {
  return Boolean(pieceName && /gmail|slack|telegram|twilio|sendgrid|smtp|whatsapp/.test(pieceName));
}

function hasChangedConnection(
  before: ActivepiecesAction,
  after: ActivepiecesAction,
): boolean {
  return JSON.stringify(extractConnections(before.settings)) !==
    JSON.stringify(extractConnections(after.settings));
}

function extractConnections(settings: Record<string, unknown>): readonly string[] {
  const values = new Set<string>();
  visit(settings, (key, value) => {
    if ((key === 'connectionId' || key === 'connectionName') && typeof value === 'string') {
      values.add(value);
    }
  });
  return [...values].sort();
}

function visit(
  value: unknown,
  visitor: (key: string, current: unknown) => void,
  key = '',
): void {
  visitor(key, value);
  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item, visitor);
    }
    return;
  }
  if (isRecord(value)) {
    for (const [childKey, childValue] of Object.entries(value)) {
      visit(childValue, visitor, childKey);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
