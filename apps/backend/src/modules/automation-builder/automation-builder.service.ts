import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import type {
  AutomationBlueprint,
  AutomationBlueprintStatus,
  AutomationCanvasDraftResponse,
  AutomationCompilePreviewResponse,
  AutomationDataClassification,
  AutomationIntent,
  AutomationIntentResponse,
  AutomationIntentSource,
  AutomationIntentStatus,
  AutomationPlanResponse,
  AutomationRuntimeDraftResponse,
  CreateAutomationIntentRequest,
  UpdateAutomationIntentRequest,
} from '@lexframe/contracts';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { getCanvasBlockDefinitions } from '@lexframe/workflow-dsl';
import { AiRouteGroupResolverService } from '../ai-gateway/ai-route-group-resolver.service';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { AutomationBlueprintCanvasConverterService } from './automation-blueprint-canvas-converter.service';
import { AutomationBlueprintValidatorService } from './automation-blueprint-validator.service';
import { AutomationContextAssemblerService } from './automation-context-assembler.service';
import { getAutomationPlannerPromptHash } from './automation-planner-prompts';
import { AutomationRuntimeDraftService } from './automation-runtime-draft.service';

interface RequestMeta {
  readonly requestId: string | null;
  readonly traceId: string | null;
}

interface IntentRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly project_id: string | null;
  readonly source: AutomationIntentSource;
  readonly source_thread_id: string | null;
  readonly source_message_id: string | null;
  readonly title: string | null;
  readonly user_goal: string;
  readonly status: AutomationIntentStatus;
  readonly classification: AutomationDataClassification;
  readonly created_by: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface BlueprintRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly current_version_id: string | null;
  readonly status: AutomationBlueprintStatus;
  readonly blueprint: AutomationBlueprint | null;
}

@Injectable()
export class AutomationBuilderService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly routeGroupResolver: AiRouteGroupResolverService,
    private readonly contextAssembler: AutomationContextAssemblerService,
    private readonly validator: AutomationBlueprintValidatorService,
    private readonly canvasConverter: AutomationBlueprintCanvasConverterService,
    private readonly runtimeDraftService: AutomationRuntimeDraftService,
  ) {}

  async createIntent(
    actor: AuthenticatedActor,
    access: AccessContext,
    projectId: string,
    input: CreateAutomationIntentRequest,
    meta: RequestMeta,
  ): Promise<AutomationIntentResponse> {
    const workspaceId = requireWorkspace(access);
    const intentId = randomUUID();
    const classification = input.classification ?? 'workspace_internal';
    const source = input.source ?? 'automation_builder_page';
    const title = input.title ?? input.userGoal.slice(0, 120);
    const row = await this.databaseService.one<IntentRow>(
      `
        insert into app.automation_intents (
          id,
          workspace_id,
          project_id,
          source,
          source_thread_id,
          source_message_id,
          title,
          user_goal,
          status,
          classification,
          created_by,
          updated_by
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, 'created', $9, $10, $10)
        returning
          id,
          workspace_id,
          project_id,
          source,
          source_thread_id,
          source_message_id,
          title,
          user_goal,
          status,
          classification,
          created_by::text,
          created_at::text,
          updated_at::text
      `,
      [
        intentId,
        workspaceId,
        projectId,
        source,
        input.sourceThreadId ?? null,
        input.sourceMessageId ?? null,
        title,
        input.userGoal,
        classification,
        actor.id,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        500,
        'Automation intent was not created.',
      );
    }

    await this.audit(actor, workspaceId, 'automation_builder.intent.created', {
      entityId: intentId,
      result: 'success',
      meta,
      metadata: {
        projectId,
        source,
        classification,
      },
    });

    return { intent: mapIntent(row), latestBlueprint: null };
  }

  async getIntent(
    access: AccessContext,
    intentId: string,
  ): Promise<AutomationIntentResponse> {
    const row = await this.loadIntentRow(access, intentId);
    const latestBlueprint = await this.loadLatestBlueprint(
      requireWorkspace(access),
      intentId,
    );
    return { intent: mapIntent(row), latestBlueprint };
  }

  async updateIntent(
    actor: AuthenticatedActor,
    access: AccessContext,
    intentId: string,
    input: UpdateAutomationIntentRequest,
    meta: RequestMeta,
  ): Promise<AutomationIntentResponse> {
    const workspaceId = requireWorkspace(access);
    await this.loadIntentRow(access, intentId);
    const row = await this.databaseService.one<IntentRow>(
      `
        update app.automation_intents
        set
          title = coalesce($3, title),
          user_goal = coalesce($4, user_goal),
          classification = coalesce($5, classification),
          updated_by = $6,
          updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
        returning
          id,
          workspace_id,
          project_id,
          source,
          source_thread_id,
          source_message_id,
          title,
          user_goal,
          status,
          classification,
          created_by::text,
          created_at::text,
          updated_at::text
      `,
      [
        intentId,
        workspaceId,
        input.title ?? null,
        input.userGoal ?? null,
        input.classification ?? null,
        actor.id,
      ],
    );
    if (!row) {
      throw new AppHttpException(
        'AUTOMATION_NOT_FOUND',
        404,
        'Automation intent was not found.',
      );
    }
    await this.audit(actor, workspaceId, 'automation_builder.intent.updated', {
      entityId: intentId,
      result: 'success',
      meta,
    });
    return { intent: mapIntent(row), latestBlueprint: null };
  }

  async cancelIntent(
    actor: AuthenticatedActor,
    access: AccessContext,
    intentId: string,
    meta: RequestMeta,
  ) {
    const workspaceId = requireWorkspace(access);
    await this.databaseService.query(
      `
        update app.automation_intents
        set status = 'cancelled',
            cancelled_at = timezone('utc', now()),
            updated_by = $3,
            updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
      `,
      [intentId, workspaceId, actor.id],
    );
    await this.audit(
      actor,
      workspaceId,
      'automation_builder.intent.cancelled',
      {
        entityId: intentId,
        result: 'success',
        meta,
      },
    );
    return { status: 'cancelled' as const };
  }

  async planIntent(
    actor: AuthenticatedActor,
    access: AccessContext,
    intentId: string,
    meta: RequestMeta,
  ): Promise<AutomationPlanResponse> {
    const workspaceId = requireWorkspace(access);
    const intent = mapIntent(await this.loadIntentRow(access, intentId));
    const plannerRunId = randomUUID();
    const effectivePolicy =
      await this.routeGroupResolver.resolveEffectivePolicy({
        workspaceId,
        actorUserId: actor.id,
        routeGroup: 'automation_ai',
        permissions: access.permissions,
        traceId: meta.traceId,
      });
    const routeSnapshot = {
      route: effectivePolicy.routeCode,
      provider: effectivePolicy.providerCode,
      model: effectivePolicy.modelId,
      keyFingerprint: effectivePolicy.fingerprint,
      policyDecision: effectivePolicy.policyDecisionId,
    };
    const context = this.contextAssembler.assemble({
      workspaceId,
      projectId: intent.projectId,
      intentId,
      requestedItems: [
        ...(intent.sourceThreadId
          ? [
              {
                id: `thread:${intent.sourceThreadId}`,
                type: 'thread_summary' as const,
                sourceId: intent.sourceThreadId,
                classification: intent.classification,
                requestedMode: 'summary' as const,
              },
            ]
          : []),
      ],
      policy: {
        allowLegalSecretExternalProvider: access.permissions.includes(
          'automation_builder.use_legal_secret_context',
        ),
        allowExternalProviderForClientMaterial: false,
        ragAvailable: true,
      },
    });
    const blueprint = buildBlueprintFromIntent({
      intent,
      actorId: actor.id,
      context,
      routeSnapshot,
    });
    const validationSummary = this.validator.validate(blueprint);
    const validatedBlueprint: AutomationBlueprint = {
      ...blueprint,
      status:
        validationSummary.status === 'policy_blocked'
          ? 'policy_blocked'
          : validationSummary.status === 'invalid'
            ? 'validation_failed'
            : 'preview_ready',
      validationSummary,
    };
    const versionId = randomUUID();
    const blueprintId = validatedBlueprint.id;
    const blueprintHash = hashJson(validatedBlueprint);
    const promptHash = hashJson({
      promptAssets: getAutomationPlannerPromptHash(),
      goal: intent.userGoal,
      context: context.items,
    });
    const status =
      validationSummary.status === 'policy_blocked'
        ? 'policy_blocked'
        : validationSummary.status === 'invalid'
          ? 'schema_failed'
          : validatedBlueprint.clarificationState.status === 'needs_answers'
            ? 'needs_clarification'
            : 'completed';

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          insert into app.automation_planner_runs (
            id,
            intent_id,
            workspace_id,
            status,
            route_snapshot,
            prompt_hash,
            output_hash,
            created_by,
            started_at,
            completed_at
          )
          values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, timezone('utc', now()), timezone('utc', now()))
        `,
        [
          plannerRunId,
          intentId,
          workspaceId,
          status,
          JSON.stringify(routeSnapshot),
          promptHash,
          blueprintHash,
          actor.id,
        ],
      );
      const events = [
        'intent_created',
        'context_collecting',
        'context_collected',
        'planning_started',
        'route_snapshot',
        'schema_validation_started',
        validationSummary.status === 'policy_blocked'
          ? 'blueprint_validation_failed'
          : 'blueprint_validation_passed',
        'blueprint_created',
        'user_approval_required',
        'done',
      ];
      for (const [index, event] of events.entries()) {
        await client.query(
          `
            insert into app.automation_planner_events (
              planner_run_id,
              workspace_id,
              intent_id,
              event_type,
              payload_redacted,
              sequence
            )
            values ($1, $2, $3, $4, $5::jsonb, $6)
          `,
          [
            plannerRunId,
            workspaceId,
            intentId,
            event,
            JSON.stringify(event === 'route_snapshot' ? routeSnapshot : {}),
            index,
          ],
        );
      }

      await client.query(
        `
          insert into app.automation_blueprints (
            id,
            workspace_id,
            project_id,
            intent_id,
            title,
            summary,
            status,
            created_by
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          blueprintId,
          workspaceId,
          intent.projectId ?? null,
          intentId,
          validatedBlueprint.title,
          validatedBlueprint.summary,
          validatedBlueprint.status,
          actor.id,
        ],
      );
      await client.query(
        `
          insert into app.automation_blueprint_versions (
            id,
            blueprint_id,
            workspace_id,
            intent_id,
            version,
            status,
            blueprint,
            blueprint_hash,
            route_snapshot,
            validation_summary,
            created_by
          )
          values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10::jsonb, $11)
        `,
        [
          versionId,
          blueprintId,
          workspaceId,
          intentId,
          validatedBlueprint.version,
          validatedBlueprint.status,
          JSON.stringify(validatedBlueprint),
          blueprintHash,
          JSON.stringify(routeSnapshot),
          JSON.stringify(validationSummary),
          actor.id,
        ],
      );
      await client.query(
        `
          update app.automation_blueprints
          set current_version_id = $3,
              updated_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
        `,
        [blueprintId, workspaceId, versionId],
      );

      for (const step of validatedBlueprint.steps) {
        await client.query(
          `
            insert into app.automation_blueprint_steps (
              blueprint_version_id,
              workspace_id,
              step_id,
              kind,
              module_code,
              module_version,
              title,
              policy,
              runtime_mapping,
              config_redacted
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb)
          `,
          [
            versionId,
            workspaceId,
            step.id,
            step.kind,
            step.moduleCode ?? null,
            step.moduleVersion ?? null,
            step.title,
            JSON.stringify(step.policy),
            JSON.stringify(step.runtimeMapping ?? {}),
            JSON.stringify(redactRecord(step.config)),
          ],
        );
      }
      for (const edge of validatedBlueprint.edges) {
        await client.query(
          `
            insert into app.automation_blueprint_edges (
              blueprint_version_id,
              workspace_id,
              edge_id,
              source_step_id,
              target_step_id,
              kind
            )
            values ($1, $2, $3, $4, $5, $6)
          `,
          [
            versionId,
            workspaceId,
            edge.id,
            edge.sourceStepId,
            edge.targetStepId,
            edge.kind,
          ],
        );
      }

      await client.query(
        `
          update app.automation_intents
          set status = $3,
              updated_by = $4,
              updated_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
        `,
        [
          intentId,
          workspaceId,
          validationSummary.status === 'invalid'
            ? 'blueprint_invalid'
            : 'blueprint_ready',
          actor.id,
        ],
      );
    });

    await this.audit(
      actor,
      workspaceId,
      'automation_builder.planner.completed',
      {
        entityId: plannerRunId,
        result:
          validationSummary.status === 'policy_blocked' ? 'denied' : 'success',
        meta,
        metadata: {
          intentId,
          blueprintId,
          route: effectivePolicy.routeCode,
          routeGroup: effectivePolicy.routeGroup,
          policyDecisionId: effectivePolicy.policyDecisionId,
          validationStatus: validationSummary.status,
        },
      },
    );

    return {
      intent: { ...intent, status: 'blueprint_ready' },
      plannerRunId,
      blueprint: validatedBlueprint,
      events: [
        'intent_created',
        'context_collecting',
        'context_collected',
        'planning_started',
        'route_snapshot',
        'schema_validation_started',
        'blueprint_created',
        'user_approval_required',
        'done',
      ],
    };
  }

  async getBlueprint(
    access: AccessContext,
    blueprintId: string,
  ): Promise<AutomationBlueprint> {
    return this.loadBlueprint(access, blueprintId);
  }

  async validateBlueprint(
    actor: AuthenticatedActor,
    access: AccessContext,
    blueprintId: string,
    meta: RequestMeta,
  ) {
    const blueprint = await this.loadBlueprint(access, blueprintId);
    const validation = this.validator.validate(blueprint);
    const workspaceId = requireWorkspace(access);
    await this.databaseService.query(
      `
        insert into app.automation_blueprint_validations (
          blueprint_version_id,
          workspace_id,
          status,
          errors,
          warnings,
          policy_blocks,
          created_by
        )
        select current_version_id, workspace_id, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7
        from app.automation_blueprints
        where id = $1
          and workspace_id = $2
      `,
      [
        blueprintId,
        workspaceId,
        validation.status,
        JSON.stringify(validation.errors),
        JSON.stringify(validation.warnings),
        JSON.stringify(validation.policyBlocks),
        actor.id,
      ],
    );
    await this.audit(
      actor,
      workspaceId,
      'automation_builder.blueprint.validated',
      {
        entityId: blueprintId,
        result: validation.status === 'policy_blocked' ? 'denied' : 'success',
        meta,
        metadata: { validationStatus: validation.status },
      },
    );
    return validation;
  }

  async compilePreview(
    actor: AuthenticatedActor,
    access: AccessContext,
    blueprintId: string,
    meta: RequestMeta,
  ): Promise<AutomationCompilePreviewResponse> {
    const workspaceId = requireWorkspace(access);
    const blueprint = await this.loadBlueprint(access, blueprintId);
    const workflow = this.canvasConverter.toWorkflowDraft(blueprint, {
      automationId: `automation_${blueprint.id}`,
      draftVersionId: `draft_version_${blueprint.version}`,
    });
    const requiredPieces = [
      ...new Set(
        blueprint.steps
          .map((step) => step.runtimeMapping?.pieceName)
          .filter((piece): piece is string => Boolean(piece)),
      ),
    ];
    const requiredConnections = [
      ...new Set(
        blueprint.requiredConnections.map((connection) => connection.code),
      ),
    ];
    const workflowHash = hashJson(workflow);
    await this.databaseService.query(
      `
        insert into app.automation_blueprint_compile_previews (
          blueprint_version_id,
          workspace_id,
          status,
          workflow_hash,
          preview,
          created_by
        )
        select current_version_id, workspace_id, 'preview_ready', $3, $4::jsonb, $5
        from app.automation_blueprints
        where id = $1
          and workspace_id = $2
      `,
      [
        blueprintId,
        workspaceId,
        workflowHash,
        JSON.stringify({ workflow, requiredPieces, requiredConnections }),
        actor.id,
      ],
    );
    await this.audit(
      actor,
      workspaceId,
      'automation_builder.compile_preview.created',
      {
        entityId: blueprintId,
        result: 'success',
        meta,
        metadata: { workflowHash },
      },
    );
    return {
      blueprintId,
      status: 'preview_ready',
      workflowHash,
      requiredPieces,
      requiredConnections,
      warnings: [],
    };
  }

  async approveBlueprint(
    actor: AuthenticatedActor,
    access: AccessContext,
    blueprintId: string,
    meta: RequestMeta,
  ) {
    const workspaceId = requireWorkspace(access);
    const validation = await this.validateBlueprint(
      actor,
      access,
      blueprintId,
      meta,
    );
    if (!validation.canApprove) {
      throw new AppHttpException(
        'WORKFLOW_POLICY_BLOCKED',
        409,
        'Blueprint validation blocks approval.',
        { validation },
      );
    }
    await this.updateBlueprintStatus(
      workspaceId,
      blueprintId,
      'approved',
      true,
    );
    await this.audit(
      actor,
      workspaceId,
      'automation_builder.blueprint.approved',
      {
        entityId: blueprintId,
        result: 'success',
        meta,
      },
    );
    return this.loadBlueprint(access, blueprintId);
  }

  async rejectBlueprint(
    actor: AuthenticatedActor,
    access: AccessContext,
    blueprintId: string,
    meta: RequestMeta,
  ) {
    const workspaceId = requireWorkspace(access);
    await this.updateBlueprintStatus(
      workspaceId,
      blueprintId,
      'archived',
      false,
    );
    await this.audit(
      actor,
      workspaceId,
      'automation_builder.blueprint.rejected',
      {
        entityId: blueprintId,
        result: 'success',
        meta,
      },
    );
    return { status: 'rejected' as const };
  }

  async convertToCanvasDraft(
    actor: AuthenticatedActor,
    access: AccessContext,
    blueprintId: string,
    meta: RequestMeta,
  ): Promise<AutomationCanvasDraftResponse> {
    const workspaceId = requireWorkspace(access);
    const blueprint = await this.loadBlueprint(access, blueprintId);
    if (blueprint.status !== 'approved') {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        409,
        'Blueprint must be approved before Canvas draft conversion.',
      );
    }
    const automationId = randomUUID();
    const draftVersionId = randomUUID();
    const workflow = this.canvasConverter.toWorkflowDraft(blueprint, {
      automationId,
      draftVersionId,
    });
    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          insert into app.automation_builder_artifacts (
            workspace_id,
            intent_id,
            blueprint_id,
            artifact_type,
            status,
            payload_redacted,
            content_hash,
            created_by
          )
          values ($1, $2, $3, 'canvas_draft', 'created', $4::jsonb, $5, $6)
        `,
        [
          workspaceId,
          blueprint.intentId,
          blueprint.id,
          JSON.stringify({ automationId, draftVersionId, workflow }),
          hashJson(workflow),
          actor.id,
        ],
      );
      await client.query(
        `
          update app.automation_blueprints
          set status = 'converted_to_canvas_draft',
              updated_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
        `,
        [blueprintId, workspaceId],
      );
    });
    await this.audit(
      actor,
      workspaceId,
      'automation_builder.canvas_draft.created',
      {
        entityId: blueprintId,
        result: 'success',
        meta,
        metadata: { automationId, draftVersionId },
      },
    );
    return {
      blueprintId,
      automationId,
      draftVersionId,
      canvasUrl: `/app/projects/${encodeURIComponent(
        blueprint.projectId ?? 'workspace',
      )}/automations/${encodeURIComponent(
        automationId,
      )}/canvas?sourceBlueprintId=${encodeURIComponent(blueprintId)}`,
      status: 'canvas_draft_created',
    };
  }

  async createRuntimeDraft(
    actor: AuthenticatedActor,
    access: AccessContext,
    blueprintId: string,
    meta: RequestMeta,
  ): Promise<AutomationRuntimeDraftResponse> {
    const workspaceId = requireWorkspace(access);
    const blueprint = await this.loadBlueprint(access, blueprintId);
    if (
      blueprint.status !== 'approved' &&
      blueprint.status !== 'converted_to_canvas_draft'
    ) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        409,
        'Blueprint must be approved before runtime draft creation.',
      );
    }
    const result = this.runtimeDraftService.createRuntimeDraft({
      blueprint,
      activepiecesAvailable: false,
      mcpAvailable: false,
    });
    await this.databaseService.query(
      `
        insert into app.automation_runtime_creation_jobs (
          blueprint_version_id,
          workspace_id,
          automation_id,
          status,
          runtime_target,
          activepieces_project_id,
          activepieces_flow_id,
          activepieces_version_id,
          evidence_hash,
          error_code,
          created_by
        )
        select
          current_version_id,
          workspace_id,
          null,
          $3,
          'activepieces',
          $4,
          $5,
          $6,
          $7,
          $8,
          $9
        from app.automation_blueprints
        where id = $1
          and workspace_id = $2
      `,
      [
        blueprintId,
        workspaceId,
        result.status === 'runtime_created'
          ? 'created'
          : result.status === 'runtime_creation_blocked'
            ? 'blocked'
            : 'not_configured',
        result.activepiecesProjectId,
        result.activepiecesFlowId,
        result.activepiecesVersionId ?? null,
        result.evidenceHash,
        result.status,
        actor.id,
      ],
    );
    await this.audit(
      actor,
      workspaceId,
      result.status === 'runtime_created'
        ? 'automation_builder.runtime_draft.created'
        : 'automation_builder.runtime_draft.failed',
      {
        entityId: blueprintId,
        result: result.status === 'runtime_created' ? 'success' : 'denied',
        meta,
        metadata: {
          status: result.status,
          evidenceHash: result.evidenceHash,
        },
      },
    );
    return result;
  }

  async answerClarification(
    actor: AuthenticatedActor,
    access: AccessContext,
    clarificationId: string,
    answer: unknown,
    meta: RequestMeta,
  ) {
    const workspaceId = requireWorkspace(access);
    await this.databaseService.query(
      `
        update app.automation_blueprint_clarifications
        set status = 'answered',
            answer = $3::jsonb,
            answered_by = $4,
            answered_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
      `,
      [clarificationId, workspaceId, JSON.stringify(answer), actor.id],
    );
    await this.audit(
      actor,
      workspaceId,
      'automation_builder.clarification.answered',
      {
        entityId: clarificationId,
        result: 'success',
        meta,
      },
    );
    return { status: 'answered' as const };
  }

  async createSession(
    actor: AuthenticatedActor,
    access: AccessContext,
    body: { readonly projectId?: string; readonly title?: string },
    meta: RequestMeta,
  ) {
    const workspaceId = requireWorkspace(access);
    const row = await this.databaseService.one<{ readonly id: string }>(
      `
        insert into app.automation_builder_sessions (
          workspace_id,
          project_id,
          title,
          created_by
        )
        values ($1, $2, $3, $4)
        returning id
      `,
      [
        workspaceId,
        body.projectId ?? null,
        body.title ?? 'Automation builder',
        actor.id,
      ],
    );
    await this.audit(actor, workspaceId, 'automation_builder.session.created', {
      entityId: row?.id ?? null,
      result: 'success',
      meta,
    });
    return { id: row?.id ?? null, status: 'active' };
  }

  async archiveSession(
    actor: AuthenticatedActor,
    access: AccessContext,
    sessionId: string,
    meta: RequestMeta,
  ) {
    const workspaceId = requireWorkspace(access);
    await this.databaseService.query(
      `
        update app.automation_builder_sessions
        set status = 'archived',
            archived_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
      `,
      [sessionId, workspaceId],
    );
    await this.audit(
      actor,
      workspaceId,
      'automation_builder.session.archived',
      {
        entityId: sessionId,
        result: 'success',
        meta,
      },
    );
    return { status: 'archived' as const };
  }

  getModuleCatalog() {
    return {
      modules: getCanvasBlockDefinitions().map((block) => ({
        code: block.code,
        kind: block.kind,
        displayName: block.displayName,
        enabled: block.enabled,
        runtimeProvider: block.runtime.provider,
        activepiecesPiece: block.runtime.activepiecesPiece ?? null,
        activepiecesAction: block.runtime.activepiecesAction ?? null,
      })),
    };
  }

  resolveModuleCatalog(input: {
    readonly steps?: readonly {
      readonly kind?: string;
      readonly moduleCode?: string | null;
    }[];
  }) {
    const catalog = new Map(
      getCanvasBlockDefinitions().map((block) => [block.code, block]),
    );
    return {
      resolved: (input.steps ?? []).map((step) => {
        const block = step.moduleCode ? catalog.get(step.moduleCode) : null;
        return {
          moduleCode: step.moduleCode ?? null,
          kind: step.kind ?? null,
          supported: Boolean(block?.enabled),
          canvasNodeType: block?.nodeType ?? null,
          runtimeProvider: block?.runtime.provider ?? 'manual',
        };
      }),
    };
  }

  previewContext(
    access: AccessContext,
    body: {
      readonly projectId?: string | null;
      readonly intentId?: string | null;
    },
  ) {
    const workspaceId = requireWorkspace(access);
    return this.contextAssembler.assemble({
      workspaceId,
      projectId: body.projectId ?? null,
      intentId: body.intentId ?? 'preview',
      requestedItems: [],
      policy: {
        allowLegalSecretExternalProvider: access.permissions.includes(
          'automation_builder.use_legal_secret_context',
        ),
        allowExternalProviderForClientMaterial: false,
        ragAvailable: true,
      },
    });
  }

  securityPreflight(access: AccessContext) {
    return {
      status: 'pass',
      workspaceId: requireWorkspace(access),
      plannerRoute: 'automation_planner_high',
      frontendProviderCallsAllowed: false,
      frontendRuntimeCallsAllowed: false,
      canPublish: false,
      canRunProduction: false,
    };
  }

  private async loadIntentRow(access: AccessContext, intentId: string) {
    const row = await this.databaseService.one<IntentRow>(
      `
        select
          id,
          workspace_id,
          project_id,
          source,
          source_thread_id,
          source_message_id,
          title,
          user_goal,
          status,
          classification,
          created_by::text,
          created_at::text,
          updated_at::text
        from app.automation_intents
        where id = $1
          and workspace_id = $2
        limit 1
      `,
      [intentId, requireWorkspace(access)],
    );
    if (!row) {
      throw new AppHttpException(
        'AUTOMATION_NOT_FOUND',
        404,
        'Automation intent was not found.',
      );
    }
    return row;
  }

  private async loadLatestBlueprint(workspaceId: string, intentId: string) {
    const row = await this.databaseService.one<{
      readonly blueprint: AutomationBlueprint;
    }>(
      `
        select abv.blueprint
        from app.automation_blueprints ab
        inner join app.automation_blueprint_versions abv
          on abv.id = ab.current_version_id
        where ab.workspace_id = $1
          and ab.intent_id = $2
        order by ab.updated_at desc
        limit 1
      `,
      [workspaceId, intentId],
    );
    return row?.blueprint ?? null;
  }

  private async loadBlueprint(access: AccessContext, blueprintId: string) {
    const row = await this.databaseService.one<BlueprintRow>(
      `
        select
          ab.id,
          ab.workspace_id,
          ab.current_version_id,
          ab.status,
          abv.blueprint
        from app.automation_blueprints ab
        inner join app.automation_blueprint_versions abv
          on abv.id = ab.current_version_id
        where ab.id = $1
          and ab.workspace_id = $2
        limit 1
      `,
      [blueprintId, requireWorkspace(access)],
    );
    if (!row?.blueprint) {
      throw new AppHttpException(
        'AUTOMATION_NOT_FOUND',
        404,
        'Automation blueprint was not found.',
      );
    }
    return {
      ...row.blueprint,
      status: row.status,
    };
  }

  private async updateBlueprintStatus(
    workspaceId: string,
    blueprintId: string,
    status: AutomationBlueprintStatus,
    immutable: boolean,
  ) {
    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.automation_blueprints
          set status = $3,
              updated_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
        `,
        [blueprintId, workspaceId, status],
      );
      await client.query(
        `
          update app.automation_blueprint_versions
          set status = $3,
              immutable_after_approval = immutable_after_approval or $4
          where blueprint_id = $1
            and workspace_id = $2
        `,
        [blueprintId, workspaceId, status, immutable],
      );
    });
  }

  private async audit(
    actor: AuthenticatedActor,
    workspaceId: string,
    action: string,
    input: {
      readonly entityId?: string | null;
      readonly result: 'success' | 'denied' | 'error';
      readonly meta: RequestMeta;
      readonly metadata?: Record<string, unknown>;
    },
  ) {
    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action,
      entityType: 'automation_builder',
      entityId: input.entityId ?? null,
      result: input.result,
      requestId: input.meta.requestId,
      traceId: input.meta.traceId,
      eventCategory: 'automation_builder',
      redactionApplied: true,
      metadata: input.metadata ?? {},
    });
  }
}

function buildBlueprintFromIntent(input: {
  readonly intent: AutomationIntent;
  readonly actorId: string;
  readonly context: ReturnType<AutomationContextAssemblerService['assemble']>;
  readonly routeSnapshot: AutomationBlueprint['routeSnapshot'];
}): AutomationBlueprint {
  const now = new Date().toISOString();
  const needsDelivery = /send|email|telegram|webhook|deliver|отправ/i.test(
    input.intent.userGoal,
  );
  const unsafePromptRequest = isUnsafePlannerRequest(input.intent.userGoal);
  const steps: AutomationBlueprint['steps'] = [
    {
      id: 'trigger',
      kind: 'trigger',
      title: 'Manual start',
      description: 'Human-confirmed start from LexFrame.',
      inputRequirements: [],
      outputDefinitions: [],
      config: {},
      policy: {
        riskLevel: 'low',
        dataClassification: 'workspace_internal',
        requiresApproval: false,
        externalAction: false,
      },
      runtimeMapping: { provider: 'lexframe_canvas' },
    },
    {
      id: 'collect_context',
      kind: 'document_input',
      title: 'Collect permitted context',
      description:
        'Collect selected project documents and knowledge references.',
      inputRequirements: [],
      outputDefinitions: [],
      config: { contextMode: input.context.policyDecision },
      policy: {
        riskLevel: 'medium',
        dataClassification:
          input.intent.classification === 'internal'
            ? 'workspace_internal'
            : input.intent.classification,
        requiresApproval: false,
        externalAction: false,
      },
      runtimeMapping: { provider: 'internal_worker' },
    },
    {
      id: 'legal_action',
      kind: 'legal_action',
      moduleCode: 'legal.document_review',
      moduleVersion: '1',
      title: 'Perform legal review',
      description: input.intent.userGoal,
      inputRequirements: [],
      outputDefinitions: [
        {
          id: 'review_result',
          key: 'review_result',
          label: 'Review result',
          type: 'document',
          classification: input.intent.classification,
          required: true,
        },
      ],
      config: { goalHash: hashJson({ goal: input.intent.userGoal }) },
      policy: {
        riskLevel: 'medium',
        dataClassification:
          input.intent.classification === 'internal'
            ? 'workspace_internal'
            : input.intent.classification,
        requiresApproval: false,
        externalAction: false,
      },
      runtimeMapping: {
        provider: 'activepieces',
        pieceName: '@lexframe/piece-legal',
        actionName: 'review_document',
      },
    },
    ...(needsDelivery
      ? [
          {
            id: 'approval_gate',
            kind: 'approval' as const,
            title: 'Approve external delivery',
            description: 'Human approval before any external effect.',
            inputRequirements: [],
            outputDefinitions: [],
            config: {},
            policy: {
              riskLevel: 'high' as const,
              dataClassification: 'client_material' as const,
              requiresApproval: true,
              externalAction: false,
            },
            runtimeMapping: { provider: 'manual' as const },
          },
          {
            id: 'delivery',
            kind: 'delivery' as const,
            title: 'Prepare delivery draft',
            description: 'Create a delivery draft only; no automatic send.',
            inputRequirements: [],
            outputDefinitions: [],
            config: {},
            policy: {
              riskLevel: 'high' as const,
              dataClassification: 'client_material' as const,
              requiresApproval: true,
              externalAction: true,
            },
            runtimeMapping: {
              provider: 'activepieces' as const,
              pieceName: '@lexframe/piece-delivery',
              actionName: 'prepare_delivery_draft',
            },
          },
        ]
      : []),
    {
      id: 'end',
      kind: 'end',
      title: 'Finish draft',
      description: 'Finish without publishing or running.',
      inputRequirements: [],
      outputDefinitions: [],
      config: {},
      policy: {
        riskLevel: 'low',
        dataClassification: 'workspace_internal',
        requiresApproval: false,
        externalAction: false,
      },
      runtimeMapping: { provider: 'none' },
    },
  ];
  const ids = steps.map((step) => step.id);
  const edges = ids.slice(0, -1).map((sourceStepId, index) => ({
    id: `edge_${index + 1}`,
    sourceStepId,
    targetStepId: ids[index + 1] ?? 'end',
    kind:
      sourceStepId === 'approval_gate'
        ? ('approval' as const)
        : ('control' as const),
  }));

  return {
    id: randomUUID(),
    workspaceId: input.intent.workspaceId,
    projectId: input.intent.projectId ?? null,
    intentId: input.intent.id,
    version: '1',
    title: input.intent.title ?? 'Automation blueprint',
    summary: `Draft automation blueprint for: ${input.intent.userGoal}`,
    status: 'draft',
    sourceContext: {
      items: input.context.items.map((item) => ({
        id: item.id,
        type: item.type,
        sourceId: item.sourceId,
        classification: item.classification,
        selectedMode: item.selectedMode,
        resultHash: item.sourceHash,
        blocked: item.blocked,
        reasonCode: item.reasonCode,
      })),
      policyDecision: input.context.policyDecision,
      contextBudgetTokens: input.context.contextBudgetTokens,
    },
    workflowInputs: [],
    workflowOutputs: [
      {
        id: 'review_result',
        key: 'review_result',
        label: 'Review result',
        type: 'document',
        classification: input.intent.classification,
        required: true,
      },
    ],
    steps,
    edges,
    dataBindings: [],
    requiredDocuments: [],
    requiredConnections: [],
    approvalGates: needsDelivery
      ? [
          {
            id: 'approval_gate',
            stepId: 'approval_gate',
            title: 'External delivery approval',
            requiredPermission: 'automation_builder.approve_blueprint',
            reason: 'External delivery must remain human-gated.',
          },
        ]
      : [],
    dataPolicy: {
      highestClassification: input.intent.classification,
      contextModes: ['reference_only'],
      externalProviderAllowed: false,
      rawSecretMaterialAllowed: false,
    },
    runtimePlan: {
      target: 'canvas_draft',
      activepieces: {
        required: true,
        createDraftAllowed: !needsDelivery && !unsafePromptRequest,
        requiredPieces: ['@lexframe/piece-legal'],
        requiredConnections: [],
      },
    },
    testPlan: {
      scenarios: [
        {
          id: 'mock_validation',
          title: 'Validate blueprint structure without live AI/AP.',
          expectedResult: 'Blueprint can become Canvas draft only.',
        },
      ],
    },
    riskReport: {
      riskLevel: unsafePromptRequest
        ? 'critical'
        : needsDelivery
          ? 'high'
          : 'medium',
      warnings:
        needsDelivery && !unsafePromptRequest
          ? [
              'External delivery is represented only as a draft with approval gate.',
            ]
          : [],
      blocks: unsafePromptRequest
        ? [
            'Planner request attempted to bypass approval, use direct secrets, create uncontrolled HTTP/external calls, or publish/run autonomously.',
          ]
        : [],
    },
    clarificationState: {
      status:
        input.intent.userGoal.trim().length < 8 ? 'needs_answers' : 'complete',
      questions:
        input.intent.userGoal.trim().length < 8
          ? [
              {
                id: 'clarify_goal',
                intentId: input.intent.id,
                kind: 'missing_goal',
                question: 'Describe the legal process that should be drafted.',
                required: true,
                answerType: 'text',
                createdAt: now,
              },
            ]
          : [],
    },
    routeSnapshot: input.routeSnapshot,
    validationSummary: {
      status: 'valid',
      errors: [],
      warnings: [],
      policyBlocks: [],
      affectedSteps: [],
      affectedEdges: [],
      canAskClarification: false,
      canApprove: true,
      canConvertToCanvasDraft: true,
      canCreateRuntimeDraft: false,
      canPublish: false,
      canRunProduction: false,
    },
    createdBy: input.actorId,
    createdAt: now,
    updatedAt: now,
  };
}

function isUnsafePlannerRequest(userGoal: string) {
  return /bypass|api[_ -]?key|secret|token|http call|external domain|publish|run production|autonomous|without approval|РѕР±Рѕ|РѕРїСѓР±|Р·Р°РїСѓСЃС‚/i.test(
    userGoal,
  );
}

function requireWorkspace(access: AccessContext) {
  if (!access.activeWorkspace?.id) {
    throw new AppHttpException(
      'WORKSPACE_CONTEXT_REQUIRED',
      403,
      'Workspace context is required.',
    );
  }
  return access.activeWorkspace.id;
}

function mapIntent(row: IntentRow): AutomationIntent {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    source: row.source,
    sourceThreadId: row.source_thread_id,
    sourceMessageId: row.source_message_id,
    title: row.title,
    userGoal: row.user_goal,
    status: row.status,
    classification: row.classification,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hashJson(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function redactRecord(value: Record<string, unknown>) {
  return JSON.parse(
    JSON.stringify(value).replace(
      /sk-[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
      '[REDACTED]',
    ),
  ) as Record<string, unknown>;
}
