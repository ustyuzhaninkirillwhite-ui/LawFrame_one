import type {
  CanvasAiMessageRequest,
  CanvasAiStructuredOutput,
  CanvasModuleCard,
  CanvasOperation,
  LexFrameWorkflowV2,
  ValidationIssue,
} from '@lexframe/contracts';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { CanvasAiBuiltContext } from './canvas-ai-context-builder.service';

const MAX_PATCH_OPERATIONS = 20;

@Injectable()
export class CanvasPatchPlanner {
  planFallback(input: {
    readonly request: CanvasAiMessageRequest;
    readonly context: CanvasAiBuiltContext;
  }): CanvasAiStructuredOutput {
    switch (input.request.mode) {
      case 'explain':
        return {
          response_type: 'explanation',
          assistant_summary: this.explain(input.context),
        };
      case 'test_plan':
        return {
          response_type: 'test_plan',
          assistant_summary:
            'Draft-only test plan generated from redacted Canvas context.',
          test_plan: this.buildTestPlan(input.context),
        };
      case 'debug_test':
        return {
          response_type: 'debug_explanation',
          assistant_summary:
            'Redacted debug context was analyzed without raw run payloads.',
          debug_summary:
            'Review validation errors, missing bindings, and blocked policy checks before running another dry-run.',
          suspected_causes: this.suspectedCauses(input.context),
          next_actions: this.nextActions(input.context),
        };
      case 'configure_step':
        return this.planConfigure(input.request, input.context);
      case 'fix_validation':
      case 'edit':
      default:
        return this.planPatch(input.request, input.context);
    }
  }

  normalizeStructuredOutput(
    output: CanvasAiStructuredOutput,
    fallback: CanvasAiStructuredOutput,
  ): CanvasAiStructuredOutput {
    if (!output || typeof output.assistant_summary !== 'string') {
      return fallback;
    }
    if (output.response_type === 'patch_proposal') {
      return {
        ...output,
        operations: this.normalizeOperations(output.operations ?? []).slice(
          0,
          MAX_PATCH_OPERATIONS,
        ),
      };
    }
    return output;
  }

  private planPatch(
    request: CanvasAiMessageRequest,
    context: CanvasAiBuiltContext,
  ): CanvasAiStructuredOutput {
    const issue = this.findIssue(request, context.validation.issues);
    const moduleCode = this.selectModuleCode(
      request.message,
      context.modules,
      issue,
    );
    if (!moduleCode) {
      return {
        response_type: 'needs_clarification',
        assistant_summary:
          'The assistant could not match the request to an allowlisted Canvas module.',
        clarification_questions: [
          {
            id: 'module',
            label: 'Which Canvas module should be added or configured?',
            required: true,
            kind: 'module',
          },
        ],
      };
    }

    const selectedNodeId =
      request.selected_node_id ??
      request.client_context?.selected_node_id ??
      issue?.affected_node_id ??
      null;
    const baseHash = context.workflowHash;
    const operation: CanvasOperation = {
      client_operation_id: `canvas_ai:${randomUUID()}`,
      operation_type: 'ADD_NODE_FROM_MODULE',
      operation_payload: {
        module_code: moduleCode,
        insert: selectedNodeId
          ? { position: 'after_node', source_node_id: selectedNodeId }
          : { position: 'workflow_end' },
        initial_config: {},
        auto_bind_inputs: true,
        create_default_error_policy: true,
        source: 'canvas_ai_assistant',
      },
      base_workflow_hash: baseHash,
      idempotency_key: `canvas_ai:${baseHash}:${moduleCode}:${selectedNodeId ?? 'end'}`,
    };

    return {
      response_type: 'patch_proposal',
      title: this.titleForModule(moduleCode, context.modules),
      assistant_summary: this.summaryForModule(
        moduleCode,
        context.draft.workflow,
      ),
      operations: [operation],
    };
  }

  private planConfigure(
    request: CanvasAiMessageRequest,
    context: CanvasAiBuiltContext,
  ): CanvasAiStructuredOutput {
    const selectedNodeId =
      request.selected_node_id ?? request.client_context?.selected_node_id;
    if (!selectedNodeId) {
      return {
        response_type: 'needs_clarification',
        assistant_summary:
          'A selected Canvas step is required for AI configuration.',
        clarification_questions: [
          {
            id: 'selected_node',
            label: 'Select the step that should be configured.',
            required: true,
            kind: 'node',
          },
        ],
      };
    }

    const issue = context.validation.issues.find(
      (candidate) =>
        candidate.affected_node_id === selectedNodeId &&
        candidate.suggested_action,
    );
    if (!issue?.suggested_action) {
      return {
        response_type: 'needs_clarification',
        assistant_summary:
          'The selected step does not expose a deterministic configuration fix yet.',
        clarification_questions: [
          {
            id: 'input_source',
            label:
              'Which workflow input or previous step output should be bound?',
            required: true,
            kind: 'text',
          },
        ],
      };
    }

    return {
      response_type: 'patch_proposal',
      title: 'Configure selected step',
      assistant_summary: issue.suggested_action.label,
      operations: [
        {
          client_operation_id: `canvas_ai:${randomUUID()}`,
          operation_type: issue.suggested_action.operation_type,
          operation_payload: issue.suggested_action.operation_payload,
          base_workflow_hash: context.workflowHash,
          idempotency_key: `canvas_ai:${context.workflowHash}:${issue.id}`,
        },
      ],
    };
  }

  private selectModuleCode(
    message: string,
    modules: readonly CanvasModuleCard[],
    issue: ValidationIssue | null,
  ) {
    const normalized =
      `${message} ${issue?.code ?? ''} ${issue?.title ?? ''}`.toLowerCase();
    const candidates = modules.filter(
      (module) => module.availability.status === 'available',
    );

    const matchBy = (predicate: (module: CanvasModuleCard) => boolean) =>
      candidates.find(predicate)?.module_code ?? null;

    if (/approval|approve|review|соглас|утверд/i.test(normalized)) {
      return matchBy((module) => this.moduleText(module).includes('approval'));
    }
    if (/email|delivery|send|external|письм|отправ|достав/i.test(normalized)) {
      return (
        matchBy((module) => this.moduleText(module).includes('approval')) ??
        matchBy((module) => /delivery|email/.test(this.moduleText(module)))
      );
    }
    if (/deadline|limitation|срок|давност/i.test(normalized)) {
      return matchBy((module) =>
        /deadline|limitation|срок/.test(this.moduleText(module)),
      );
    }
    if (/structure|структур/i.test(normalized)) {
      return matchBy((module) =>
        /structure|структур/.test(this.moduleText(module)),
      );
    }
    if (/case.?law|practice|практик|поиск/i.test(normalized)) {
      return matchBy((module) =>
        /case.?law|practice|search|поиск|практик/.test(this.moduleText(module)),
      );
    }

    return candidates[0]?.module_code ?? null;
  }

  private titleForModule(
    moduleCode: string,
    modules: readonly CanvasModuleCard[],
  ) {
    return (
      modules.find((module) => module.module_code === moduleCode)
        ?.display_name ?? `Add ${moduleCode}`
    );
  }

  private summaryForModule(moduleCode: string, workflow: LexFrameWorkflowV2) {
    const hasApproval = workflow.nodes.some((node) => node.type === 'approval');
    if (/delivery|email/i.test(moduleCode) && !hasApproval) {
      return 'External delivery requires an approval gate; the proposal adds a review step first.';
    }
    return `Proposes adding ${moduleCode} through CanvasOperationService after validation.`;
  }

  private explain(context: CanvasAiBuiltContext) {
    const workflow = context.draft.workflow;
    const issueText =
      context.validation.issues.length === 0
        ? 'No blocking validation issues are currently reported.'
        : `${context.validation.issues.length} validation issue(s) require review.`;
    return `${workflow.metadata.title} contains ${workflow.nodes.length} nodes and ${workflow.edges.length} edges. ${issueText}`;
  }

  private buildTestPlan(context: CanvasAiBuiltContext) {
    const firstNode =
      context.draft.workflow.nodes.find((node) => node.type !== 'trigger') ??
      context.draft.workflow.nodes[0];
    return {
      sample_inputs: context.draft.workflow.inputs.map((input) => ({
        key: input.key,
        description: input.label,
        classification: String(input.classification ?? 'internal'),
      })),
      pinned_data: context.draft.workflow.nodes
        .filter((node) => node.test_state?.sample_data_status === 'pinned')
        .map((node) => ({
          node_id: node.id,
          output_key: null,
          reason: 'Pinned data is already available for draft testing.',
        })),
      dry_run_order: context.draft.workflow.nodes.map((node) => node.id),
      first_step_recommendation: firstNode?.id ?? null,
      production_safe: true,
    };
  }

  private suspectedCauses(context: CanvasAiBuiltContext) {
    return context.validation.issues.slice(0, 5).map((issue) => issue.title);
  }

  private nextActions(context: CanvasAiBuiltContext) {
    if (context.validation.issues.length === 0) {
      return ['Run a validation-only test before a dry-run.'];
    }
    return context.validation.issues.slice(0, 5).map((issue) => {
      return issue.affected_node_id
        ? `Review ${issue.code} on ${issue.affected_node_id}.`
        : `Review workflow issue ${issue.code}.`;
    });
  }

  private findIssue(
    request: CanvasAiMessageRequest,
    issues: readonly ValidationIssue[],
  ) {
    const issueId =
      request.selected_validation_issue_id ??
      request.client_context?.selected_validation_issue_id;
    return issueId
      ? (issues.find((issue) => issue.id === issueId) ?? null)
      : null;
  }

  private normalizeOperations(
    operations: readonly CanvasOperation[],
  ): readonly CanvasOperation[] {
    return operations.filter(
      (operation) =>
        typeof operation.client_operation_id === 'string' &&
        typeof operation.operation_type === 'string' &&
        isRecord(operation.operation_payload),
    );
  }

  private moduleText(module: CanvasModuleCard) {
    return [
      module.module_code,
      module.display_name,
      module.short_description,
      module.category_code,
      module.category_label,
      ...module.tags,
      ...module.aliases,
    ]
      .join(' ')
      .toLowerCase();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
