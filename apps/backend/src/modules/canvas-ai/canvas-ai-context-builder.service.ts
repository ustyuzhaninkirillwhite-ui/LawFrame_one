import type {
  CanvasAiContextSummary,
  CanvasAiMessageRequest,
  CanvasModuleCard,
  CanvasValidationSummary,
  LexFrameWorkflowV2,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import {
  CanvasDraftRow,
  CanvasDraftService,
} from '../canvas/canvas-draft.service';
import { CanvasModuleCatalogService } from '../canvas/canvas-module-catalog.service';
import { CanvasValidationService } from '../canvas/canvas-validation.service';
import { CanvasAiRedactionService } from './canvas-ai-redaction.service';

const MAX_CONTEXT_NODES = 100;

export interface CanvasAiBuiltContext {
  readonly draft: CanvasDraftRow;
  readonly workflowHash: string;
  readonly validation: CanvasValidationSummary;
  readonly summary: CanvasAiContextSummary;
  readonly modules: readonly CanvasModuleCard[];
  readonly redactions: readonly string[];
}

@Injectable()
export class CanvasAiContextBuilder {
  constructor(
    private readonly draftService: CanvasDraftService,
    private readonly validationService: CanvasValidationService,
    private readonly moduleCatalogService: CanvasModuleCatalogService,
    private readonly redactionService: CanvasAiRedactionService,
  ) {}

  async build(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly request: CanvasAiMessageRequest;
  }): Promise<CanvasAiBuiltContext> {
    const draft = await this.draftService.ensureDraft(
      input.actor,
      input.access,
      input.automationId,
    );
    const validation = this.validationService.validateWorkflow(draft.workflow, {
      mode: 'full',
      reason: 'canvas_ai_context',
      scope: 'draft',
      includeRuntimeChecks: true,
    });
    const workflow = draft.workflow;
    const catalog = await this.moduleCatalogService.getCatalog({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      draftVersionId: draft.id,
      workflow,
      contextNodeId:
        input.request.selected_node_id ??
        input.request.client_context?.selected_node_id ??
        undefined,
      insertPosition: 'workflow_end',
      mode: 'ai_assistant',
      query: input.request.message,
    });

    const safe = this.redactionService.redact(
      this.buildSafeContext(workflow, validation, input.request),
    );

    return {
      draft,
      workflowHash: this.draftService.hashWorkflow(workflow),
      validation,
      summary: {
        ...safe.value,
        redactions: safe.redactions,
      },
      modules: catalog.modules,
      redactions: safe.redactions,
    };
  }

  private buildSafeContext(
    workflow: LexFrameWorkflowV2,
    validation: CanvasValidationSummary,
    request: CanvasAiMessageRequest,
  ): Omit<CanvasAiContextSummary, 'redactions'> {
    const selectedNodeId =
      request.selected_node_id ?? request.client_context?.selected_node_id;
    const selectedIssueId =
      request.selected_validation_issue_id ??
      request.client_context?.selected_validation_issue_id;
    const selectedIssue = selectedIssueId
      ? validation.issues.find((issue) => issue.id === selectedIssueId)
      : null;
    const includedNodeIds = new Set<string>();

    if (selectedNodeId) {
      includedNodeIds.add(selectedNodeId);
    }
    if (selectedIssue?.affected_node_id) {
      includedNodeIds.add(selectedIssue.affected_node_id);
    }

    const nodes = workflow.nodes
      .filter(
        (node, index) =>
          includedNodeIds.size === 0 ||
          includedNodeIds.has(node.id) ||
          index < MAX_CONTEXT_NODES,
      )
      .slice(0, MAX_CONTEXT_NODES)
      .map((node) => ({
        id: node.id,
        type: node.type,
        display_name: node.display_name,
        module_code: node.module_code ?? node.block_code,
        policy: node.policy,
      }));

    return {
      workflow: {
        id: workflow.id,
        schema_version: workflow.schema_version,
        metadata: workflow.metadata,
        runtime_projection: workflow.runtime_projection,
      },
      nodes,
      edges: workflow.edges.slice(0, MAX_CONTEXT_NODES).map((edge) => ({
        id: edge.id,
        source_node_id: edge.source_node_id,
        target_node_id: edge.target_node_id,
        type: edge.type,
      })),
      validation_issues: validation.issues.slice(0, 50).map((issue) => ({
        id: issue.id,
        severity: issue.severity,
        code: issue.code,
        title: issue.title,
        affected_node_id: issue.affected_node_id,
      })),
    };
  }
}
