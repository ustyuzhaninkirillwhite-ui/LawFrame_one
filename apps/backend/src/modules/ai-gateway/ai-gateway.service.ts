import type {
  AiChatMessageSummary,
  AiChatMode,
  AiChatResponse,
  AiChatSessionSummary,
  AiChatSource,
  AiClarificationQuestion,
  AiDataClass,
  AiMessageResponseType,
  AiProvider,
  AiProviderRoute,
  AiRedactionEntity,
  AiRedactionPreviewRequest,
  AiRedactionPreviewResponse,
  AiRequestEvent,
  AiRequestSummary,
  ClarificationRequiredResponse,
  CreateAiChatMessageRequest,
  CreateAiChatSessionRequest,
  CreateWorkflowDraftRequest,
  CreateWorkflowPatchRequest,
  LexFrameWorkflow,
  LexFrameWorkflowPatch,
  PolicyBlockedResponse,
  RuntimePlanPreview,
  UpdateWorkflowDraftInputsRequest,
  WorkflowDraftDetail,
  WorkflowDraftReadyResponse,
  WorkflowDraftStatus,
  WorkflowDraftSummary,
  WorkflowDraftVersionSummary,
  WorkflowPatchDiff,
  WorkflowPatchReadyResponse,
  WorkflowPolicyReport,
  WorkflowValidationReport,
} from '@lexframe/contracts';
import type { DataClassification } from '@lexframe/contracts';
import type {
  AccessContext,
  AiPolicyContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import {
  AI_PROMPT_VERSIONS,
  AI_SCHEMA_IDS,
  renderPlannerUserPrompt,
} from '@lexframe/ai-gateway';
import { aiWorkflowFixture } from '@lexframe/contracts';
import { loadServerEnv } from '@lexframe/config';
import { AppHttpException } from '../../common/errors/app-http.exception';
import {
  applyWorkflowPatch,
  compileRuntimePlanPreview,
  createWorkflowPolicyReport,
  createWorkflowValidationReport,
  generateWorkflowPatchDiff,
  validateWorkflowPatch,
} from '@lexframe/workflow';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { AiPolicyService } from './ai-policy.service';
import {
  AiProviderRegistry,
  type StructuredAiRequest,
  type StructuredAiResponse,
} from './ai-provider.adapters';
import {
  buildDocumentAnalysisDescription,
  buildSecurityLabels,
  buildSessionPolicySummary,
  cloneWorkflow,
  coerceOptionalString,
  estimateCost,
  hashText,
  mapAiDataClassToInputClass,
  mapDataClassificationToAiDataClass,
  mergeStringArray,
  safePreview,
  summarizeAiResponse,
  withRoute,
} from './ai-gateway.helpers';

interface RequestMeta {
  readonly requestId: string | null;
  readonly traceId: string | null;
  readonly idempotencyKey: string | null;
}

interface SessionRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly source: AiChatSource;
  readonly mode: AiChatMode;
  readonly status: AiChatSessionSummary['status'];
  readonly title: string;
  readonly current_automation_id: string | null;
  readonly selected_document_ids: readonly string[] | null;
  readonly selected_template_ids: readonly string[] | null;
  readonly selected_profile_id: string | null;
  readonly content_storage_mode: AiChatSessionSummary['contentStorageMode'];
  readonly allowed_modes: readonly AiChatMode[] | null;
  readonly ai_policy_summary: AiChatSessionSummary['aiPolicySummary'] | null;
  readonly last_message_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface MessageRow {
  readonly id: string;
  readonly session_id: string;
  readonly role: AiChatMessageSummary['role'];
  readonly response_type: AiMessageResponseType | null;
  readonly content_text: string | null;
  readonly content_preview: string;
  readonly content_storage_mode: AiChatMessageSummary['contentStorageMode'];
  readonly metadata: Record<string, unknown> | null;
  readonly created_at: string;
}

interface RequestRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly session_id: string | null;
  readonly task_type: AiRequestSummary['taskType'];
  readonly data_class: AiDataClass;
  readonly provider: AiProvider | null;
  readonly model: string | null;
  readonly route_reason: string;
  readonly prompt_hash: string;
  readonly response_hash: string | null;
  readonly schema_version: string | null;
  readonly prompt_version: string;
  readonly status: AiRequestSummary['status'];
  readonly error_code: string | null;
  readonly latency_ms: number | null;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cost_usd: string | number;
  readonly created_at: string;
}

interface RequestEventRow {
  readonly id: string;
  readonly request_id: string;
  readonly type: string;
  readonly payload: Record<string, unknown> | null;
  readonly created_at: string;
}

interface DraftRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly owner_id: string;
  readonly source: WorkflowDraftSummary['source'];
  readonly status: WorkflowDraftStatus;
  readonly title: string;
  readonly current_version_id: string;
  readonly linked_automation_id: string | null;
  readonly linked_session_id: string | null;
  readonly updated_at: string;
  readonly created_at: string;
}

interface DraftVersionRow {
  readonly id: string;
  readonly draft_id: string;
  readonly version_no: number;
  readonly schema_version: string;
  readonly prompt_version: string;
  readonly ai_request_id: string | null;
  readonly workflow: LexFrameWorkflow;
  readonly validation_report: WorkflowValidationReport;
  readonly policy_report: WorkflowPolicyReport;
  readonly runtime_plan_preview: RuntimePlanPreview;
  readonly created_at: string;
}

interface DraftPatchRow {
  readonly id: string;
  readonly draft_id: string;
  readonly patch: LexFrameWorkflowPatch;
  readonly diff: WorkflowPatchDiff;
  readonly created_at: string;
}

interface MissingFieldRow {
  readonly field: string;
  readonly label: string;
  readonly field_type: AiClarificationQuestion['type'];
  readonly required: boolean;
  readonly help_text: string | null;
  readonly options:
    | readonly { readonly value: string; readonly label: string }[]
    | null;
  readonly default_value: unknown;
  readonly answered_value: unknown;
}

interface DocumentContextRow {
  readonly id: string;
  readonly title: string;
  readonly classification: string;
  readonly kind: string;
}

interface TemplateContextRow {
  readonly id: string;
  readonly title: string;
  readonly code: string;
  readonly category: string;
  readonly description: string;
}

interface ProfileContextRow {
  readonly id: string;
  readonly full_name: string | null;
  readonly email: string;
}

interface AutomationContextRow {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly workflow: Record<string, unknown>;
}

interface ModuleContextRow {
  readonly code: string;
  readonly title: string;
  readonly category: string;
}

interface SelectionContext {
  readonly documents: readonly DocumentContextRow[];
  readonly templates: readonly TemplateContextRow[];
  readonly profile: ProfileContextRow | null;
  readonly automation: AutomationContextRow | null;
  readonly modules: readonly ModuleContextRow[];
  readonly connections: readonly string[];
}

interface ProviderDecision {
  readonly route: AiProviderRoute;
  readonly provider: AiProvider;
  readonly model: string;
  readonly routeReason: string;
}

interface DraftPersistenceInput {
  readonly workspaceId: string;
  readonly ownerId: string;
  readonly title: string;
  readonly source: WorkflowDraftSummary['source'];
  readonly linkedSessionId: string | null;
  readonly linkedAutomationId: string | null;
  readonly workflow: LexFrameWorkflow;
  readonly validationReport: WorkflowValidationReport;
  readonly policyReport: WorkflowPolicyReport;
  readonly runtimePlanPreview: RuntimePlanPreview;
  readonly clarificationQuestions: readonly AiClarificationQuestion[];
  readonly promptVersion: string;
  readonly aiRequestId: string | null;
  readonly status: WorkflowDraftStatus;
  readonly existingDraftId?: string | null;
}

const DEFAULT_ALLOWED_MODES: readonly AiChatMode[] = [
  'create_workflow',
  'modify_workflow',
  'explain_workflow',
];

const EXTRACT_ALLOWED_MODES: readonly AiChatMode[] = [
  'create_workflow',
  'explain_workflow',
  'extract_fields',
];

const DEFAULT_PROMPT_VERSION = AI_PROMPT_VERSIONS.workflowPlanning;
const PATCH_PROMPT_VERSION = AI_PROMPT_VERSIONS.workflowPatch;

@Injectable()
export class AIGatewayService {
  private readonly env = loadServerEnv();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly aiPolicyService: AiPolicyService,
    private readonly aiProviderRegistry: AiProviderRegistry,
  ) {}

  async planStructuredRoute(input: {
    readonly access: AccessContext;
    readonly classification: DataClassification;
    readonly taskType: AiRequestSummary['taskType'];
    readonly hasDocuments: boolean;
  }): Promise<{
    readonly dataClass: AiDataClass;
    readonly policy: AiPolicyContext;
    readonly route: AiProviderRoute;
    readonly provider: AiProvider | null;
    readonly model: string | null;
    readonly routeReason: string;
    readonly blocked: boolean;
    readonly blockedReasonCode: string | null;
    readonly blockedMessage: string | null;
  }> {
    const workspaceId = input.access.activeWorkspace?.id;

    if (!workspaceId) {
      throw new AppHttpException(
        'WORKSPACE_CONTEXT_REQUIRED',
        400,
        'Active workspace is required for AI route planning.',
      );
    }

    const policy = await this.aiPolicyService.getWorkspacePolicy(workspaceId);
    const dataClass = mapDataClassificationToAiDataClass(input.classification);
    const block = this.checkSensitiveAccess(input.access, policy, dataClass);

    if (block) {
      return {
        dataClass,
        policy,
        route: 'blocked',
        provider: null,
        model: null,
        routeReason: block.reasonCode,
        blocked: true,
        blockedReasonCode: block.reasonCode,
        blockedMessage: block.message,
      };
    }

    const decision = this.resolveProviderDecision(
      dataClass,
      policy,
      input.taskType,
      input.hasDocuments,
    );

    return {
      dataClass,
      policy,
      route: decision.route,
      provider: decision.provider,
      model: decision.model,
      routeReason: decision.routeReason,
      blocked: false,
      blockedReasonCode: null,
      blockedMessage: null,
    };
  }

  getPolicySnapshot() {
    return {
      route: 'backend-module',
      providerMode: this.env.AI_PROVIDER_MODE,
      providers: this.aiProviderRegistry.listProviders(),
      directBrowserAccess: false,
      structuredOutputsRequired: true,
      sensitivityClasses: [
        'A_PUBLIC',
        'B_INTERNAL_WORKSPACE',
        'C_CONFIDENTIAL_CLIENT',
        'C_LEGAL_SECRET',
      ],
    };
  }

  async generateStructured<T>(input: {
    readonly access: AccessContext;
    readonly classification: DataClassification;
    readonly taskType: AiRequestSummary['taskType'];
    readonly hasDocuments: boolean;
    readonly prompt: string;
    readonly schemaId: string;
    readonly fallback: T;
    readonly jsonSchema?: StructuredAiRequest<T>['jsonSchema'];
    readonly tools?: StructuredAiRequest<T>['tools'];
    readonly maxToolCalls?: number;
    readonly traceId?: string | null;
  }): Promise<{
    readonly route: Awaited<
      ReturnType<AIGatewayService['planStructuredRoute']>
    >;
    readonly response: StructuredAiResponse<T>;
  }> {
    const route = await this.planStructuredRoute({
      access: input.access,
      classification: input.classification,
      taskType: input.taskType,
      hasDocuments: input.hasDocuments,
    });

    if (route.blocked || !route.provider || !route.model) {
      return {
        route,
        response: {
          provider: 'local',
          model: 'local-fallback',
          output: input.fallback,
          inputTokens: Math.max(1, Math.ceil(input.prompt.length / 4)),
          outputTokens: Math.max(
            1,
            Math.ceil(JSON.stringify(input.fallback).length / 4),
          ),
          latencyMs: 0,
          usedFallback: true,
        },
      };
    }

    const adapter = this.aiProviderRegistry.get(route.provider);
    const response = await adapter.generateStructured({
      provider: route.provider,
      model: route.model,
      prompt: input.prompt,
      schemaId: input.schemaId,
      fallback: input.fallback,
      jsonSchema: input.jsonSchema,
      tools: input.tools,
      maxToolCalls: input.maxToolCalls,
      traceId: input.traceId ?? null,
    });

    return { route, response };
  }

  async listSessions(
    access: AccessContext,
  ): Promise<readonly AiChatSessionSummary[]> {
    const result = await this.databaseService.query<SessionRow>(
      `
        select
          id,
          workspace_id,
          source,
          mode,
          status,
          title,
          current_automation_id,
          selected_document_ids,
          selected_template_ids,
          selected_profile_id,
          content_storage_mode,
          allowed_modes,
          ai_policy_summary,
          last_message_at,
          created_at,
          updated_at
        from app.ai_chat_sessions
        where workspace_id = $1
        order by updated_at desc
      `,
      [access.activeWorkspace!.id],
    );

    return result.rows.map((row) => this.mapSessionRow(row));
  }

  async getSession(
    access: AccessContext,
    sessionId: string,
  ): Promise<AiChatSessionSummary> {
    const row = await this.getSessionRow(access.activeWorkspace!.id, sessionId);
    return this.mapSessionRow(row);
  }

  async listSessionMessages(
    access: AccessContext,
    sessionId: string,
  ): Promise<readonly AiChatMessageSummary[]> {
    await this.getSessionRow(access.activeWorkspace!.id, sessionId);

    const result = await this.databaseService.query<MessageRow>(
      `
        select
          id,
          session_id,
          role,
          response_type,
          content_text,
          content_preview,
          content_storage_mode,
          metadata,
          created_at
        from app.ai_chat_messages
        where workspace_id = $1
          and session_id = $2
        order by created_at asc
      `,
      [access.activeWorkspace!.id, sessionId],
    );

    return result.rows.map((row) => this.mapMessageRow(row));
  }

  async createSession(
    actor: AuthenticatedActor,
    access: AccessContext,
    policy: AiPolicyContext,
    input: CreateAiChatSessionRequest,
    meta: RequestMeta,
  ): Promise<AiChatSessionSummary> {
    const workspaceId = access.activeWorkspace!.id;
    const sessionId = await this.insertSession({
      actor,
      workspaceId,
      policy,
      source: input.source,
      mode: input.mode ?? 'create_workflow',
      title: this.deriveTitle(
        '',
        input.currentAutomationId ? 'Automation patch' : 'New AI session',
      ),
      currentAutomationId: input.currentAutomationId ?? null,
      selectedDocumentIds: input.selectedDocumentIds ?? [],
      selectedTemplateIds: input.selectedTemplateIds ?? [],
      selectedProfileId: input.selectedProfileId ?? null,
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'ai.chat.session_created',
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      entityType: 'ai_chat_session',
      entityId: sessionId,
      metadata: {
        source: input.source,
        mode: input.mode ?? 'create_workflow',
      },
    });

    return this.getSession(access, sessionId);
  }

  async sendMessage(
    actor: AuthenticatedActor,
    access: AccessContext,
    policy: AiPolicyContext,
    input: CreateAiChatMessageRequest,
    meta: RequestMeta,
  ): Promise<AiChatResponse> {
    const workspaceId = access.activeWorkspace!.id;

    await this.aiPolicyService.ensureRateLimit(workspaceId, policy);
    await this.aiPolicyService.ensureBudgetAvailable(workspaceId, policy);

    const sessionId =
      input.sessionId ??
      (await this.insertSession({
        actor,
        workspaceId,
        policy,
        source: this.deriveSource(input),
        mode: input.mode,
        title: this.deriveTitle(input.message, 'New workflow draft'),
        currentAutomationId: input.currentAutomationId ?? null,
        selectedDocumentIds: input.selectedDocumentIds ?? [],
        selectedTemplateIds: input.selectedTemplateIds ?? [],
        selectedProfileId: input.selectedProfileId ?? null,
      }));

    const session = await this.getSessionRow(workspaceId, sessionId);
    const existingResponse = await this.findIdempotentResponse(
      workspaceId,
      sessionId,
      meta.idempotencyKey,
    );

    if (existingResponse) {
      return existingResponse;
    }

    const selectedDocumentIds =
      input.selectedDocumentIds ?? session.selected_document_ids ?? [];
    const selectedTemplateIds =
      input.selectedTemplateIds ?? session.selected_template_ids ?? [];
    const selectedProfileId =
      input.selectedProfileId ?? session.selected_profile_id ?? null;
    const currentAutomationId =
      input.currentAutomationId ?? session.current_automation_id ?? null;

    await this.updateSessionContext(workspaceId, sessionId, {
      mode: input.mode,
      title: this.deriveTitle(input.message, session.title),
      currentAutomationId,
      selectedDocumentIds,
      selectedTemplateIds,
      selectedProfileId,
    });

    const selection = await this.loadSelectionContext(workspaceId, {
      documentIds: selectedDocumentIds,
      templateIds: selectedTemplateIds,
      profileId: selectedProfileId,
      automationId: currentAutomationId,
    });

    const dataClass = this.deriveDataClass(selection);
    const policyBlock = this.checkSensitiveAccess(access, policy, dataClass);

    const requestId = await this.createAiRequest({
      workspaceId,
      sessionId,
      taskType:
        input.mode === 'modify_workflow' && currentAutomationId
          ? 'workflow_patch'
          : 'workflow_planning',
      dataClass,
      prompt: input.message,
      promptVersion:
        input.mode === 'modify_workflow' && currentAutomationId
          ? PATCH_PROMPT_VERSION
          : DEFAULT_PROMPT_VERSION,
      requestPayload: {
        selectedDocumentIds,
        selectedTemplateIds,
        selectedProfileId,
        currentAutomationId,
      },
      idempotencyKey: meta.idempotencyKey,
    });

    await this.insertMessage({
      workspaceId,
      sessionId,
      role: 'user',
      responseType: null,
      content: input.message,
      contentStorageMode: this.resolveStorageMode(policy),
      metadata: {
        selectedDocumentIds,
        selectedTemplateIds,
        selectedProfileId,
        currentAutomationId,
      },
      actorUserId: actor.id,
    });

    if (policyBlock) {
      const blockedResponse = await this.finalizeBlockedResponse({
        actor,
        access,
        policy,
        requestId,
        sessionId,
        dataClass,
        input,
        policyBlock,
        meta,
      });

      return blockedResponse;
    }

    try {
      const response =
        input.mode === 'modify_workflow' && currentAutomationId
          ? await this.generatePatchResponse({
              actor,
              access,
              policy,
              sessionId,
              requestId,
              dataClass,
              instruction: input.message,
              baseVersionId:
                selection.automation?.version ?? 'current_installed_version',
              automationId: currentAutomationId,
              selection,
              meta,
            })
          : await this.generateWorkflowResponse({
              actor,
              access,
              policy,
              sessionId,
              requestId,
              dataClass,
              message: input.message,
              mode: input.mode,
              selection,
              meta,
            });

      await this.recordFinalResponse(requestId, response);
      return response;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'AI request processing failed.';

      await this.completeAiRequest(requestId, {
        status: 'error',
        provider: null,
        model: null,
        routeReason: 'processing_error',
        responseHash: hashText(message),
        schemaVersion: null,
        errorCode: 'AI_PROVIDER_ERROR',
        latencyMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
      });

      await this.recordRequestEvent(requestId, workspaceId, 'error', {
        message,
      });

      const response: AiChatResponse = {
        status: 'error',
        errorCode: 'AI_PROVIDER_ERROR',
        message,
      };

      await this.insertAssistantMessage(
        workspaceId,
        sessionId,
        response,
        policy,
        null,
      );
      await this.recordFinalResponse(requestId, response);
      throw error;
    }
  }

  async listDrafts(
    access: AccessContext,
  ): Promise<readonly WorkflowDraftSummary[]> {
    const result = await this.databaseService.query<DraftRow>(
      `
        select
          id,
          workspace_id,
          owner_id,
          source,
          status,
          title,
          current_version_id,
          linked_automation_id,
          linked_session_id,
          updated_at,
          created_at
        from app.workflow_drafts
        where workspace_id = $1
        order by updated_at desc
      `,
      [access.activeWorkspace!.id],
    );

    return result.rows.map((row) => this.mapDraftRow(row));
  }

  async getDraft(
    access: AccessContext,
    draftId: string,
  ): Promise<WorkflowDraftDetail> {
    const draftRow = await this.getDraftRow(
      access.activeWorkspace!.id,
      draftId,
    );
    return this.loadDraftDetailFromRow(draftRow);
  }

  async createDraft(
    actor: AuthenticatedActor,
    access: AccessContext,
    policy: AiPolicyContext,
    input: CreateWorkflowDraftRequest,
    meta: RequestMeta,
  ): Promise<WorkflowDraftDetail> {
    const workspaceId = access.activeWorkspace!.id;
    const dataClass = this.inferWorkflowDataClass(input.workflow);
    const route = this.resolveProviderDecision(
      dataClass,
      policy,
      'workflow_planning',
      false,
    );

    const validationReport = createWorkflowValidationReport(input.workflow);
    const policyReport = createWorkflowPolicyReport(input.workflow, {
      dataClass,
      allowedProviderRoutes: [route.route],
    });
    const runtimePlanPreview = compileRuntimePlanPreview(input.workflow, {
      availableConnections: await this.loadRuntimeConnections(workspaceId),
      dataClass,
      allowedProviderRoutes: [route.route],
    });

    const draft = await this.persistDraftVersion({
      workspaceId,
      ownerId: actor.id,
      title: input.title,
      source: input.source ?? 'manual',
      linkedSessionId: input.linkedSessionId ?? null,
      linkedAutomationId: null,
      workflow: input.workflow,
      validationReport,
      policyReport,
      runtimePlanPreview,
      clarificationQuestions: [],
      promptVersion: DEFAULT_PROMPT_VERSION,
      aiRequestId: null,
      status:
        validationReport.valid && policyReport.valid
          ? 'saved'
          : 'validation_failed',
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'ai.workflow.draft_created',
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      entityType: 'workflow_draft',
      entityId: draft.id,
      metadata: {
        source: input.source ?? 'manual',
      },
    });

    return draft;
  }

  async updateDraftInputs(
    actor: AuthenticatedActor,
    access: AccessContext,
    policy: AiPolicyContext,
    draftId: string,
    input: UpdateWorkflowDraftInputsRequest,
    meta: RequestMeta,
  ): Promise<WorkflowDraftDetail> {
    const workspaceId = access.activeWorkspace!.id;
    const draft = await this.getDraftRow(workspaceId, draftId);
    const sessionRow =
      draft.linked_session_id !== null
        ? await this.getSessionRow(workspaceId, draft.linked_session_id)
        : null;

    if (!sessionRow) {
      throw new AppHttpException(
        'AI_DRAFT_NOT_FOUND',
        404,
        'Draft inputs can only be updated for AI-linked drafts.',
      );
    }

    const selectedDocumentIds = mergeStringArray(
      sessionRow.selected_document_ids ?? [],
      input.answers.selected_documents,
    );
    const selectedTemplateIds = mergeStringArray(
      sessionRow.selected_template_ids ?? [],
      input.answers.selected_template,
    );
    const selectedProfileId =
      coerceOptionalString(input.answers.selected_profile) ??
      sessionRow.selected_profile_id;

    await this.updateSessionContext(workspaceId, sessionRow.id, {
      mode: sessionRow.mode,
      title: draft.title,
      currentAutomationId: sessionRow.current_automation_id,
      selectedDocumentIds,
      selectedTemplateIds,
      selectedProfileId,
    });

    const latestMessage = await this.getLatestUserMessage(sessionRow.id);
    const selection = await this.loadSelectionContext(workspaceId, {
      documentIds: selectedDocumentIds,
      templateIds: selectedTemplateIds,
      profileId: selectedProfileId,
      automationId: sessionRow.current_automation_id,
    });

    const dataClass = this.deriveDataClass(selection);
    const questions = this.buildClarificationQuestions(
      latestMessage?.contentPreview ?? draft.title,
      sessionRow.mode,
      selection,
    );

    const providerDecision = this.resolveProviderDecision(
      dataClass,
      policy,
      'workflow_planning',
      selection.documents.length > 0,
    );

    const workflow = this.buildWorkflowDraft({
      message: latestMessage?.contentPreview ?? draft.title,
      selection,
      dataClass,
      route: providerDecision.route,
      mode: sessionRow.mode,
    });

    const validationReport = this.withClarificationIssues(
      createWorkflowValidationReport(workflow),
      questions,
    );
    const policyReport = createWorkflowPolicyReport(workflow, {
      dataClass,
      allowedProviderRoutes: [providerDecision.route],
    });
    const runtimePlanPreview = compileRuntimePlanPreview(workflow, {
      dataClass,
      allowedProviderRoutes: [providerDecision.route],
      availableConnections: selection.connections,
    });

    const detail = await this.persistDraftVersion({
      workspaceId,
      ownerId: actor.id,
      title: draft.title,
      source: draft.source,
      linkedSessionId: draft.linked_session_id,
      linkedAutomationId: draft.linked_automation_id,
      workflow,
      validationReport,
      policyReport,
      runtimePlanPreview,
      clarificationQuestions: questions,
      promptVersion: DEFAULT_PROMPT_VERSION,
      aiRequestId: null,
      status: this.resolveDraftStatus(
        validationReport,
        policyReport,
        questions,
      ),
      existingDraftId: draft.id,
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'ai.workflow.draft_inputs_updated',
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      entityType: 'workflow_draft',
      entityId: draft.id,
      metadata: {
        answers: Object.keys(input.answers),
      },
    });

    return detail;
  }

  async createWorkflowPatch(
    actor: AuthenticatedActor,
    access: AccessContext,
    policy: AiPolicyContext,
    input: CreateWorkflowPatchRequest,
    meta: RequestMeta,
  ): Promise<AiChatResponse> {
    const workspaceId = access.activeWorkspace!.id;
    const sessionId =
      input.sessionId ??
      (await this.insertSession({
        actor,
        workspaceId,
        policy,
        source: 'automation_chat',
        mode: 'modify_workflow',
        title: this.deriveTitle(input.instruction, 'Automation patch'),
        currentAutomationId: input.automationId,
        selectedDocumentIds: [],
        selectedTemplateIds: [],
        selectedProfileId: null,
      }));

    const session = await this.getSessionRow(workspaceId, sessionId);
    const selection = await this.loadSelectionContext(workspaceId, {
      documentIds: session.selected_document_ids ?? [],
      templateIds: session.selected_template_ids ?? [],
      profileId: session.selected_profile_id,
      automationId: input.automationId,
    });

    const dataClass = this.deriveDataClass(selection);
    const requestId = await this.createAiRequest({
      workspaceId,
      sessionId,
      taskType: 'workflow_patch',
      dataClass,
      prompt: input.instruction,
      promptVersion: PATCH_PROMPT_VERSION,
      requestPayload: {
        automationId: input.automationId,
        baseVersionId: input.baseVersionId,
      },
      idempotencyKey: meta.idempotencyKey,
    });

    const response = await this.generatePatchResponse({
      actor,
      access,
      policy,
      sessionId,
      requestId,
      dataClass,
      instruction: input.instruction,
      automationId: input.automationId,
      baseVersionId: input.baseVersionId,
      selection,
      meta,
    });

    await this.recordFinalResponse(requestId, response);
    return response;
  }

  async previewRedaction(
    actor: AuthenticatedActor,
    access: AccessContext,
    policy: AiPolicyContext,
    input: AiRedactionPreviewRequest,
    meta: RequestMeta,
  ): Promise<AiRedactionPreviewResponse> {
    const workspaceId = access.activeWorkspace!.id;
    const policyBlock = this.checkSensitiveAccess(
      access,
      policy,
      input.classification,
    );

    if (policyBlock) {
      throw new AppHttpException(
        'AI_POLICY_BLOCKED',
        403,
        policyBlock.message,
        {
          reasonCode: policyBlock.reasonCode,
        },
      );
    }

    const providerDecision = this.resolveProviderDecision(
      input.classification,
      policy,
      'field_extraction',
      false,
    );
    const requestId = await this.createAiRequest({
      workspaceId,
      sessionId: null,
      taskType: 'field_extraction',
      dataClass: input.classification,
      prompt: input.text,
      promptVersion: AI_PROMPT_VERSIONS.redactionPreview,
      requestPayload: {
        redactionPolicy: input.redactionPolicy,
      },
      idempotencyKey: meta.idempotencyKey,
    });

    const adapter = this.aiProviderRegistry.get(providerDecision.provider);
    const fallback = this.redactText(input.text, input.redactionPolicy);
    const providerResponse = await adapter.generateStructured({
      provider: providerDecision.provider,
      model: providerDecision.model,
      prompt: input.text,
      schemaId: AI_SCHEMA_IDS.redactionPreview,
      fallback,
    });
    this.assertProviderResponseReady(providerDecision, providerResponse);

    const mappingId = randomUUID();

    await this.databaseService.query(
      `
        insert into app.ai_redaction_mappings (
          id,
          workspace_id,
          classification,
          original_hash,
          redacted_text,
          entities,
          created_by_user_id
        )
        values ($1, $2, $3, $4, $5, $6::jsonb, $7)
      `,
      [
        mappingId,
        workspaceId,
        input.classification,
        hashText(input.text),
        providerResponse.output.redactedText,
        JSON.stringify(providerResponse.output.entities),
        actor.id,
      ],
    );

    await this.completeAiRequest(requestId, {
      status: 'completed',
      provider: providerResponse.provider,
      model: providerResponse.model,
      routeReason: providerDecision.routeReason,
      responseHash: hashText(providerResponse.output.redactedText),
      schemaVersion: AI_SCHEMA_IDS.redactionPreview,
      errorCode: null,
      latencyMs: providerResponse.latencyMs,
      inputTokens: providerResponse.inputTokens,
      outputTokens: providerResponse.outputTokens,
      costUsd: estimateCost(
        providerResponse.provider,
        providerResponse.inputTokens,
        providerResponse.outputTokens,
      ),
    });

    await this.recordProviderCall(
      workspaceId,
      requestId,
      providerDecision,
      providerResponse.latencyMs,
      input.text,
      providerResponse.output,
    );

    await this.databaseService.query(
      `
        insert into app.ai_cost_usage (
          id,
          workspace_id,
          ai_request_id,
          provider,
          cost_usd,
          input_tokens,
          output_tokens
        )
        values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        randomUUID(),
        workspaceId,
        requestId,
        providerResponse.provider,
        estimateCost(
          providerResponse.provider,
          providerResponse.inputTokens,
          providerResponse.outputTokens,
        ),
        providerResponse.inputTokens,
        providerResponse.outputTokens,
      ],
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'ai.redaction.preview',
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      entityType: 'ai_request',
      entityId: requestId,
      metadata: {
        classification: input.classification,
      },
    });

    return {
      redactedText: providerResponse.output.redactedText,
      entities: providerResponse.output.entities,
      reversible: true,
      mappingId,
    };
  }

  async getRequest(
    access: AccessContext,
    requestId: string,
  ): Promise<AiRequestSummary> {
    const row = await this.databaseService.one<RequestRow>(
      `
        select
          id,
          workspace_id,
          session_id,
          task_type,
          data_class,
          provider,
          model,
          route_reason,
          prompt_hash,
          response_hash,
          schema_version,
          prompt_version,
          status,
          error_code,
          latency_ms,
          input_tokens,
          output_tokens,
          cost_usd,
          created_at
        from app.ai_requests
        where workspace_id = $1
          and id = $2
      `,
      [access.activeWorkspace!.id, requestId],
    );

    if (!row) {
      throw new AppHttpException(
        'AI_REQUEST_NOT_FOUND',
        404,
        'AI request was not found.',
      );
    }

    return this.mapRequestRow(row);
  }

  async listRequestEvents(
    access: AccessContext,
    requestId: string,
  ): Promise<readonly AiRequestEvent[]> {
    await this.getRequest(access, requestId);

    const result = await this.databaseService.query<RequestEventRow>(
      `
        select id, request_id, type, payload, created_at
        from app.ai_request_events
        where workspace_id = $1
          and request_id = $2
        order by created_at asc
      `,
      [access.activeWorkspace!.id, requestId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      type: row.type,
      payload: row.payload ?? {},
      createdAt: row.created_at,
    }));
  }

  private async generateWorkflowResponse(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly policy: AiPolicyContext;
    readonly sessionId: string;
    readonly requestId: string;
    readonly dataClass: AiDataClass;
    readonly message: string;
    readonly mode: AiChatMode;
    readonly selection: SelectionContext;
    readonly meta: RequestMeta;
  }): Promise<AiChatResponse> {
    const providerDecision = this.resolveProviderDecision(
      input.dataClass,
      input.policy,
      'workflow_planning',
      input.selection.documents.length > 0,
    );
    const questions = this.buildClarificationQuestions(
      input.message,
      input.mode,
      input.selection,
    );
    const workflow = this.buildWorkflowDraft({
      message: input.message,
      selection: input.selection,
      dataClass: input.dataClass,
      route: providerDecision.route,
      mode: input.mode,
    });

    const validationReport = this.withClarificationIssues(
      createWorkflowValidationReport(workflow),
      questions,
    );
    const policyReport = createWorkflowPolicyReport(workflow, {
      dataClass: input.dataClass,
      allowedProviderRoutes: [providerDecision.route],
    });
    const runtimePlanPreview = compileRuntimePlanPreview(workflow, {
      dataClass: input.dataClass,
      allowedProviderRoutes: [providerDecision.route],
      availableConnections: input.selection.connections,
    });

    const adapter = this.aiProviderRegistry.get(providerDecision.provider);
    const providerResponse = await adapter.generateStructured({
      provider: providerDecision.provider,
      model: providerDecision.model,
      prompt: this.buildPlannerPrompt(
        input.message,
        input.selection,
        questions,
      ),
      schemaId: AI_SCHEMA_IDS.workflow,
      fallback: {
        workflow,
        warnings: policyReport.warnings,
      },
    });
    this.assertProviderResponseReady(providerDecision, providerResponse);

    await this.recordProviderCall(
      input.access.activeWorkspace!.id,
      input.requestId,
      providerDecision,
      providerResponse.latencyMs,
      input.message,
      providerResponse.output,
    );

    await this.completeAiRequest(input.requestId, {
      status: 'completed',
      provider: providerResponse.provider,
      model: providerResponse.model,
      routeReason: providerDecision.routeReason,
      responseHash: hashText(JSON.stringify(providerResponse.output)),
      schemaVersion: AI_SCHEMA_IDS.workflow,
      errorCode: null,
      latencyMs: providerResponse.latencyMs,
      inputTokens: providerResponse.inputTokens,
      outputTokens: providerResponse.outputTokens,
      costUsd: estimateCost(
        providerResponse.provider,
        providerResponse.inputTokens,
        providerResponse.outputTokens,
      ),
    });

    await this.recordUsage(
      input.access.activeWorkspace!.id,
      input.requestId,
      providerResponse.provider,
      providerResponse.inputTokens,
      providerResponse.outputTokens,
    );

    if (questions.length > 0) {
      const draft = await this.persistDraftVersion({
        workspaceId: input.access.activeWorkspace!.id,
        ownerId: input.actor.id,
        title: workflow.title,
        source: 'ai_chat',
        linkedSessionId: input.sessionId,
        linkedAutomationId: null,
        workflow,
        validationReport,
        policyReport,
        runtimePlanPreview,
        clarificationQuestions: questions,
        promptVersion: DEFAULT_PROMPT_VERSION,
        aiRequestId: input.requestId,
        status: 'clarification_required',
      });

      const response: ClarificationRequiredResponse = {
        status: 'clarification_required',
        sessionId: input.sessionId,
        messageId: randomUUID(),
        draftId: draft.id,
        questions,
        validationReport,
        policyReport,
      };

      const assistantMessageId = await this.insertAssistantMessage(
        input.access.activeWorkspace!.id,
        input.sessionId,
        response,
        input.policy,
        draft.id,
      );

      await this.recordRequestEvent(
        input.requestId,
        input.access.activeWorkspace!.id,
        'clarification_required',
        {
          draftId: draft.id,
          assistantMessageId,
          questions,
        },
      );

      return {
        ...response,
        messageId: assistantMessageId,
      };
    }

    const draft = await this.persistDraftVersion({
      workspaceId: input.access.activeWorkspace!.id,
      ownerId: input.actor.id,
      title: workflow.title,
      source: 'ai_chat',
      linkedSessionId: input.sessionId,
      linkedAutomationId: null,
      workflow,
      validationReport,
      policyReport,
      runtimePlanPreview,
      clarificationQuestions: [],
      promptVersion: DEFAULT_PROMPT_VERSION,
      aiRequestId: input.requestId,
      status: this.resolveDraftStatus(validationReport, policyReport, []),
    });

    const response: WorkflowDraftReadyResponse = {
      status: 'workflow_draft_ready',
      sessionId: input.sessionId,
      messageId: randomUUID(),
      draftId: draft.id,
      draftVersionId: draft.currentVersionId,
      workflow,
      validationReport,
      policyReport,
      runtimePlanPreview,
      warnings: [
        ...policyReport.warnings,
        ...validationReport.warnings.map((issue) => issue.message),
      ],
    };

    const assistantMessageId = await this.insertAssistantMessage(
      input.access.activeWorkspace!.id,
      input.sessionId,
      response,
      input.policy,
      draft.id,
    );

    await this.recordRequestEvent(
      input.requestId,
      input.access.activeWorkspace!.id,
      'workflow_draft_ready',
      {
        draftId: draft.id,
        assistantMessageId,
      },
    );

    await this.auditService.record({
      actorUserId: input.actor.id,
      actorEmail: input.actor.email,
      workspaceId: input.access.activeWorkspace!.id,
      action: 'ai.workflow.draft_generated',
      result: 'success',
      requestId: input.meta.requestId,
      traceId: input.meta.traceId,
      entityType: 'workflow_draft',
      entityId: draft.id,
      metadata: {
        sessionId: input.sessionId,
      },
    });

    return {
      ...response,
      messageId: assistantMessageId,
    };
  }

  private async generatePatchResponse(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly policy: AiPolicyContext;
    readonly sessionId: string;
    readonly requestId: string;
    readonly dataClass: AiDataClass;
    readonly instruction: string;
    readonly automationId: string;
    readonly baseVersionId: string;
    readonly selection: SelectionContext;
    readonly meta: RequestMeta;
  }): Promise<AiChatResponse> {
    const baseWorkflow = this.getBaseWorkflow(
      input.selection.automation?.workflow,
    );
    const providerDecision = this.resolveProviderDecision(
      input.dataClass,
      input.policy,
      'workflow_patch',
      input.selection.documents.length > 0,
    );
    const patch = this.buildWorkflowPatch(
      baseWorkflow,
      input.instruction,
      input.dataClass,
      providerDecision.route,
    );
    const validation = validateWorkflowPatch(patch, baseWorkflow);

    if (!validation.ok) {
      throw new AppHttpException(
        'AI_PROVIDER_ERROR',
        400,
        'Generated workflow patch is invalid.',
        {
          issues: validation.issues,
        },
      );
    }

    const adapter = this.aiProviderRegistry.get(providerDecision.provider);
    const providerResponse = await adapter.generateStructured({
      provider: providerDecision.provider,
      model: providerDecision.model,
      prompt: `${input.baseVersionId}\n${input.instruction}`,
      schemaId: AI_SCHEMA_IDS.workflowPatch,
      fallback: patch,
    });
    this.assertProviderResponseReady(providerDecision, providerResponse);

    const nextWorkflow = applyWorkflowPatch(
      baseWorkflow,
      providerResponse.output,
    );
    const validationReport = createWorkflowValidationReport(nextWorkflow);
    const policyReport = createWorkflowPolicyReport(nextWorkflow, {
      dataClass: input.dataClass,
      allowedProviderRoutes: [providerDecision.route],
    });
    const runtimePlanPreview = compileRuntimePlanPreview(nextWorkflow, {
      dataClass: input.dataClass,
      allowedProviderRoutes: [providerDecision.route],
      availableConnections: input.selection.connections,
    });
    const diff = generateWorkflowPatchDiff(
      baseWorkflow,
      providerResponse.output,
    );

    await this.recordProviderCall(
      input.access.activeWorkspace!.id,
      input.requestId,
      providerDecision,
      providerResponse.latencyMs,
      input.instruction,
      providerResponse.output,
    );

    await this.completeAiRequest(input.requestId, {
      status: 'completed',
      provider: providerResponse.provider,
      model: providerResponse.model,
      routeReason: providerDecision.routeReason,
      responseHash: hashText(JSON.stringify(providerResponse.output)),
      schemaVersion: AI_SCHEMA_IDS.workflowPatch,
      errorCode: null,
      latencyMs: providerResponse.latencyMs,
      inputTokens: providerResponse.inputTokens,
      outputTokens: providerResponse.outputTokens,
      costUsd: estimateCost(
        providerResponse.provider,
        providerResponse.inputTokens,
        providerResponse.outputTokens,
      ),
    });

    await this.recordUsage(
      input.access.activeWorkspace!.id,
      input.requestId,
      providerResponse.provider,
      providerResponse.inputTokens,
      providerResponse.outputTokens,
    );

    const draft = await this.persistDraftVersion({
      workspaceId: input.access.activeWorkspace!.id,
      ownerId: input.actor.id,
      title: nextWorkflow.title,
      source: 'ai_chat',
      linkedSessionId: input.sessionId,
      linkedAutomationId: input.automationId,
      workflow: nextWorkflow,
      validationReport,
      policyReport,
      runtimePlanPreview,
      clarificationQuestions: [],
      promptVersion: PATCH_PROMPT_VERSION,
      aiRequestId: input.requestId,
      status: this.resolveDraftStatus(validationReport, policyReport, []),
    });

    const patchId = await this.databaseService.one<{ readonly id: string }>(
      `
        insert into app.workflow_draft_patches (
          id,
          draft_id,
          workspace_id,
          automation_id,
          base_version_id,
          ai_request_id,
          patch,
          diff
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
        returning id
      `,
      [
        randomUUID(),
        draft.id,
        input.access.activeWorkspace!.id,
        input.automationId,
        input.baseVersionId,
        input.requestId,
        JSON.stringify(providerResponse.output),
        JSON.stringify(diff),
      ],
    );

    const response: WorkflowPatchReadyResponse = {
      status: 'patch_ready',
      sessionId: input.sessionId,
      messageId: randomUUID(),
      patchId: patchId?.id ?? randomUUID(),
      draftId: draft.id,
      patch: providerResponse.output,
      diff,
      validationReport,
      policyReport,
    };

    const assistantMessageId = await this.insertAssistantMessage(
      input.access.activeWorkspace!.id,
      input.sessionId,
      response,
      input.policy,
      draft.id,
    );

    await this.recordRequestEvent(
      input.requestId,
      input.access.activeWorkspace!.id,
      'patch_ready',
      {
        patchId: response.patchId,
        draftId: draft.id,
        assistantMessageId,
      },
    );

    await this.auditService.record({
      actorUserId: input.actor.id,
      actorEmail: input.actor.email,
      workspaceId: input.access.activeWorkspace!.id,
      action: 'ai.workflow.patch_generated',
      result: 'success',
      requestId: input.meta.requestId,
      traceId: input.meta.traceId,
      entityType: 'workflow_draft_patch',
      entityId: response.patchId,
      metadata: {
        automationId: input.automationId,
      },
    });

    return {
      ...response,
      messageId: assistantMessageId,
    };
  }

  private async finalizeBlockedResponse(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly policy: AiPolicyContext;
    readonly requestId: string;
    readonly sessionId: string;
    readonly dataClass: AiDataClass;
    readonly input: CreateAiChatMessageRequest;
    readonly policyBlock: {
      readonly reasonCode: string;
      readonly message: string;
    };
    readonly meta: RequestMeta;
  }): Promise<PolicyBlockedResponse> {
    const response: PolicyBlockedResponse = {
      status: 'blocked_by_policy',
      reasonCode: input.policyBlock.reasonCode,
      message: input.policyBlock.message,
      allowedActions: [
        'review_workspace_ai_policy',
        'switch_to_local_mock',
        'remove_sensitive_documents',
      ],
      policyReport: {
        valid: false,
        dataClass: input.dataClass,
        providerRoute: 'blocked',
        externalActionsRequireApproval: true,
        violations: [
          {
            code: input.policyBlock.reasonCode,
            message: input.policyBlock.message,
            action: 'block',
            path: '$.request',
          },
        ],
        warnings: [],
      },
    };

    await this.completeAiRequest(input.requestId, {
      status: 'blocked',
      provider: null,
      model: null,
      routeReason: input.policyBlock.reasonCode,
      responseHash: hashText(JSON.stringify(response)),
      schemaVersion: null,
      errorCode: input.policyBlock.reasonCode,
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    });

    await this.insertAssistantMessage(
      input.access.activeWorkspace!.id,
      input.sessionId,
      response,
      input.policy,
      null,
    );

    await this.recordRequestEvent(
      input.requestId,
      input.access.activeWorkspace!.id,
      'blocked_by_policy',
      response as unknown as Record<string, unknown>,
    );

    await this.recordFinalResponse(input.requestId, response);

    await this.auditService.record({
      actorUserId: input.actor.id,
      actorEmail: input.actor.email,
      workspaceId: input.access.activeWorkspace!.id,
      action: 'ai.chat.blocked',
      result: 'denied',
      requestId: input.meta.requestId,
      traceId: input.meta.traceId,
      entityType: 'ai_request',
      entityId: input.requestId,
      metadata: {
        reasonCode: input.policyBlock.reasonCode,
      },
    });

    return response;
  }

  private async persistDraftVersion(
    input: DraftPersistenceInput,
  ): Promise<WorkflowDraftDetail> {
    const draftId =
      input.existingDraftId ??
      (
        await this.databaseService.one<{ readonly id: string }>(
          `
            insert into app.workflow_drafts (
              id,
              workspace_id,
              owner_id,
              source,
              status,
              title,
              linked_automation_id,
              linked_session_id
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8)
            returning id
          `,
          [
            randomUUID(),
            input.workspaceId,
            input.ownerId,
            input.source,
            input.status,
            input.title,
            input.linkedAutomationId,
            input.linkedSessionId,
          ],
        )
      )?.id;

    if (!draftId) {
      throw new AppHttpException(
        'AI_DRAFT_NOT_FOUND',
        500,
        'Draft persistence failed.',
      );
    }

    const currentVersion = await this.databaseService.one<{
      readonly max_version: number | null;
    }>(
      `
        select max(version_no) as max_version
        from app.workflow_draft_versions
        where draft_id = $1
      `,
      [draftId],
    );
    const versionNo = (currentVersion?.max_version ?? 0) + 1;
    const versionId = randomUUID();

    await this.databaseService.query(
      `
        insert into app.workflow_draft_versions (
          id,
          draft_id,
          version_no,
          schema_version,
          prompt_version,
          ai_request_id,
          workflow,
          validation_report,
          policy_report,
          runtime_plan_preview
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb)
      `,
      [
        versionId,
        draftId,
        versionNo,
        input.workflow.schemaVersion,
        input.promptVersion,
        input.aiRequestId,
        JSON.stringify(input.workflow),
        JSON.stringify(input.validationReport),
        JSON.stringify(input.policyReport),
        JSON.stringify(input.runtimePlanPreview),
      ],
    );

    await this.databaseService.query(
      `
        insert into app.workflow_draft_validation_reports (
          id,
          draft_id,
          draft_version_id,
          workspace_id,
          validation_report
        )
        values ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        randomUUID(),
        draftId,
        versionId,
        input.workspaceId,
        JSON.stringify(input.validationReport),
      ],
    );

    await this.databaseService.query(
      `
        delete from app.workflow_draft_missing_fields
        where draft_id = $1
      `,
      [draftId],
    );

    for (const question of input.clarificationQuestions) {
      await this.databaseService.query(
        `
          insert into app.workflow_draft_missing_fields (
            id,
            draft_id,
            workspace_id,
            field,
            label,
            field_type,
            required,
            help_text,
            options,
            default_value
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
        `,
        [
          randomUUID(),
          draftId,
          input.workspaceId,
          question.field,
          question.label,
          question.type,
          question.required,
          question.helpText ?? null,
          JSON.stringify(question.options ?? []),
          JSON.stringify(question.defaultValue ?? null),
        ],
      );
    }

    await this.databaseService.query(
      `
        update app.workflow_drafts
        set
          status = $2,
          title = $3,
          current_version_id = $4,
          linked_automation_id = $5,
          linked_session_id = $6,
          updated_at = timezone('utc', now())
        where id = $1
      `,
      [
        draftId,
        input.status,
        input.title,
        versionId,
        input.linkedAutomationId,
        input.linkedSessionId,
      ],
    );

    const draftRow = await this.getDraftRow(input.workspaceId, draftId);
    return this.loadDraftDetailFromRow(draftRow);
  }

  private async loadDraftDetailFromRow(
    draftRow: DraftRow,
  ): Promise<WorkflowDraftDetail> {
    const [versionsResult, missingFieldsResult, patchRow] = await Promise.all([
      this.databaseService.query<DraftVersionRow>(
        `
          select
            id,
            draft_id,
            version_no,
            schema_version,
            prompt_version,
            ai_request_id,
            workflow,
            validation_report,
            policy_report,
            runtime_plan_preview,
            created_at
          from app.workflow_draft_versions
          where draft_id = $1
          order by version_no desc
        `,
        [draftRow.id],
      ),
      this.databaseService.query<MissingFieldRow>(
        `
          select
            field,
            label,
            field_type,
            required,
            help_text,
            options,
            default_value,
            answered_value
          from app.workflow_draft_missing_fields
          where draft_id = $1
          order by created_at asc
        `,
        [draftRow.id],
      ),
      this.databaseService.one<DraftPatchRow>(
        `
          select id, draft_id, patch, diff, created_at
          from app.workflow_draft_patches
          where draft_id = $1
          order by created_at desc
          limit 1
        `,
        [draftRow.id],
      ),
    ]);

    const versions = versionsResult.rows.map((row) =>
      this.mapDraftVersionRow(row),
    );
    const currentVersion =
      versions.find((version) => version.id === draftRow.current_version_id) ??
      versions[0];

    if (!currentVersion) {
      throw new AppHttpException(
        'AI_DRAFT_NOT_FOUND',
        404,
        'Workflow draft version was not found.',
      );
    }

    return {
      ...this.mapDraftRow(draftRow),
      workflow: currentVersion.workflow,
      validationReport: currentVersion.validationReport,
      policyReport: currentVersion.policyReport,
      runtimePlanPreview: currentVersion.runtimePlanPreview,
      versions,
      clarificationQuestions: missingFieldsResult.rows.map((row) => ({
        field: row.field,
        label: row.label,
        type: row.field_type,
        required: row.required,
        ...(row.help_text ? { helpText: row.help_text } : {}),
        ...(row.options && row.options.length > 0
          ? { options: row.options }
          : {}),
        ...(row.default_value !== null && row.default_value !== undefined
          ? { defaultValue: row.default_value }
          : {}),
      })),
      patch: patchRow?.patch ?? null,
      diff: patchRow?.diff ?? null,
    };
  }

  private async getSessionRow(
    workspaceId: string,
    sessionId: string,
  ): Promise<SessionRow> {
    const row = await this.databaseService.one<SessionRow>(
      `
        select
          id,
          workspace_id,
          source,
          mode,
          status,
          title,
          current_automation_id,
          selected_document_ids,
          selected_template_ids,
          selected_profile_id,
          content_storage_mode,
          allowed_modes,
          ai_policy_summary,
          last_message_at,
          created_at,
          updated_at
        from app.ai_chat_sessions
        where workspace_id = $1
          and id = $2
      `,
      [workspaceId, sessionId],
    );

    if (!row) {
      throw new AppHttpException(
        'AI_SESSION_NOT_FOUND',
        404,
        'AI chat session was not found.',
      );
    }

    return row;
  }

  private async getDraftRow(
    workspaceId: string,
    draftId: string,
  ): Promise<DraftRow> {
    const row = await this.databaseService.one<DraftRow>(
      `
        select
          id,
          workspace_id,
          owner_id,
          source,
          status,
          title,
          current_version_id,
          linked_automation_id,
          linked_session_id,
          updated_at,
          created_at
        from app.workflow_drafts
        where workspace_id = $1
          and id = $2
      `,
      [workspaceId, draftId],
    );

    if (!row) {
      throw new AppHttpException(
        'AI_DRAFT_NOT_FOUND',
        404,
        'Workflow draft was not found.',
      );
    }

    return row;
  }

  private mapSessionRow(row: SessionRow): AiChatSessionSummary {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      source: row.source,
      mode: row.mode,
      status: row.status,
      title: row.title,
      currentAutomationId: row.current_automation_id,
      selectedDocumentIds: row.selected_document_ids ?? [],
      selectedTemplateIds: row.selected_template_ids ?? [],
      selectedProfileId: row.selected_profile_id,
      contentStorageMode: row.content_storage_mode,
      allowedModes: row.allowed_modes ?? DEFAULT_ALLOWED_MODES,
      aiPolicySummary:
        row.ai_policy_summary ??
        buildSessionPolicySummary({
          aiEnabled: true,
          allowConfidential: true,
          allowLegalSecret: false,
          cometapiPublicEnabled: true,
          plaintextOptIn: false,
          sensitiveLogging: false,
          monthlyBudgetUsd: 0,
          requestsPerMinuteLimit: 0,
        }),
      lastMessageAt: row.last_message_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapMessageRow(row: MessageRow): AiChatMessageSummary {
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      responseType: row.response_type,
      contentText: row.content_text,
      contentPreview: row.content_preview,
      contentStorageMode: row.content_storage_mode,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    };
  }

  private mapDraftRow(row: DraftRow): WorkflowDraftSummary {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      ownerId: row.owner_id,
      source: row.source,
      status: row.status,
      title: row.title,
      currentVersionId: row.current_version_id,
      linkedAutomationId: row.linked_automation_id,
      linkedSessionId: row.linked_session_id,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
    };
  }

  private mapDraftVersionRow(
    row: DraftVersionRow,
  ): WorkflowDraftVersionSummary {
    return {
      id: row.id,
      draftId: row.draft_id,
      versionNo: row.version_no,
      schemaVersion: row.schema_version,
      promptVersion: row.prompt_version,
      aiRequestId: row.ai_request_id,
      workflow: row.workflow,
      validationReport: row.validation_report,
      policyReport: row.policy_report,
      runtimePlanPreview: row.runtime_plan_preview,
      createdAt: row.created_at,
    };
  }

  private mapRequestRow(row: RequestRow): AiRequestSummary {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      sessionId: row.session_id,
      taskType: row.task_type,
      dataClass: row.data_class,
      provider: row.provider,
      model: row.model,
      routeReason: row.route_reason,
      promptHash: row.prompt_hash,
      responseHash: row.response_hash,
      schemaVersion: row.schema_version,
      promptVersion: row.prompt_version,
      status: row.status,
      errorCode: row.error_code,
      latencyMs: row.latency_ms,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      costUsd: Number(row.cost_usd ?? 0),
      createdAt: row.created_at,
    };
  }

  private async insertSession(input: {
    readonly actor: AuthenticatedActor;
    readonly workspaceId: string;
    readonly policy: AiPolicyContext;
    readonly source: AiChatSource;
    readonly mode: AiChatMode;
    readonly title: string;
    readonly currentAutomationId: string | null;
    readonly selectedDocumentIds: readonly string[];
    readonly selectedTemplateIds: readonly string[];
    readonly selectedProfileId: string | null;
  }): Promise<string> {
    const result = await this.databaseService.one<{ readonly id: string }>(
      `
        insert into app.ai_chat_sessions (
          id,
          workspace_id,
          created_by_user_id,
          source,
          mode,
          status,
          title,
          current_automation_id,
          selected_document_ids,
          selected_template_ids,
          selected_profile_id,
          content_storage_mode,
          allowed_modes,
          ai_policy_summary
        )
        values ($1, $2, $3, $4, $5, 'active', $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12::jsonb, $13::jsonb)
        returning id
      `,
      [
        randomUUID(),
        input.workspaceId,
        input.actor.id,
        input.source,
        input.mode,
        input.title,
        input.currentAutomationId,
        JSON.stringify(input.selectedDocumentIds),
        JSON.stringify(input.selectedTemplateIds),
        input.selectedProfileId,
        this.resolveStorageMode(input.policy),
        JSON.stringify(this.allowedModesForSource(input.source)),
        JSON.stringify(buildSessionPolicySummary(input.policy)),
      ],
    );

    if (!result) {
      throw new AppHttpException(
        'AI_SESSION_NOT_FOUND',
        500,
        'Failed to create AI chat session.',
      );
    }

    return result.id;
  }

  private async updateSessionContext(
    workspaceId: string,
    sessionId: string,
    input: {
      readonly mode: AiChatMode;
      readonly title: string;
      readonly currentAutomationId: string | null;
      readonly selectedDocumentIds: readonly string[];
      readonly selectedTemplateIds: readonly string[];
      readonly selectedProfileId: string | null;
    },
  ): Promise<void> {
    await this.databaseService.query(
      `
        update app.ai_chat_sessions
        set
          mode = $3,
          title = $4,
          current_automation_id = $5,
          selected_document_ids = $6::jsonb,
          selected_template_ids = $7::jsonb,
          selected_profile_id = $8,
          updated_at = timezone('utc', now())
        where workspace_id = $1
          and id = $2
      `,
      [
        workspaceId,
        sessionId,
        input.mode,
        input.title,
        input.currentAutomationId,
        JSON.stringify(input.selectedDocumentIds),
        JSON.stringify(input.selectedTemplateIds),
        input.selectedProfileId,
      ],
    );
  }

  private async createAiRequest(input: {
    readonly workspaceId: string;
    readonly sessionId: string | null;
    readonly taskType: AiRequestSummary['taskType'];
    readonly dataClass: AiDataClass;
    readonly prompt: string;
    readonly promptVersion: string;
    readonly requestPayload: Record<string, unknown>;
    readonly idempotencyKey: string | null;
  }): Promise<string> {
    const requestId = randomUUID();

    await this.databaseService.query(
      `
        insert into app.ai_requests (
          id,
          workspace_id,
          session_id,
          task_type,
          data_class,
          route_reason,
          prompt_hash,
          prompt_version,
          status,
          request_payload,
          idempotency_key
        )
        values ($1, $2, $3, $4, $5, 'queued', $6, $7, 'queued', $8::jsonb, $9)
      `,
      [
        requestId,
        input.workspaceId,
        input.sessionId,
        input.taskType,
        input.dataClass,
        hashText(input.prompt),
        input.promptVersion,
        JSON.stringify(input.requestPayload),
        input.idempotencyKey,
      ],
    );

    await this.recordRequestEvent(requestId, input.workspaceId, 'queued', {
      requestId,
      taskType: input.taskType,
    });

    return requestId;
  }

  private async completeAiRequest(
    requestId: string,
    input: {
      readonly status: AiRequestSummary['status'];
      readonly provider: AiProvider | null;
      readonly model: string | null;
      readonly routeReason: string;
      readonly responseHash: string | null;
      readonly schemaVersion: string | null;
      readonly errorCode: string | null;
      readonly latencyMs: number;
      readonly inputTokens: number;
      readonly outputTokens: number;
      readonly costUsd: number;
    },
  ): Promise<void> {
    await this.databaseService.query(
      `
        update app.ai_requests
        set
          provider = $2,
          model = $3,
          route_reason = $4,
          response_hash = $5,
          schema_version = $6,
          status = $7,
          error_code = $8,
          latency_ms = $9,
          input_tokens = $10,
          output_tokens = $11,
          cost_usd = $12,
          updated_at = timezone('utc', now())
        where id = $1
      `,
      [
        requestId,
        input.provider,
        input.model,
        input.routeReason,
        input.responseHash,
        input.schemaVersion,
        input.status,
        input.errorCode,
        input.latencyMs,
        input.inputTokens,
        input.outputTokens,
        input.costUsd,
      ],
    );
  }

  private async recordRequestEvent(
    requestId: string,
    workspaceId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.databaseService.query(
      `
        insert into app.ai_request_events (
          id,
          request_id,
          workspace_id,
          type,
          payload
        )
        values ($1, $2, $3, $4, $5::jsonb)
      `,
      [randomUUID(), requestId, workspaceId, type, JSON.stringify(payload)],
    );
  }

  private async recordFinalResponse(
    requestId: string,
    response: AiChatResponse,
  ): Promise<void> {
    const request = await this.databaseService.one<{
      readonly workspace_id: string;
    }>(
      `
        select workspace_id
        from app.ai_requests
        where id = $1
      `,
      [requestId],
    );

    if (!request) {
      return;
    }

    await this.recordRequestEvent(
      requestId,
      request.workspace_id,
      'final_response',
      response as unknown as Record<string, unknown>,
    );
  }

  private async findIdempotentResponse(
    workspaceId: string,
    sessionId: string,
    idempotencyKey: string | null,
  ): Promise<AiChatResponse | null> {
    if (!idempotencyKey) {
      return null;
    }

    const row = await this.databaseService.one<{
      readonly id: string;
      readonly workspace_id: string;
    }>(
      `
        select id, workspace_id
        from app.ai_requests
        where workspace_id = $1
          and session_id = $2
          and idempotency_key = $3
        order by created_at desc
        limit 1
      `,
      [workspaceId, sessionId, idempotencyKey],
    );

    if (!row) {
      return null;
    }

    const event = await this.databaseService.one<RequestEventRow>(
      `
        select id, request_id, type, payload, created_at
        from app.ai_request_events
        where request_id = $1
          and type = 'final_response'
        order by created_at desc
        limit 1
      `,
      [row.id],
    );

    return (event?.payload as AiChatResponse | undefined) ?? null;
  }

  private async insertMessage(input: {
    readonly workspaceId: string;
    readonly sessionId: string;
    readonly role: AiChatMessageSummary['role'];
    readonly responseType: AiMessageResponseType | null;
    readonly content: string;
    readonly contentStorageMode: AiChatMessageSummary['contentStorageMode'];
    readonly metadata: Record<string, unknown>;
    readonly actorUserId: string | null;
  }): Promise<string> {
    const messageId = randomUUID();

    await this.databaseService.query(
      `
        insert into app.ai_chat_messages (
          id,
          session_id,
          workspace_id,
          created_by_user_id,
          role,
          response_type,
          content_text,
          content_preview,
          content_storage_mode,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      `,
      [
        messageId,
        input.sessionId,
        input.workspaceId,
        input.actorUserId,
        input.role,
        input.responseType,
        input.contentStorageMode === 'plaintext_allowed' ? input.content : null,
        safePreview(input.content),
        input.contentStorageMode,
        JSON.stringify({
          ...input.metadata,
          contentHash: hashText(input.content),
        }),
      ],
    );

    await this.databaseService.query(
      `
        update app.ai_chat_sessions
        set
          last_message_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        where id = $1
      `,
      [input.sessionId],
    );

    return messageId;
  }

  private async insertAssistantMessage(
    workspaceId: string,
    sessionId: string,
    response: AiChatResponse,
    policy: AiPolicyContext,
    draftId: string | null,
  ): Promise<string> {
    return this.insertMessage({
      workspaceId,
      sessionId,
      role: 'assistant',
      responseType: response.status === 'error' ? 'error' : response.status,
      content: summarizeAiResponse(response),
      contentStorageMode: this.resolveStorageMode(policy),
      metadata: {
        draftId,
        response,
      },
      actorUserId: null,
    });
  }

  private async recordProviderCall(
    workspaceId: string,
    requestId: string,
    providerDecision: ProviderDecision,
    latencyMs: number,
    prompt: string,
    output: unknown,
  ): Promise<void> {
    await this.databaseService.query(
      `
        insert into app.ai_provider_calls (
          id,
          ai_request_id,
          workspace_id,
          provider,
          route,
          model,
          request_hash,
          response_hash,
          status,
          latency_ms
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', $9)
      `,
      [
        randomUUID(),
        requestId,
        workspaceId,
        providerDecision.provider,
        providerDecision.route,
        providerDecision.model,
        hashText(prompt),
        hashText(JSON.stringify(output)),
        latencyMs,
      ],
    );
  }

  private async recordUsage(
    workspaceId: string,
    requestId: string,
    provider: AiProvider,
    inputTokens: number,
    outputTokens: number,
  ): Promise<void> {
    await this.databaseService.query(
      `
        insert into app.ai_cost_usage (
          id,
          workspace_id,
          ai_request_id,
          provider,
          cost_usd,
          input_tokens,
          output_tokens
        )
        values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        randomUUID(),
        workspaceId,
        requestId,
        provider,
        estimateCost(provider, inputTokens, outputTokens),
        inputTokens,
        outputTokens,
      ],
    );
  }

  private async loadSelectionContext(
    workspaceId: string,
    input: {
      readonly documentIds: readonly string[];
      readonly templateIds: readonly string[];
      readonly profileId: string | null;
      readonly automationId: string | null;
    },
  ): Promise<SelectionContext> {
    const [documents, templates, profile, automation, modules, connections] =
      await Promise.all([
        input.documentIds.length > 0
          ? this.databaseService
              .query<DocumentContextRow>(
                `
                  select id::text as id, title, classification::text as classification, kind::text as kind
                  from app.documents
                  where workspace_id = $1
                    and deleted_at is null
                    and id::text = any($2::text[])
                `,
                [workspaceId, input.documentIds],
              )
              .then((result) => result.rows)
          : Promise.resolve([] as DocumentContextRow[]),
        input.templateIds.length > 0
          ? this.databaseService
              .query<TemplateContextRow>(
                `
                  select id::text as id, title, code, category, description
                  from app.automation_templates
                  where deleted_at is null
                    and (workspace_id = $1 or workspace_id is null)
                    and id::text = any($2::text[])
                `,
                [workspaceId, input.templateIds],
              )
              .then((result) => result.rows)
          : Promise.resolve([] as TemplateContextRow[]),
        input.profileId
          ? this.databaseService.one<ProfileContextRow>(
              `
                select id::text as id, full_name, email
                from app.profiles
                where id::text = $1
              `,
              [input.profileId],
            )
          : Promise.resolve(null),
        input.automationId
          ? this.databaseService.one<AutomationContextRow>(
              `
                select id::text as id, title, version, workflow
                from app.installed_automations
                where workspace_id = $1
                  and deleted_at is null
                  and id::text = $2
              `,
              [workspaceId, input.automationId],
            )
          : Promise.resolve(null),
        this.databaseService
          .query<ModuleContextRow>(
            `
              select code, title, category
              from app.legal_modules
              where deleted_at is null
                and current_status in ('draft', 'published')
              order by code asc
              limit 50
            `,
          )
          .then((result) => result.rows),
        this.loadRuntimeConnections(workspaceId),
      ]);

    return {
      documents,
      templates,
      profile,
      automation,
      modules,
      connections,
    };
  }

  private async loadRuntimeConnections(workspaceId: string): Promise<string[]> {
    const result = await this.databaseService.query<{ readonly code: string }>(
      `
        select code
        from app.runtime_connections
        where workspace_id = $1
          and status = 'connected'
      `,
      [workspaceId],
    );

    return result.rows.map((row) => row.code);
  }

  private deriveSource(input: CreateAiChatMessageRequest): AiChatSource {
    if (input.currentAutomationId) {
      return 'automation_chat';
    }

    if ((input.selectedDocumentIds?.length ?? 0) > 0) {
      return 'document_chat';
    }

    return 'global_chat';
  }

  private allowedModesForSource(source: AiChatSource): readonly AiChatMode[] {
    return source === 'document_chat'
      ? EXTRACT_ALLOWED_MODES
      : DEFAULT_ALLOWED_MODES;
  }

  private deriveDataClass(selection: SelectionContext): AiDataClass {
    const classifications = new Set(
      selection.documents.map((document) => document.classification),
    );

    if (classifications.has('legal_secret')) {
      return 'C_LEGAL_SECRET';
    }

    if (
      classifications.has('confidential') ||
      classifications.has('personal_data') ||
      classifications.has('client_material')
    ) {
      return 'C_CONFIDENTIAL_CLIENT';
    }

    if (selection.documents.length === 0 && selection.templates.length > 0) {
      return 'A_TEMPLATE_NON_SENSITIVE';
    }

    if (classifications.has('internal')) {
      return 'B_INTERNAL_WORKSPACE';
    }

    if (selection.documents.length > 0) {
      return 'A_PUBLIC';
    }

    return 'B_INTERNAL_WORKSPACE';
  }

  private inferWorkflowDataClass(workflow: LexFrameWorkflow): AiDataClass {
    const labels = new Set(workflow.securityLabels);
    const inputClasses = workflow.inputs.map((input) => input.dataClass);

    if (
      labels.has('legal_secret') ||
      inputClasses.includes('legal_secret') ||
      inputClasses.includes('C_LEGAL_SECRET')
    ) {
      return 'C_LEGAL_SECRET';
    }

    if (
      labels.has('contains_confidential_documents') ||
      inputClasses.includes('confidential') ||
      inputClasses.includes('client_material') ||
      inputClasses.includes('personal_data') ||
      inputClasses.includes('C_CONFIDENTIAL_CLIENT')
    ) {
      return 'C_CONFIDENTIAL_CLIENT';
    }

    if (
      inputClasses.includes('internal') ||
      inputClasses.includes('B_INTERNAL_WORKSPACE')
    ) {
      return 'B_INTERNAL_WORKSPACE';
    }

    return 'A_PUBLIC';
  }

  private resolveProviderDecision(
    dataClass: AiDataClass,
    policy: AiPolicyContext,
    taskType: AiRequestSummary['taskType'],
    hasDocuments: boolean,
  ): ProviderDecision {
    if (dataClass === 'D_AI_EXTERNAL_FORBIDDEN') {
      return {
        route: 'local_mock',
        provider: 'local',
        model: 'local-mock',
        routeReason: 'workspace_forces_local_processing',
      };
    }

    if (this.env.AI_PROVIDER_MODE === 'mock') {
      return {
        route: 'local_mock',
        provider: 'local',
        model: 'local-mock',
        routeReason: 'provider_mode_mock',
      };
    }

    if (
      dataClass === 'C_CONFIDENTIAL_CLIENT' ||
      dataClass === 'C_LEGAL_SECRET'
    ) {
      return {
        route: 'xai_zdr',
        provider: 'xai',
        model: 'grok-4-fast-reasoning',
        routeReason: 'sensitive_workload_uses_zdr_route',
      };
    }

    if (
      !hasDocuments &&
      taskType === 'field_extraction' &&
      policy.cometapiPublicEnabled &&
      (dataClass === 'A_PUBLIC' || dataClass === 'B_ANONYMIZED_LEGAL')
    ) {
      return {
        route: 'cometapi',
        provider: 'cometapi',
        model: 'comet-structured-v1',
        routeReason: 'public_redaction_preview_allows_cometapi',
      };
    }

    return {
      route: 'xai',
      provider: 'xai',
      model: 'grok-4-fast-reasoning',
      routeReason: 'default_structured_planner_route',
    };
  }

  private assertProviderResponseReady(
    providerDecision: ProviderDecision,
    providerResponse: {
      readonly usedFallback: boolean;
      readonly provider: AiProvider;
      readonly model: string;
    },
  ) {
    if (
      providerDecision.provider !== 'local' &&
      providerResponse.usedFallback
    ) {
      throw new AppHttpException(
        'AI_GATEWAY_NOT_READY',
        503,
        'External AI provider returned a fallback response instead of a live structured output.',
        {
          provider: providerResponse.provider,
          model: providerResponse.model,
          route: providerDecision.route,
          routeReason: providerDecision.routeReason,
        },
      );
    }
  }

  private checkSensitiveAccess(
    access: AccessContext,
    policy: AiPolicyContext,
    dataClass: AiDataClass,
  ): { readonly reasonCode: string; readonly message: string } | null {
    const permissions = new Set(access.permissions);

    if (dataClass === 'C_CONFIDENTIAL_CLIENT') {
      if (!policy.allowConfidential) {
        return {
          reasonCode: 'confidential_ai_disabled',
          message: 'Workspace policy blocks confidential AI processing.',
        };
      }

      if (!permissions.has('ai.use_confidential')) {
        return {
          reasonCode: 'missing_confidential_permission',
          message:
            'The current actor cannot use AI with confidential materials.',
        };
      }
    }

    if (dataClass === 'C_LEGAL_SECRET') {
      if (!policy.allowLegalSecret) {
        return {
          reasonCode: 'legal_secret_ai_disabled',
          message: 'Workspace policy blocks legal secret AI processing.',
        };
      }

      if (!permissions.has('ai.use_legal_secret')) {
        return {
          reasonCode: 'missing_legal_secret_permission',
          message:
            'The current actor cannot use AI with legal secret materials.',
        };
      }
    }

    return null;
  }

  private buildClarificationQuestions(
    message: string,
    mode: AiChatMode,
    selection: SelectionContext,
  ): readonly AiClarificationQuestion[] {
    const questions: AiClarificationQuestion[] = [];
    const needsTemplate =
      /claim|template|letter|pretrial|pretens|docx|draft/i.test(message) ||
      mode === 'create_workflow';

    if (mode !== 'modify_workflow' && selection.documents.length === 0) {
      questions.push({
        field: 'selected_documents',
        label: 'Choose at least one source document',
        type: 'document',
        required: true,
        helpText:
          'The planner needs canonical document entities, not raw storage keys.',
      });
    }

    if (needsTemplate && selection.templates.length === 0) {
      questions.push({
        field: 'selected_template',
        label: 'Choose a draft template',
        type: 'template',
        required: true,
        helpText:
          'Templates keep the generated workflow aligned with the approved document form.',
      });
    }

    if (/delivery|email|send|client/i.test(message) && !selection.profile) {
      questions.push({
        field: 'selected_profile',
        label: 'Choose the responsible profile',
        type: 'profile',
        required: false,
        helpText:
          'Profile context controls the sender identity and review path.',
      });
    }

    return questions;
  }

  private withClarificationIssues(
    report: WorkflowValidationReport,
    questions: readonly AiClarificationQuestion[],
  ): WorkflowValidationReport {
    if (questions.length === 0) {
      return report;
    }

    return {
      valid: false,
      blockingErrors: [
        ...report.blockingErrors,
        ...questions.map((question) => ({
          code: `missing_${question.field}`,
          path: `$.inputs.${question.field}`,
          message: `Missing required input: ${question.label}`,
          severity: 'error' as const,
        })),
      ],
      warnings: report.warnings,
      infos: report.infos,
    };
  }

  private resolveDraftStatus(
    validationReport: WorkflowValidationReport,
    policyReport: WorkflowPolicyReport,
    questions: readonly AiClarificationQuestion[],
  ): WorkflowDraftStatus {
    if (questions.length > 0) {
      return 'clarification_required';
    }

    if (!validationReport.valid || !policyReport.valid) {
      return 'validation_failed';
    }

    return 'ready_for_review';
  }

  private buildWorkflowDraft(input: {
    readonly message: string;
    readonly selection: SelectionContext;
    readonly dataClass: AiDataClass;
    readonly route: AiProviderRoute;
    readonly mode: AiChatMode;
  }): LexFrameWorkflow {
    const workflow = cloneWorkflow(aiWorkflowFixture);
    const preferredTemplate = input.selection.templates[0] ?? null;
    const preferredProfile = input.selection.profile;
    const baseAnalyzeStep = workflow.steps[0];
    const baseSearchStep = workflow.steps[1];
    const baseGenerateStep = workflow.steps[2];
    const baseDeliveryStep = workflow.steps[3];

    if (
      !baseAnalyzeStep ||
      !baseSearchStep ||
      !baseGenerateStep ||
      !baseDeliveryStep
    ) {
      return workflow;
    }

    return {
      ...workflow,
      id: `wf_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
      title: this.deriveTitle(input.message, workflow.title),
      description: `AI planner draft for: ${safePreview(input.message, 180)}`,
      intent: input.message,
      practiceArea: preferredTemplate?.category ?? workflow.practiceArea,
      securityLabels: buildSecurityLabels(input.dataClass),
      metadata: {
        ...(workflow.metadata ?? {}),
        plannerContext: {
          documents: input.selection.documents.map((document) => ({
            id: document.id,
            title: document.title,
            classification: document.classification,
          })),
          templates: input.selection.templates.map((template) => ({
            id: template.id,
            title: template.title,
            code: template.code,
          })),
          profile: preferredProfile
            ? {
                id: preferredProfile.id,
                email: preferredProfile.email,
              }
            : null,
          moduleCodes: input.selection.modules.map((module) => module.code),
        },
      },
      inputs: [
        {
          inputId: 'case_documents',
          label: 'Source documents',
          type: 'document[]',
          required: true,
          source: 'user_selection',
          dataClass: mapAiDataClassToInputClass(input.dataClass),
        },
        {
          inputId: 'claim_template',
          label: preferredTemplate?.title ?? 'Draft template',
          type: 'template',
          required: true,
          source: 'template',
          dataClass:
            preferredTemplate === null
              ? 'internal'
              : preferredTemplate.code.includes('public')
                ? 'public'
                : 'internal',
        },
      ],
      outputs: [
        {
          outputId: 'pretrial_claim_doc',
          label: 'Generated document draft',
          type: 'document',
          format: 'docx',
        },
        {
          outputId: 'client_email_draft',
          label: 'Reviewable delivery note',
          type: 'message',
          format: 'email',
        },
      ],
      steps: [
        {
          ...baseAnalyzeStep,
          title: 'Analyze source documents',
          description: buildDocumentAnalysisDescription(
            input.selection.documents,
          ),
          inputBindings: {
            documents: '$inputs.case_documents',
          },
          dataPolicy: {
            ...baseAnalyzeStep.dataPolicy,
            maxClass: mapAiDataClassToInputClass(input.dataClass),
            allowedAiRoutes: withRoute(
              baseAnalyzeStep.dataPolicy.allowedAiRoutes,
              input.route,
            ),
          },
        },
        {
          ...baseSearchStep,
          title: 'Search legal practice',
          description:
            input.selection.modules.length > 0
              ? `Cross-check facts with available legal modules (${input.selection.modules.length} available).`
              : 'Cross-check facts with available legal modules.',
          dataPolicy: {
            ...baseSearchStep.dataPolicy,
            allowedAiRoutes: withRoute(
              baseSearchStep.dataPolicy.allowedAiRoutes,
              input.route,
            ),
          },
        },
        {
          ...baseGenerateStep,
          moduleCode:
            input.mode === 'explain_workflow'
              ? 'document.template-apply'
              : baseGenerateStep.moduleCode,
          title:
            input.mode === 'explain_workflow'
              ? 'Apply approved template'
              : 'Generate review draft',
          description:
            preferredTemplate !== null
              ? `Prepare the primary draft using template ${preferredTemplate.title}.`
              : 'Prepare the primary draft using the selected template.',
          inputBindings: {
            facts: '$state.case_facts',
            practice: '$state.practice_digest',
            templateId: '$inputs.claim_template',
          },
          dataPolicy: {
            ...baseGenerateStep.dataPolicy,
            maxClass: mapAiDataClassToInputClass(input.dataClass),
            allowedAiRoutes: withRoute(
              baseGenerateStep.dataPolicy.allowedAiRoutes,
              input.route,
            ),
          },
        },
        {
          ...baseDeliveryStep,
          title: preferredProfile
            ? `Prepare delivery note for ${preferredProfile.email}`
            : 'Prepare delivery note',
          description:
            'Prepare a reviewable delivery step. No external message is sent automatically.',
          dataPolicy: {
            ...baseDeliveryStep.dataPolicy,
            maxClass: mapAiDataClassToInputClass(input.dataClass),
            allowedAiRoutes: withRoute(
              baseDeliveryStep.dataPolicy.allowedAiRoutes,
              input.route,
            ),
          },
        },
      ],
    };
  }

  private buildWorkflowPatch(
    baseWorkflow: LexFrameWorkflow,
    instruction: string,
    dataClass: AiDataClass,
    route: AiProviderRoute,
  ): LexFrameWorkflowPatch {
    const normalizedInstruction = instruction.toLowerCase();
    const operations: Array<LexFrameWorkflowPatch['operations'][number]> = [];

    if (
      /email|delivery|client/i.test(normalizedInstruction) &&
      !baseWorkflow.steps.some(
        (step) => step.moduleCode === 'delivery.email-draft',
      )
    ) {
      operations.push({
        op: 'add_step',
        afterStepId: baseWorkflow.steps.at(-1)?.stepId ?? null,
        step: {
          stepId: `patch_${randomUUID().replace(/-/g, '').slice(0, 8)}`,
          moduleCode: 'delivery.email-draft',
          moduleVersion: 'v1',
          title: 'Prepare delivery note',
          description:
            'Create a delivery note that still requires manual approval.',
          kind: 'deliver',
          inputBindings: {
            document: '$outputs.pretrial_claim_doc',
          },
          outputBindings: {
            emailDraft: '$outputs.client_email_draft',
          },
          requiresApproval: true,
          dataPolicy: {
            maxClass: mapAiDataClassToInputClass(dataClass),
            allowedAiRoutes: [route],
          },
          runtime: {
            requiredPiece: '@lexframe/email-delivery',
            requiredConnection: 'gmail',
          },
          onError: {
            strategy: 'stop_and_ask_user',
            message: 'Delivery note generation needs operator review.',
          },
        },
      });
    } else {
      const targetStep =
        baseWorkflow.steps.find((step) => step.kind === 'generate') ??
        baseWorkflow.steps[0];

      if (!targetStep) {
        return {
          patchVersion: 'lexframe.workflow_patch.v1',
          baseWorkflowVersionId: `automation:${baseWorkflow.id}`,
          operations,
          explanation: instruction,
          riskChange: 'none',
        };
      }

      operations.push({
        op: 'update_step',
        stepId: targetStep.stepId,
        changes: {
          description: `${targetStep.description} Additional instruction: ${safePreview(instruction, 120)}.`,
          dataPolicy: {
            ...targetStep.dataPolicy,
            allowedAiRoutes: withRoute(
              targetStep.dataPolicy.allowedAiRoutes,
              route,
            ),
          },
        },
      });
    }

    return {
      patchVersion: 'lexframe.workflow_patch.v1',
      baseWorkflowVersionId: `automation:${baseWorkflow.id}`,
      operations,
      explanation: instruction,
      riskChange: /send|deliver|external|email/i.test(normalizedInstruction)
        ? 'medium_to_high'
        : 'none',
    };
  }

  private getBaseWorkflow(
    workflow: Record<string, unknown> | undefined | null,
  ): LexFrameWorkflow {
    if (!workflow || typeof workflow !== 'object') {
      return cloneWorkflow(aiWorkflowFixture);
    }

    try {
      return cloneWorkflow(workflow as unknown as LexFrameWorkflow);
    } catch {
      return cloneWorkflow(aiWorkflowFixture);
    }
  }

  private buildPlannerPrompt(
    message: string,
    selection: SelectionContext,
    questions: readonly AiClarificationQuestion[],
  ): string {
    return renderPlannerUserPrompt({
      message,
      documents: selection.documents.map((document) => ({
        id: document.id,
        title: document.title,
        classification: document.classification,
      })),
      templates: selection.templates.map((template) => ({
        id: template.id,
        title: template.title,
        code: template.code,
      })),
      profile: selection.profile,
      questions,
    });
  }

  private redactText(
    text: string,
    redactionPolicy: AiRedactionPreviewRequest['redactionPolicy'],
  ): {
    readonly redactedText: string;
    readonly entities: readonly AiRedactionEntity[];
  } {
    const entities: AiRedactionEntity[] = [];
    let redactedText = text;

    const patterns = [
      {
        type: 'EMAIL',
        regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu,
      },
      {
        type: 'PHONE',
        regex: /\+?\d[\d\s().-]{8,}\d/gu,
      },
      {
        type: 'PERSON',
        regex:
          redactionPolicy === 'strict'
            ? /\b[\p{Lu}][\p{L}-]+(?:\s+[\p{Lu}][\p{L}-]+){1,2}\b/gu
            : /\b[\p{Lu}][\p{L}-]+\s+[\p{Lu}][\p{L}-]+\b/gu,
      },
    ] as const;

    for (const { type, regex } of patterns) {
      const matches = [...redactedText.matchAll(regex)];
      let index = 1;

      for (const match of matches) {
        const value = match[0];
        const placeholder = `<${type}_${index}>`;
        index += 1;
        redactedText = redactedText.replace(value, placeholder);
        entities.push({
          placeholder,
          type,
          hash: hashText(value),
          confidence: 0.9,
        });
      }
    }

    return {
      redactedText,
      entities,
    };
  }

  private deriveTitle(message: string, fallback: string): string {
    const sanitized = message.trim().replace(/\s+/g, ' ');
    if (sanitized.length === 0) {
      return fallback;
    }

    return sanitized.slice(0, 72);
  }

  private resolveStorageMode(
    policy: AiPolicyContext,
  ): AiChatSessionSummary['contentStorageMode'] {
    return policy.plaintextOptIn ? 'plaintext_allowed' : 'metadata_only';
  }

  private async getLatestUserMessage(
    sessionId: string,
  ): Promise<AiChatMessageSummary | null> {
    const row = await this.databaseService.one<MessageRow>(
      `
        select
          id,
          session_id,
          role,
          response_type,
          content_text,
          content_preview,
          content_storage_mode,
          metadata,
          created_at
        from app.ai_chat_messages
        where session_id = $1
          and role = 'user'
        order by created_at desc
        limit 1
      `,
      [sessionId],
    );

    return row ? this.mapMessageRow(row) : null;
  }
}
