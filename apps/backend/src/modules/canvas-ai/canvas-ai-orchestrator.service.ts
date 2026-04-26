import type {
  CanvasAiClarificationResponse,
  CanvasAiDebugResponse,
  CanvasAiExplanationResponse,
  CanvasAiMessageRequest,
  CanvasAiMessageResponse,
  CanvasAiPatchApplyRequest,
  CanvasAiPatchApplyResponse,
  CanvasAiPatchProposal,
  CanvasAiPatchProposalResponse,
  CanvasAiPatchRejectRequest,
  CanvasAiPatchRejectResponse,
  CanvasAiPolicyBlockedResponse,
  CanvasAiSessionSummary,
  CanvasAiStructuredOutput,
  CanvasAiTestPlanResponse,
  CanvasOperation,
  CanvasValidationResult,
  CanvasValidationSummary,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { DatabaseService } from '../database/database.service';
import { requireWorkspaceId } from '../canvas/canvas-access';
import { CanvasAiAuditService } from './canvas-ai-audit.service';
import { CanvasAiContextBuilder } from './canvas-ai-context-builder.service';
import { CanvasAiPromptBuilder } from './canvas-ai-prompt-builder.service';
import { CanvasAiRateLimitService } from './canvas-ai-rate-limit.service';
import { CanvasAiRedactionService } from './canvas-ai-redaction.service';
import { CanvasAiTelemetryService } from './canvas-ai-telemetry.service';
import { CanvasAiToolRegistry } from './canvas-ai-tool-registry.service';
import { CanvasDiffService } from './canvas-diff.service';
import { CanvasPatchApplyService } from './canvas-patch-apply.service';
import { CanvasPatchPlanner } from './canvas-patch-planner.service';
import { CanvasPatchValidator } from './canvas-patch-validator.service';
import { CanvasPolicyValidator } from './canvas-policy-validator.service';

interface RequestMeta {
  readonly requestId?: string | null;
  readonly traceId?: string | null;
}

interface CanvasAiSessionRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly automation_id: string;
  readonly draft_version_id: string | null;
  readonly mode: CanvasAiSessionSummary['mode'];
  readonly status: CanvasAiSessionSummary['status'];
  readonly title: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface ProposalInsertRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly automation_id: string;
  readonly draft_version_id: string;
  readonly session_id: string;
  readonly status: CanvasAiPatchProposal['status'];
  readonly title: string;
  readonly user_request_preview: string;
  readonly assistant_summary: string;
  readonly base_workflow_hash: string;
  readonly proposed_workflow_hash: string | null;
  readonly operations: readonly CanvasOperation[];
  readonly validation_summary: Record<string, unknown>;
  readonly policy_result: Record<string, unknown>;
  readonly diff_summary: Record<string, unknown>;
  readonly expires_at: string;
  readonly applied_at: string | null;
  readonly rejected_at: string | null;
  readonly created_at: string;
}

@Injectable()
export class CanvasAiOrchestrator {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly aiGatewayService: AIGatewayService,
    private readonly contextBuilder: CanvasAiContextBuilder,
    private readonly promptBuilder: CanvasAiPromptBuilder,
    private readonly planner: CanvasPatchPlanner,
    private readonly toolRegistry: CanvasAiToolRegistry,
    private readonly patchValidator: CanvasPatchValidator,
    private readonly policyValidator: CanvasPolicyValidator,
    private readonly diffService: CanvasDiffService,
    private readonly applyService: CanvasPatchApplyService,
    private readonly rateLimitService: CanvasAiRateLimitService,
    private readonly auditService: CanvasAiAuditService,
    private readonly telemetryService: CanvasAiTelemetryService,
    private readonly redactionService: CanvasAiRedactionService,
  ) {}

  async sendMessage(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly request: CanvasAiMessageRequest;
    readonly meta: RequestMeta;
  }): Promise<CanvasAiMessageResponse> {
    switch (input.request.mode) {
      case 'explain':
        return this.explain(input);
      case 'edit':
        return this.proposePatch(input);
      case 'fix_validation':
        return this.fixValidation(input);
      case 'configure_step':
        return this.configureStep(input);
      case 'test_plan':
        return this.createTestPlan(input);
      case 'debug_test':
        return this.debugTest(input);
      default:
        return {
          status: 'error',
          error_code: 'VALIDATION_ERROR',
          message: 'Unsupported Canvas AI mode.',
        };
    }
  }

  async explain(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly request: CanvasAiMessageRequest;
    readonly meta: RequestMeta;
  }): Promise<CanvasAiExplanationResponse> {
    await this.prepareTurn(input);
    const context = await this.contextBuilder.build(input);
    const sessionId = await this.ensureSession(input, context.draft.id);
    const userMessageId = await this.insertUserMessage(
      input,
      sessionId,
      context.draft.id,
    );
    const fallback = this.planner.planFallback({
      request: input.request,
      context,
    });
    const output = await this.generateStructured(input, context, fallback);
    const summary = output.assistant_summary || fallback.assistant_summary;
    const messageId = await this.insertAssistantMessage({
      access: input.access,
      automationId: input.automationId,
      draftVersionId: context.draft.id,
      sessionId,
      mode: input.request.mode,
      responseType: 'explanation',
      contentPreview: summary,
      traceId: input.meta.traceId ?? null,
    });

    await this.recordTurnEvents(input, context, sessionId, {
      messageId: userMessageId,
      responseType: 'explanation',
      telemetryEvent: 'canvas_ai.debug_explanation_generated',
    });

    return {
      status: 'explanation',
      session_id: sessionId,
      message_id: messageId,
      summary,
      node_references: context.draft.workflow.nodes.slice(0, 8).map((node) => ({
        node_id: node.id,
        label: node.display_name,
        reason: node.module_code ?? node.block_code,
      })),
      validation_summary: context.validation,
      risks: context.draft.workflow.nodes
        .filter((node) => node.policy?.risk_level)
        .slice(0, 8)
        .map((node) => `${node.display_name}: ${node.policy.risk_level}`),
      redactions: context.redactions,
    };
  }

  async proposePatch(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly request: CanvasAiMessageRequest;
    readonly meta: RequestMeta;
  }): Promise<
    | CanvasAiPatchProposalResponse
    | CanvasAiClarificationResponse
    | CanvasAiPolicyBlockedResponse
  > {
    await this.prepareTurn(input);
    const context = await this.contextBuilder.build(input);
    const sessionId = await this.ensureSession(input, context.draft.id);
    const userMessageId = await this.insertUserMessage(
      input,
      sessionId,
      context.draft.id,
    );
    const fallback = this.planner.planFallback({
      request: input.request,
      context,
    });
    const output = await this.generateStructured(input, context, fallback);
    const normalized = this.planner.normalizeStructuredOutput(output, fallback);

    if (normalized.response_type === 'needs_clarification') {
      const response = await this.buildClarificationResponse(
        input,
        context.draft.id,
        sessionId,
        normalized,
      );
      await this.recordTurnEvents(input, context, sessionId, {
        messageId: userMessageId,
        responseType: 'needs_clarification',
        telemetryEvent: 'canvas_ai.clarification_requested',
      });
      return response;
    }

    if (normalized.response_type === 'policy_blocked') {
      return this.buildPolicyBlockedResponse(
        input,
        context.draft.id,
        sessionId,
        normalized,
      );
    }

    const operations = (normalized.operations ?? []).slice(0, 20);
    if (operations.length === 0) {
      return this.buildClarificationResponse(
        input,
        context.draft.id,
        sessionId,
        {
          response_type: 'needs_clarification',
          assistant_summary:
            'The assistant did not produce a safe CanvasOperation patch.',
          clarification_questions: [
            {
              id: 'change',
              label: 'Describe the exact Canvas step or edge to change.',
              required: true,
              kind: 'text',
            },
          ],
        },
      );
    }

    const policy = this.policyValidator.validate({
      workflow: context.draft.workflow,
      operations,
      includeSensitiveContext: input.request.include_sensitive_context === true,
    });
    const diff = this.diffService.buildDiff(operations);
    const preview = policy.allowed
      ? await this.previewPatch(
          input,
          context.draft.id,
          context.workflowHash,
          operations,
        )
      : null;
    const status = !policy.allowed
      ? 'policy_blocked'
      : preview?.would_succeed
        ? 'ready_for_review'
        : 'validation_failed';
    const proposal = await this.saveProposal({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      draftVersionId: context.draft.id,
      sessionId,
      request: input.request,
      title: normalized.title ?? 'Canvas AI patch',
      assistantSummary: normalized.assistant_summary,
      operations,
      baseWorkflowHash: context.workflowHash,
      proposedWorkflowHash: preview?.preview_workflow_hash ?? null,
      status,
      validation: preview?.validation ?? context.validation,
      policy,
      diff,
      traceId: input.meta.traceId ?? null,
    });
    const responseType =
      proposal.status === 'policy_blocked'
        ? 'policy_blocked'
        : proposal.status === 'validation_failed'
          ? 'validation_failed'
          : 'patch_proposal';
    const messageId = await this.insertAssistantMessage({
      access: input.access,
      automationId: input.automationId,
      draftVersionId: context.draft.id,
      sessionId,
      mode: input.request.mode,
      responseType,
      contentPreview: proposal.assistant_summary,
      traceId: input.meta.traceId ?? null,
    });

    await this.recordProposalEvents(input, context, sessionId, proposal);

    if (proposal.status === 'policy_blocked') {
      return {
        status: 'policy_blocked',
        session_id: sessionId,
        message_id: messageId,
        codes: proposal.policy.codes,
        message:
          proposal.policy.messages.join(' ') || proposal.assistant_summary,
        redactions: context.redactions,
        proposal,
      };
    }

    return {
      status: 'patch_proposal',
      session_id: sessionId,
      message_id: messageId,
      proposal,
    };
  }

  fixValidation(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly request: CanvasAiMessageRequest;
    readonly meta: RequestMeta;
  }) {
    return this.proposePatch({
      ...input,
      request: { ...input.request, mode: 'fix_validation' },
    });
  }

  configureStep(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly request: CanvasAiMessageRequest;
    readonly meta: RequestMeta;
  }) {
    return this.proposePatch({
      ...input,
      request: { ...input.request, mode: 'configure_step' },
    });
  }

  async createTestPlan(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly request: CanvasAiMessageRequest;
    readonly meta: RequestMeta;
  }): Promise<CanvasAiTestPlanResponse> {
    await this.prepareTurn(input);
    const context = await this.contextBuilder.build(input);
    const sessionId = await this.ensureSession(input, context.draft.id);
    const userMessageId = await this.insertUserMessage(
      input,
      sessionId,
      context.draft.id,
    );
    const fallback = this.planner.planFallback({
      request: input.request,
      context,
    });
    const output = await this.generateStructured(input, context, fallback);
    const plan = output.test_plan ?? fallback.test_plan;
    if (!plan) {
      throw new AppHttpException(
        'AI_STRUCTURED_OUTPUT_INVALID',
        502,
        'Canvas AI did not return a test plan.',
      );
    }
    const messageId = await this.insertAssistantMessage({
      access: input.access,
      automationId: input.automationId,
      draftVersionId: context.draft.id,
      sessionId,
      mode: input.request.mode,
      responseType: 'test_plan',
      contentPreview: output.assistant_summary,
      traceId: input.meta.traceId ?? null,
    });
    await this.recordTurnEvents(input, context, sessionId, {
      messageId: userMessageId,
      responseType: 'test_plan',
      telemetryEvent: 'canvas_ai.test_plan_generated',
    });
    return {
      status: 'test_plan',
      session_id: sessionId,
      message_id: messageId,
      plan,
      redactions: context.redactions,
    };
  }

  async debugTest(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly request: CanvasAiMessageRequest;
    readonly meta: RequestMeta;
  }): Promise<CanvasAiDebugResponse> {
    await this.prepareTurn(input);
    const context = await this.contextBuilder.build(input);
    const sessionId = await this.ensureSession(input, context.draft.id);
    const userMessageId = await this.insertUserMessage(
      input,
      sessionId,
      context.draft.id,
    );
    const fallback = this.planner.planFallback({
      request: input.request,
      context,
    });
    const output = await this.generateStructured(input, context, fallback);
    const messageId = await this.insertAssistantMessage({
      access: input.access,
      automationId: input.automationId,
      draftVersionId: context.draft.id,
      sessionId,
      mode: input.request.mode,
      responseType: 'debug_explanation',
      contentPreview: output.debug_summary ?? output.assistant_summary,
      traceId: input.meta.traceId ?? null,
    });
    await this.recordTurnEvents(input, context, sessionId, {
      messageId: userMessageId,
      responseType: 'debug_explanation',
      telemetryEvent: 'canvas_ai.debug_explanation_generated',
    });
    return {
      status: 'debug_explanation',
      session_id: sessionId,
      message_id: messageId,
      summary: output.debug_summary ?? output.assistant_summary,
      suspected_causes: output.suspected_causes ?? [],
      next_actions: output.next_actions ?? [],
      redacted: true,
    };
  }

  applyPatch(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly request: CanvasAiPatchApplyRequest;
    readonly meta: RequestMeta;
  }): Promise<CanvasAiPatchApplyResponse> {
    return this.applyService.apply({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      request: input.request,
      requestId: input.meta.requestId ?? null,
      traceId: input.meta.traceId ?? null,
    });
  }

  rejectPatch(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly patchId: string;
    readonly request: CanvasAiPatchRejectRequest;
    readonly meta: RequestMeta;
  }): Promise<CanvasAiPatchRejectResponse> {
    return this.applyService.reject({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      patchId: input.patchId,
      request: input.request,
      requestId: input.meta.requestId ?? null,
      traceId: input.meta.traceId ?? null,
    });
  }

  getPatch(input: {
    readonly access: AccessContext;
    readonly automationId: string;
    readonly patchId: string;
  }) {
    return this.applyService.getProposal(
      input.access,
      input.automationId,
      input.patchId,
    );
  }

  async getSession(input: {
    readonly access: AccessContext;
    readonly automationId: string;
    readonly sessionId: string;
  }): Promise<CanvasAiSessionSummary> {
    const row = await this.databaseService.one<CanvasAiSessionRow>(
      `
        select
          id,
          workspace_id,
          automation_id,
          draft_version_id,
          mode,
          status,
          title,
          created_at,
          updated_at
        from app.canvas_ai_sessions
        where workspace_id = $1
          and automation_id = $2
          and id = $3
        limit 1
      `,
      [requireWorkspaceId(input.access), input.automationId, input.sessionId],
    );
    if (!row) {
      throw new AppHttpException(
        'AI_SESSION_NOT_FOUND',
        404,
        'Canvas AI session was not found.',
      );
    }
    return row;
  }

  private async prepareTurn(input: {
    readonly access: AccessContext;
    readonly automationId: string;
    readonly request: CanvasAiMessageRequest;
  }) {
    const requiredPermission = requiredPermissionForMode(input.request.mode);
    if (
      requiredPermission &&
      !input.access.permissions.includes(requiredPermission)
    ) {
      throw new AppHttpException(
        'AI_PERMISSION_DENIED',
        403,
        `Canvas AI mode requires ${requiredPermission}.`,
      );
    }
    if (
      input.request.include_sensitive_context &&
      !input.access.permissions.includes('canvas.ai.use_sensitive_context')
    ) {
      throw new AppHttpException(
        'AI_PERMISSION_DENIED',
        403,
        'Sensitive Canvas AI context requires canvas.ai.use_sensitive_context.',
      );
    }
    await this.rateLimitService.ensureAllowed({
      access: input.access,
      automationId: input.automationId,
      mode: input.request.mode,
    });
  }

  private async generateStructured(
    input: {
      readonly access: AccessContext;
      readonly request: CanvasAiMessageRequest;
      readonly meta: RequestMeta;
    },
    context: Awaited<ReturnType<CanvasAiContextBuilder['build']>>,
    fallback: CanvasAiStructuredOutput,
  ) {
    const prompt = this.promptBuilder.buildPrompt({
      request: input.request,
      context,
    });
    const result = await this.aiGatewayService.generateStructured({
      access: input.access,
      classification: 'internal',
      taskType:
        input.request.mode === 'edit' ||
        input.request.mode === 'configure_step' ||
        input.request.mode === 'fix_validation'
          ? 'workflow_patch'
          : 'workflow_planning',
      hasDocuments: false,
      prompt,
      schemaId: 'canvas_ai_structured_output.v1',
      fallback,
      jsonSchema: {
        name: 'canvas_ai_structured_output',
        strict: true,
        schema: this.promptBuilder.structuredOutputSchema(),
      },
      tools: this.toolRegistry.listTools(),
      maxToolCalls: 8,
      traceId: input.meta.traceId ?? null,
    });
    return result.response.output;
  }

  private async previewPatch(
    input: {
      readonly actor: AuthenticatedActor;
      readonly access: AccessContext;
      readonly automationId: string;
    },
    draftId: string,
    baseWorkflowHash: string,
    operations: readonly CanvasOperation[],
  ) {
    try {
      return await this.patchValidator.validate({
        actor: input.actor,
        access: input.access,
        automationId: input.automationId,
        draftId,
        baseWorkflowHash,
        operations,
      });
    } catch {
      return null;
    }
  }

  private async saveProposal(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly draftVersionId: string;
    readonly sessionId: string;
    readonly request: CanvasAiMessageRequest;
    readonly title: string;
    readonly assistantSummary: string;
    readonly operations: readonly CanvasOperation[];
    readonly baseWorkflowHash: string;
    readonly proposedWorkflowHash: string | null;
    readonly status: CanvasAiPatchProposal['status'];
    readonly validation: CanvasValidationResult | CanvasValidationSummary;
    readonly policy: CanvasAiPatchProposal['policy'];
    readonly diff: CanvasAiPatchProposal['diff'];
    readonly traceId: string | null;
  }): Promise<CanvasAiPatchProposal> {
    const workspaceId = requireWorkspaceId(input.access);
    const preview = this.redactionService.safePreview(
      input.request.message,
      360,
    );
    const result = await this.databaseService.one<ProposalInsertRow>(
      `
        insert into app.canvas_ai_patch_proposals (
          workspace_id,
          automation_id,
          draft_version_id,
          session_id,
          created_by_user_id,
          status,
          title,
          user_request_hash,
          user_request_preview,
          assistant_summary,
          base_workflow_hash,
          proposed_workflow_hash,
          operations,
          operation_types,
          module_codes,
          validation_summary,
          policy_result,
          diff_summary,
          trace_id
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13::jsonb,
          $14::text[],
          $15::text[],
          $16::jsonb,
          $17::jsonb,
          $18::jsonb,
          $19
        )
        returning
          id,
          workspace_id,
          automation_id,
          draft_version_id,
          session_id,
          status,
          title,
          user_request_preview,
          assistant_summary,
          base_workflow_hash,
          proposed_workflow_hash,
          operations,
          validation_summary,
          policy_result,
          diff_summary,
          expires_at,
          applied_at,
          rejected_at,
          created_at
      `,
      [
        workspaceId,
        input.automationId,
        input.draftVersionId,
        input.sessionId,
        input.actor.id,
        input.status,
        input.title,
        this.redactionService.hash(input.request.message),
        preview,
        input.assistantSummary,
        input.baseWorkflowHash,
        input.proposedWorkflowHash,
        JSON.stringify(input.operations),
        input.operations.map((operation) => operation.operation_type),
        moduleCodes(input.operations),
        JSON.stringify(input.validation),
        JSON.stringify(input.policy),
        JSON.stringify(input.diff),
        input.traceId,
      ],
    );
    if (!result) {
      throw new AppHttpException(
        'AI_PROVIDER_ERROR',
        500,
        'Canvas AI patch proposal could not be stored.',
      );
    }
    return mapProposal(result);
  }

  private async buildClarificationResponse(
    input: {
      readonly access: AccessContext;
      readonly automationId: string;
      readonly request: CanvasAiMessageRequest;
      readonly meta: RequestMeta;
    },
    draftVersionId: string,
    sessionId: string,
    output: CanvasAiStructuredOutput,
  ): Promise<CanvasAiClarificationResponse> {
    const messageId = await this.insertAssistantMessage({
      access: input.access,
      automationId: input.automationId,
      draftVersionId,
      sessionId,
      mode: input.request.mode,
      responseType: 'needs_clarification',
      contentPreview: output.assistant_summary,
      traceId: input.meta.traceId ?? null,
    });
    return {
      status: 'needs_clarification',
      session_id: sessionId,
      message_id: messageId,
      questions: output.clarification_questions ?? [],
    };
  }

  private async buildPolicyBlockedResponse(
    input: {
      readonly access: AccessContext;
      readonly automationId: string;
      readonly request: CanvasAiMessageRequest;
      readonly meta: RequestMeta;
    },
    draftVersionId: string,
    sessionId: string,
    output: CanvasAiStructuredOutput,
  ): Promise<CanvasAiPolicyBlockedResponse> {
    const messageId = await this.insertAssistantMessage({
      access: input.access,
      automationId: input.automationId,
      draftVersionId,
      sessionId,
      mode: input.request.mode,
      responseType: 'policy_blocked',
      contentPreview: output.assistant_summary,
      traceId: input.meta.traceId ?? null,
    });
    return {
      status: 'policy_blocked',
      session_id: sessionId,
      message_id: messageId,
      codes: output.policy_codes ?? ['policy_blocked'],
      message: output.policy_messages?.join(' ') ?? output.assistant_summary,
      redactions: [],
      proposal: null,
    };
  }

  private async ensureSession(
    input: {
      readonly actor: AuthenticatedActor;
      readonly access: AccessContext;
      readonly automationId: string;
      readonly request: CanvasAiMessageRequest;
      readonly meta: RequestMeta;
    },
    draftVersionId: string,
  ) {
    const workspaceId = requireWorkspaceId(input.access);
    if (input.request.session_id) {
      const existing = await this.databaseService.one<{ readonly id: string }>(
        `
          select id
          from app.canvas_ai_sessions
          where id = $1
            and workspace_id = $2
            and automation_id = $3
          limit 1
        `,
        [input.request.session_id, workspaceId, input.automationId],
      );
      if (existing) {
        return existing.id;
      }
    }

    const session = await this.databaseService.one<{ readonly id: string }>(
      `
        insert into app.canvas_ai_sessions (
          workspace_id,
          automation_id,
          draft_version_id,
          actor_user_id,
          mode,
          title,
          trace_id
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id
      `,
      [
        workspaceId,
        input.automationId,
        draftVersionId,
        input.actor.id,
        input.request.mode,
        deriveTitle(input.request.message),
        input.meta.traceId ?? null,
      ],
    );
    if (!session) {
      throw new AppHttpException(
        'AI_SESSION_NOT_FOUND',
        500,
        'Canvas AI session could not be created.',
      );
    }
    await this.auditService.record({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      draftVersionId,
      sessionId: session.id,
      eventName: 'canvas_ai.session_started',
      requestId: input.meta.requestId ?? null,
      traceId: input.meta.traceId ?? null,
      metadata: { mode: input.request.mode },
    });
    return session.id;
  }

  private async insertUserMessage(
    input: {
      readonly actor: AuthenticatedActor;
      readonly access: AccessContext;
      readonly automationId: string;
      readonly request: CanvasAiMessageRequest;
      readonly meta: RequestMeta;
    },
    sessionId: string,
    draftVersionId: string,
  ) {
    return this.insertMessage({
      access: input.access,
      automationId: input.automationId,
      draftVersionId,
      sessionId,
      actorUserId: input.actor.id,
      role: 'user',
      mode: input.request.mode,
      responseType: null,
      contentPreview: this.redactionService.safePreview(input.request.message),
      contentHash: this.redactionService.hash(input.request.message),
      metadata: {
        selected_node_id: input.request.selected_node_id ?? null,
        selected_edge_id: input.request.selected_edge_id ?? null,
        selected_validation_issue_id:
          input.request.selected_validation_issue_id ?? null,
      },
      traceId: input.meta.traceId ?? null,
    });
  }

  private insertAssistantMessage(input: {
    readonly access: AccessContext;
    readonly automationId: string;
    readonly draftVersionId: string;
    readonly sessionId: string;
    readonly mode: CanvasAiMessageRequest['mode'];
    readonly responseType: string;
    readonly contentPreview: string;
    readonly traceId: string | null;
  }) {
    return this.insertMessage({
      access: input.access,
      automationId: input.automationId,
      draftVersionId: input.draftVersionId,
      sessionId: input.sessionId,
      actorUserId: null,
      role: 'assistant',
      mode: input.mode,
      responseType: input.responseType,
      contentPreview: this.redactionService.safePreview(input.contentPreview),
      contentHash: this.redactionService.hash(input.contentPreview),
      metadata: {},
      traceId: input.traceId,
    });
  }

  private async insertMessage(input: {
    readonly access: AccessContext;
    readonly automationId: string;
    readonly draftVersionId: string;
    readonly sessionId: string;
    readonly actorUserId: string | null;
    readonly role: 'user' | 'assistant' | 'tool' | 'system';
    readonly mode: CanvasAiMessageRequest['mode'];
    readonly responseType: string | null;
    readonly contentPreview: string;
    readonly contentHash: string | null;
    readonly metadata: Record<string, unknown>;
    readonly traceId: string | null;
  }) {
    const row = await this.databaseService.one<{ readonly id: string }>(
      `
        insert into app.canvas_ai_messages (
          workspace_id,
          automation_id,
          draft_version_id,
          session_id,
          actor_user_id,
          role,
          mode,
          response_type,
          content_preview,
          content_hash,
          safe_metadata,
          trace_id
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
        returning id
      `,
      [
        requireWorkspaceId(input.access),
        input.automationId,
        input.draftVersionId,
        input.sessionId,
        input.actorUserId,
        input.role,
        input.mode,
        input.responseType,
        input.contentPreview,
        input.contentHash,
        JSON.stringify(input.metadata),
        input.traceId,
      ],
    );
    return row?.id ?? '';
  }

  private async recordTurnEvents(
    input: {
      readonly actor: AuthenticatedActor;
      readonly access: AccessContext;
      readonly automationId: string;
      readonly request: CanvasAiMessageRequest;
      readonly meta: RequestMeta;
    },
    context: Awaited<ReturnType<CanvasAiContextBuilder['build']>>,
    sessionId: string,
    event: {
      readonly messageId: string;
      readonly responseType: string;
      readonly telemetryEvent: string;
    },
  ) {
    await this.auditService.record({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      draftVersionId: context.draft.id,
      sessionId,
      eventName: 'canvas_ai.message_submitted',
      requestId: input.meta.requestId ?? null,
      traceId: input.meta.traceId ?? null,
      metadata: {
        mode: input.request.mode,
        messageId: event.messageId,
        responseType: event.responseType,
      },
    });
    await this.auditService.record({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      draftVersionId: context.draft.id,
      sessionId,
      eventName: 'canvas_ai.context_built',
      requestId: input.meta.requestId ?? null,
      traceId: input.meta.traceId ?? null,
      metadata: {
        contextHash: this.redactionService.hash(context.summary),
        redactions: context.redactions,
      },
    });
    await this.telemetryService.enqueue({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      eventName: event.telemetryEvent,
      traceId: input.meta.traceId ?? null,
      properties: { mode: input.request.mode, sessionId },
    });
  }

  private async recordProposalEvents(
    input: {
      readonly actor: AuthenticatedActor;
      readonly access: AccessContext;
      readonly automationId: string;
      readonly request: CanvasAiMessageRequest;
      readonly meta: RequestMeta;
    },
    context: Awaited<ReturnType<CanvasAiContextBuilder['build']>>,
    sessionId: string,
    proposal: CanvasAiPatchProposal,
  ) {
    const eventName =
      proposal.status === 'policy_blocked'
        ? 'canvas_ai.patch_policy_blocked'
        : proposal.status === 'validation_failed'
          ? 'canvas_ai.patch_validation_failed'
          : 'canvas_ai.patch_proposed';
    await this.recordTurnEvents(input, context, sessionId, {
      messageId: proposal.id,
      responseType: proposal.status,
      telemetryEvent: eventName,
    });
    await this.auditService.record({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      draftVersionId: context.draft.id,
      sessionId,
      patchProposalId: proposal.id,
      eventName,
      policyCodes: proposal.policy.codes,
      requestId: input.meta.requestId ?? null,
      traceId: input.meta.traceId ?? null,
      metadata: {
        status: proposal.status,
        operationTypes: proposal.operations.map(
          (operation) => operation.operation_type,
        ),
      },
    });
  }
}

function mapProposal(row: ProposalInsertRow): CanvasAiPatchProposal {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    automation_id: row.automation_id,
    draft_version_id: row.draft_version_id,
    session_id: row.session_id,
    title: row.title,
    user_request: row.user_request_preview,
    assistant_summary: row.assistant_summary,
    operations: row.operations,
    base_workflow_hash: row.base_workflow_hash,
    proposed_workflow_hash: row.proposed_workflow_hash,
    status: row.status,
    validation:
      row.validation_summary as unknown as CanvasAiPatchProposal['validation'],
    policy: row.policy_result as unknown as CanvasAiPatchProposal['policy'],
    diff: row.diff_summary as unknown as CanvasAiPatchProposal['diff'],
    can_apply: row.status === 'ready_for_review',
    expires_at: row.expires_at,
    created_at: row.created_at,
    applied_at: row.applied_at,
    rejected_at: row.rejected_at,
  };
}

function moduleCodes(operations: readonly CanvasOperation[]) {
  return [
    ...new Set(
      operations
        .map((operation) => {
          const payload = operation.operation_payload;
          const code =
            payload.module_code ?? payload.moduleCode ?? payload.block_code;
          return typeof code === 'string' ? code : null;
        })
        .filter((code): code is string => code !== null),
    ),
  ];
}

function deriveTitle(message: string) {
  const trimmed = message.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed.slice(0, 80) : 'Canvas AI session';
}

function requiredPermissionForMode(mode: CanvasAiMessageRequest['mode']) {
  switch (mode) {
    case 'explain':
      return 'canvas.ai.explain';
    case 'edit':
      return 'canvas.ai.propose_patch';
    case 'fix_validation':
      return 'canvas.ai.fix_validation';
    case 'configure_step':
      return 'canvas.ai.configure_step';
    case 'debug_test':
      return 'canvas.ai.debug_test';
    case 'test_plan':
    default:
      return null;
  }
}
