import type {
  CanvasAiPolicyResult,
  CanvasOperation,
  LexFrameWorkflowV2,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';

const FORBIDDEN_OPERATION_TYPES = new Set([
  'RUNTIME_IMPORT_AS_DRAFT',
  'SNAPSHOT_RESTORE',
  'PIN_SAMPLE_DATA',
  'UNPIN_SAMPLE_DATA',
]);

@Injectable()
export class CanvasPolicyValidator {
  validate(input: {
    readonly workflow: LexFrameWorkflowV2;
    readonly operations: readonly CanvasOperation[];
    readonly includeSensitiveContext: boolean;
  }): CanvasAiPolicyResult {
    const codes: string[] = [];
    const messages: string[] = [];
    const operationsAddApproval = input.operations.some((operation) => {
      const moduleCode = moduleCodeFromOperation(operation);
      return (
        operation.operation_type === 'ADD_NODE_FROM_MODULE' &&
        moduleCode !== null &&
        /approval|review/i.test(moduleCode)
      );
    });
    const workflowHasApproval = input.workflow.nodes.some(
      (node) => node.type === 'approval',
    );

    for (const operation of input.operations) {
      if (FORBIDDEN_OPERATION_TYPES.has(operation.operation_type)) {
        codes.push('forbidden_operation_type');
        messages.push(
          `${operation.operation_type} is not allowed for Canvas AI.`,
        );
      }

      const payloadText = JSON.stringify(
        operation.operation_payload,
      ).toLowerCase();
      if (/service_role|api_key|secret|password|signed_url/.test(payloadText)) {
        codes.push('secret_reference_forbidden');
        messages.push(
          'Canvas AI patches cannot include secrets or signed URLs.',
        );
      }

      const moduleCode = moduleCodeFromOperation(operation);
      if (
        moduleCode &&
        /(^|[._-])(http|code|supabase|provider)([._-]|$)/i.test(moduleCode)
      ) {
        codes.push('direct_provider_or_code_step_blocked');
        messages.push(
          'Direct provider, HTTP, code, or service-role modules are blocked for Canvas AI.',
        );
      }

      if (
        moduleCode &&
        /delivery|email|send|external/i.test(moduleCode) &&
        !workflowHasApproval &&
        !operationsAddApproval
      ) {
        codes.push('external_delivery_requires_approval');
        messages.push(
          'External delivery requires an approval gate before the delivery step.',
        );
      }
    }

    if (input.includeSensitiveContext) {
      codes.push('sensitive_context_requested');
      messages.push(
        'Sensitive context use requires explicit AI and Canvas permissions.',
      );
    }

    return {
      allowed:
        codes.filter((code) => code !== 'sensitive_context_requested')
          .length === 0,
      codes,
      messages,
      requires_human_confirmation: true,
      sensitive_context_used: input.includeSensitiveContext,
    };
  }
}

function moduleCodeFromOperation(operation: CanvasOperation) {
  const payload = operation.operation_payload;
  if (!isRecord(payload)) {
    return null;
  }
  const code = payload.module_code ?? payload.moduleCode ?? payload.block_code;
  return typeof code === 'string' && code.length > 0 ? code : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
