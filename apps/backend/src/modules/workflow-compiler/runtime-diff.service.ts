import type { CompileIssue, RuntimeDriftStatus } from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import type { RuntimeBindingRow } from './workflow-compiler.types';

@Injectable()
export class RuntimeDiffService {
  detect(input: {
    readonly binding: RuntimeBindingRow | null;
    readonly currentRuntimeHash: string | null;
    readonly currentSourceWorkflowHash: string | null;
    readonly snapshot: unknown;
  }): {
    readonly status: RuntimeDriftStatus;
    readonly issues: readonly CompileIssue[];
  } {
    if (!input.binding || !input.binding.external_flow_id) {
      return { status: 'importable', issues: [] };
    }

    const unsafe = detectUnsafeRuntimeChanges(input.snapshot);
    if (unsafe.length > 0) {
      return {
        status: unsafeStatus(unsafe[0]?.code),
        issues: unsafe,
      };
    }

    const lastSyncedHash = input.binding.last_synced_hash;
    if (
      input.currentRuntimeHash &&
      lastSyncedHash &&
      input.currentRuntimeHash === lastSyncedHash
    ) {
      return { status: 'synced', issues: [] };
    }

    const sourceChanged =
      Boolean(input.currentSourceWorkflowHash) &&
      Boolean(input.binding.source_workflow_hash) &&
      input.currentSourceWorkflowHash !== input.binding.source_workflow_hash;

    if (sourceChanged) {
      return {
        status: 'conflict_source_and_runtime_changed',
        issues: [
          {
            code: 'WF_COMPILER_SOURCE_AND_RUNTIME_CHANGED',
            message:
              'Both LexFrame source workflow and Activepieces runtime changed since the last sync.',
            severity: 'policy_block',
          },
        ],
      };
    }

    return {
      status: 'runtime_modified',
      issues: [
        {
          code: 'WF_COMPILER_RUNTIME_MODIFIED',
          message:
            'Activepieces runtime hash differs from the last synced hash.',
          severity: 'policy_block',
        },
      ],
    };
  }
}

function detectUnsafeRuntimeChanges(
  snapshot: unknown,
): readonly CompileIssue[] {
  const issues: CompileIssue[] = [];
  const steps = collectRuntimeSteps(snapshot);
  if (
    steps.some((step) =>
      isDirectAiPiece(
        readString(step.pieceName) ?? readString(step.piece_name) ?? '',
      ),
    )
  ) {
    issues.push({
      code: 'WF_COMPILER_DIRECT_AI_PROVIDER_ADDED',
      message:
        'Runtime contains a direct AI provider piece outside LexFrame AI Gateway.',
      severity: 'policy_block',
    });
  }
  if (
    steps.some((step) => {
      const piece =
        readString(step.pieceName) ?? readString(step.piece_name) ?? '';
      const metadata = isRecord(step.metadata) ? step.metadata : {};
      const mappedToLexFrame =
        typeof metadata.lexframeSourceNodeId === 'string';
      return (
        !mappedToLexFrame &&
        piece.length > 0 &&
        !piece.includes('lexframe') &&
        !piece.includes('flow-control')
      );
    })
  ) {
    issues.push({
      code: 'WF_COMPILER_UNKNOWN_RUNTIME_NODES',
      message:
        'Runtime contains nodes that are not mapped to LexFrame source nodes.',
      severity: 'policy_block',
    });
  }
  if (
    steps.some((step) =>
      (readString(step.actionName) ?? readString(step.action_name) ?? '')
        .toLowerCase()
        .includes('send'),
    ) &&
    !steps.some((step) =>
      (readString(step.actionName) ?? readString(step.action_name) ?? '')
        .toLowerCase()
        .includes('approval'),
    )
  ) {
    issues.push({
      code: 'WF_COMPILER_APPROVAL_REMOVED',
      message:
        'Runtime delivery path appears to send externally without an approval step.',
      severity: 'policy_block',
    });
  }
  return issues;
}

function isDirectAiPiece(pieceName: string) {
  const lower = pieceName.toLowerCase();
  return (
    (lower.includes('openai') ||
      lower.includes('anthropic') ||
      lower.includes('gemini') ||
      lower.includes('cometapi') ||
      lower.includes('llm')) &&
    !lower.includes('lexframe') &&
    !lower.includes('ai-gateway')
  );
}

function unsafeStatus(code: string | undefined): RuntimeDriftStatus {
  switch (code) {
    case 'WF_COMPILER_APPROVAL_REMOVED':
      return 'approval_removed';
    case 'WF_COMPILER_DIRECT_AI_PROVIDER_ADDED':
      return 'direct_ai_provider_added';
    case 'WF_COMPILER_UNKNOWN_RUNTIME_NODES':
      return 'unknown_runtime_nodes';
    default:
      return 'import_requires_review';
  }
}

function collectRuntimeSteps(
  snapshot: unknown,
): readonly Record<string, unknown>[] {
  const steps: Record<string, unknown>[] = [];
  visit(snapshot);
  return steps;

  function visit(value: unknown) {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }
    if (!isRecord(value)) {
      return;
    }
    if (
      typeof value.name === 'string' &&
      (isRecord(value.settings) ||
        value.type === 'PIECE' ||
        value.type === 'PIECE_TRIGGER')
    ) {
      const settings = isRecord(value.settings) ? value.settings : {};
      steps.push({
        ...value,
        pieceName: value.pieceName ?? settings.pieceName,
        actionName:
          value.actionName ?? settings.actionName ?? settings.triggerName,
      });
    }
    for (const child of Object.values(value)) {
      visit(child);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
