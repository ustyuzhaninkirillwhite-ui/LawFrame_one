import type {
  CanvasDebugError,
  CanvasSuggestedFix,
  CanvasTestRunRedaction,
  ValidationIssue,
  WorkflowNode,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';

const sensitiveClassifications = new Set<string>([
  'personal_data',
  'legal_secret',
  'client_material',
  'secret',
  'runtime_only',
]);

@Injectable()
export class CanvasDebugRedactionService {
  summarizeNodeInput(node: WorkflowNode): Record<string, unknown> {
    return {
      node_id: node.id,
      input_count: node.inputs.length,
      binding_count: node.input_bindings?.length ?? 0,
      missing_required_inputs: node.inputs
        .filter((input) => input.required)
        .filter((input) => !hasBindingForInput(node, input.key))
        .map((input) => input.key),
    };
  }

  summarizeNodeOutput(node: WorkflowNode): Record<string, unknown> {
    return {
      node_id: node.id,
      output_count: node.outputs.length,
      outputs: node.outputs.map((output) => ({
        key: output.key,
        label: output.label,
        data_type: output.data_type,
        classification: output.classification,
      })),
      runtime_provider: node.runtime_mapping.provider ?? 'internal_worker',
    };
  }

  redactPayload(input: {
    readonly node: WorkflowNode;
    readonly payload: Record<string, unknown>;
    readonly redaction: CanvasTestRunRedaction;
  }): {
    readonly payload: Record<string, unknown>;
    readonly redacted: boolean;
  } {
    const classification = classifyNode(input.node);
    const mustRedact =
      !input.redaction.raw_output_visible ||
      sensitiveClassifications.has(classification);

    if (!mustRedact) {
      return { payload: input.payload, redacted: false };
    }

    return {
      payload: {
        node_id: input.node.id,
        display_name: input.node.display_name,
        classification,
        redacted: true,
        summary: {
          keys: Object.keys(input.payload),
          output_count: input.node.outputs.length,
        },
      },
      redacted: true,
    };
  }

  issueToDebugError(issue: ValidationIssue): CanvasDebugError {
    const code = normalizeErrorCode(issue.code);
    const causeType = causeTypeForCode(code);
    const suggestedFixes = buildSuggestedFixes(issue, code);

    return {
      code,
      severity: issue.severity,
      node_id: issue.affected_node_id ?? null,
      edge_id: issue.affected_edge_id ?? null,
      title: issue.title || code,
      user_message: issue.message,
      technical_message: issue.developer_message ?? null,
      cause: {
        type: causeType,
        details: {
          original_code: issue.code,
          scope: issue.scope,
          input_key: issue.affected_input_key ?? null,
          field_path: issue.field_path ?? null,
        },
      },
      suggested_fixes: suggestedFixes,
      can_auto_fix: suggestedFixes.some((fix) =>
        Boolean(fix.operation_preview),
      ),
    };
  }

  blockedExternalAction(node: WorkflowNode): CanvasDebugError {
    return {
      code: 'EXTERNAL_ACTION_BLOCKED_IN_DRY_RUN',
      severity: 'policy_block',
      node_id: node.id,
      edge_id: null,
      title: 'External action simulated',
      user_message:
        'This step would perform an external action in production, so dry-run replaced it with a safe preview.',
      technical_message: null,
      cause: {
        type: 'policy',
        details: {
          provider: node.runtime_mapping.provider ?? null,
          module_code: node.module_code ?? node.block_code,
        },
      },
      suggested_fixes: [],
      can_auto_fix: false,
    };
  }
}

function hasBindingForInput(node: WorkflowNode, inputKey: string) {
  return (node.input_bindings ?? []).some(
    (binding) =>
      binding.target?.input_key === inputKey ||
      binding.targetInputKey === inputKey,
  );
}

function classifyNode(node: WorkflowNode): string {
  return (
    node.policy.data_classification ??
    node.outputs.find((output) => output.classification)?.classification ??
    'workspace_internal'
  );
}

function normalizeErrorCode(code: string): string {
  if (code.includes('REQUIRED') || code.includes('MISSING_INPUT')) {
    return 'REQUIRED_INPUT_MISSING';
  }
  if (code.includes('BINDING') && code.includes('TYPE')) {
    return 'BINDING_TYPE_MISMATCH';
  }
  if (code.includes('CONNECTION')) {
    return 'CONNECTION_MISSING';
  }
  if (code.includes('APPROVAL')) {
    return 'APPROVAL_REQUIRED';
  }
  if (code.includes('AI_ROUTE')) {
    return 'AI_ROUTE_BLOCKED';
  }
  if (code.includes('RUNTIME_MAPPING')) {
    return 'RUNTIME_MAPPING_MISSING';
  }
  if (code.includes('SCHEMA')) {
    return 'SCHEMA_VALIDATION_FAILED';
  }
  return code || 'SCHEMA_VALIDATION_FAILED';
}

function causeTypeForCode(code: string): CanvasDebugError['cause']['type'] {
  if (code.includes('INPUT')) {
    return 'missing_input';
  }
  if (code.includes('BINDING')) {
    return 'invalid_binding';
  }
  if (code.includes('AI')) {
    return 'ai';
  }
  if (code.includes('PERMISSION') || code.includes('DOCUMENT_ACCESS')) {
    return 'permission';
  }
  if (code.includes('RUNTIME') || code.includes('ACTIVEPIECES')) {
    return 'runtime';
  }
  if (code.includes('EXTERNAL')) {
    return 'external_service';
  }
  return 'policy';
}

function buildSuggestedFixes(
  issue: ValidationIssue,
  code: string,
): CanvasSuggestedFix[] {
  if (code === 'REQUIRED_INPUT_MISSING' && issue.affected_input_key) {
    return [
      {
        type: 'open_inspector_tab',
        tab: 'inputs',
        message: `Select a data source for ${issue.affected_input_key}.`,
      },
    ];
  }
  if (code === 'APPROVAL_REQUIRED') {
    return [
      {
        type: 'add_required_approval',
        message: 'Add an approval step before the external action.',
      },
    ];
  }
  return (issue.suggested_fixes ?? []).map((fix) => ({
    type: fix.type,
    message: fix.label,
    operation_preview: fix.operation_payload
      ? {
          op: fix.operation_type,
          payload: fix.operation_payload,
        }
      : undefined,
  }));
}
