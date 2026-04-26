import type {
  CanvasDraftResponse,
  CanvasDraftOpenResponse,
  CanvasDraftRequest,
  CanvasFeatureFlags,
  CanvasModuleSummary,
  CanvasPermissions,
  CanvasReadModel,
  CanvasState,
  CanvasVersionsResponse,
  CanvasVersionStatus,
  CanvasValidationSummary,
  LegalModuleIoSchema,
  LexFrameWorkflowV2,
  PermissionCode,
  WorkflowEdge,
  WorkflowDataField,
  WorkflowNode,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { requireWorkspaceId } from './canvas-access';
import {
  canonicalWorkflowHashInput,
  canonicalizeWorkflowV2,
  defaultSecretsPolicy,
  defaultWorkflowPolicy,
  stableStringify,
} from './canvas-canonical';
import {
  applyGuidedLayout,
  createWorkflowEdge,
  createWorkflowNode,
} from './canvas-model';
import {
  handlesWithDataPorts,
  normalizeBinding,
  normalizeDataField,
  normalizeDataType,
} from './canvas-io-utils';
import { CanvasLockService } from './canvas-lock.service';
import { CanvasValidationService } from './canvas-validation.service';

export interface CanvasAutomationRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly source_template_version_id: string | null;
  readonly title: string;
  readonly version: string;
  readonly workflow: Record<string, unknown>;
  readonly runtime_flow_id: string | null;
  readonly sync_hash: string | null;
}

export interface CanvasDraftRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly project_id: string | null;
  readonly installed_automation_id: string;
  readonly source_template_version_id: string | null;
  readonly workflow: LexFrameWorkflowV2;
  readonly workflow_hash: string;
  readonly revision_counter: number;
  readonly validation_summary: CanvasValidationSummary;
  readonly status: string;
  readonly normalized_canvas?: CanvasReadModel | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface ModuleSchemaRow {
  readonly code: string;
  readonly version: string | null;
  readonly status: 'draft' | 'published' | 'deprecated' | 'retired' | null;
  readonly input_schema: readonly LegalModuleIoSchema[] | null;
  readonly output_schema: readonly LegalModuleIoSchema[] | null;
}

interface CanvasVersionRow {
  readonly id: string;
  readonly status: string;
  readonly title: string | null;
  readonly workflow_hash: string;
  readonly revision_counter: number;
  readonly validation_summary: CanvasValidationSummary | null;
  readonly version_no?: number | null;
  readonly created_at: string;
  readonly updated_at: string;
}

@Injectable()
export class CanvasDraftService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly validationService: CanvasValidationService,
    private readonly lockService: CanvasLockService,
    private readonly auditService: AuditService,
  ) {}

  async getDraftResponse(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
  ): Promise<CanvasDraftResponse> {
    return this.getCanvasState(actor, access, automationId);
  }

  async getCanvasState(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
  ): Promise<CanvasState> {
    const draft = await this.ensureDraft(actor, access, automationId);
    const validation = this.validationService.validateWorkflow(draft.workflow);
    const workflow = this.withValidation(draft.workflow, validation);
    const hash = this.hashWorkflow(workflow);
    const canvas = this.buildCanvasReadModel(workflow, validation);

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'canvas.opened',
      entityType: 'installed_automation',
      entityId: automationId,
      result: 'success',
      metadata: {
        issues: validation.issues.length,
        status: validation.status,
      },
    });

    return {
      automation_id: automationId,
      draft_id: draft.id,
      schema_version: workflow.schema_version,
      status: normalizeDraftStatus(draft.status, validation),
      revision: draft.revision_counter,
      draft_hash: hash,
      workflow,
      canvas,
      runtime_projection: workflow.runtime_projection,
      workflow_hash: hash,
      revision_counter: draft.revision_counter,
      permissions: this.buildPermissions(access),
      lock: await this.lockService.getLockState(
        access,
        actor,
        automationId,
        draft.id,
      ),
      feature_flags: this.buildFeatureFlags(),
      validation,
    };
  }

  async createOrOpenDraft(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    input: CanvasDraftRequest = {},
  ): Promise<CanvasDraftOpenResponse> {
    if (
      input.source === 'from_runtime_import' &&
      !access.permissions.includes('canvas.import_runtime')
    ) {
      throw new AppHttpException(
        'CANVAS_PERMISSION_DENIED',
        403,
        'Canvas runtime import permission is required.',
      );
    }
    const draft =
      input.source === 'from_published_version' && input.source_version_id
        ? await this.createDraftFromVersion(
            actor,
            access,
            automationId,
            input.source_version_id,
          )
        : await this.ensureDraft(actor, access, automationId);
    const workflow = this.withValidation(
      draft.workflow,
      this.validationService.validateWorkflow(draft.workflow),
    );
    const hash = this.hashWorkflow(workflow);
    return {
      draft_id: draft.id,
      revision: draft.revision_counter,
      draft_hash: hash,
      status: normalizeDraftStatus(draft.status, draft.validation_summary),
    };
  }

  async listVersions(
    access: AccessContext,
    automationId: string,
  ): Promise<CanvasVersionsResponse> {
    const workspaceId = requireWorkspaceId(access);
    const published = await this.databaseService.query<CanvasVersionRow>(
      `
        select
          v.id,
          v.status,
          v.workflow -> 'metadata' ->> 'title' as title,
          v.workflow_hash,
          0 as revision_counter,
          vr.summary as validation_summary,
          v.version_no,
          v.created_at,
          v.published_at as updated_at
        from app.automation_canvas_versions v
        left join app.automation_canvas_validation_results vr
          on vr.id = v.validation_result_id
        join app.installed_automations ia
          on ia.id = v.installed_automation_id
         and ia.workspace_id = v.workspace_id
        where v.workspace_id = $1
          and v.installed_automation_id = $2
          and ia.deleted_at is null
        order by v.version_no desc
      `,
      [workspaceId, automationId],
    );
    const drafts = await this.databaseService.query<CanvasVersionRow>(
      `
        select
          d.id,
          d.status,
          d.workflow -> 'metadata' ->> 'title' as title,
          d.workflow_hash,
          d.revision_counter,
          d.validation_summary,
          null::integer as version_no,
          d.created_at,
          d.updated_at
        from app.automation_canvas_drafts d
        join app.installed_automations ia
          on ia.id = d.installed_automation_id
         and ia.workspace_id = d.workspace_id
        where d.workspace_id = $1
          and d.installed_automation_id = $2
          and d.archived_at is null
          and ia.deleted_at is null
        order by d.updated_at desc
      `,
      [workspaceId, automationId],
    );
    const rows = [...drafts.rows, ...published.rows];
    const currentDraftVersionId = drafts.rows[0]?.id ?? null;

    return {
      current_draft_version_id: currentDraftVersionId,
      versions: rows.map((row) => ({
        id: row.id,
        status: normalizeVersionStatus(row.status),
        title: row.title ?? 'Canvas draft',
        workflow_hash: row.workflow_hash,
        revision_counter: row.revision_counter,
        validation_status: row.validation_summary?.status ?? 'invalid',
        is_current: row.id === currentDraftVersionId,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    };
  }

  async ensureDraft(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
  ): Promise<CanvasDraftRow> {
    const workspaceId = requireWorkspaceId(access);
    const existing = await this.databaseService.one<CanvasDraftRow>(
      `
        select
          id,
          workspace_id,
          project_id,
          installed_automation_id,
          source_template_version_id,
          workflow,
          workflow_hash,
          revision_counter,
          validation_summary,
          status,
          normalized_canvas,
          created_at,
          updated_at
        from app.automation_canvas_drafts
        where workspace_id = $1
          and installed_automation_id = $2
          and archived_at is null
        limit 1
      `,
      [workspaceId, automationId],
    );

    if (existing) {
      const workflow = await this.hydrateWorkflowSchemas(
        normalizeWorkflowV2({
          ...existing.workflow,
          draft_version_id: existing.workflow.draft_version_id ?? existing.id,
        }),
      );
      const validation = this.validationService.validateWorkflow(workflow);
      const workflowWithValidation = this.withValidation(workflow, validation);
      const hash = this.hashWorkflow(workflowWithValidation);
      return {
        ...existing,
        workflow: workflowWithValidation,
        workflow_hash: hash,
        revision_counter: existing.revision_counter,
        validation_summary: validation,
      };
    }

    const automation = await this.getAutomation(access, automationId);
    const now = new Date().toISOString();
    const draftId = randomUUID();
    const workflow = await this.hydrateWorkflowSchemas(
      this.createInitialWorkflow(automation, draftId, now),
    );
    const validation = this.validationService.validateWorkflow(workflow);
    const workflowWithValidation = this.withValidation(workflow, validation);
    const hash = this.hashWorkflow(workflowWithValidation);
    const normalizedCanvas = this.buildCanvasReadModel(
      workflowWithValidation,
      validation,
    );

    try {
      await this.databaseService.query(
        `
          insert into app.automation_canvas_drafts (
            id,
            workspace_id,
            project_id,
            installed_automation_id,
            source_template_version_id,
            workflow,
            workflow_hash,
            validation_summary,
            runtime_projection,
            normalized_canvas,
            runtime_projection_status,
            activepieces_sync_status,
            revision_counter,
            status,
            created_by_user_id,
            updated_by_user_id
          )
          values ($1, $2, null, $3, $4, $5::jsonb, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, 0, 'editing', $12, $12)
        `,
        [
          draftId,
          workspaceId,
          automationId,
          automation.source_template_version_id,
          JSON.stringify(workflowWithValidation),
          hash,
          JSON.stringify(validation),
          JSON.stringify(workflowWithValidation.runtime_projection),
          JSON.stringify(normalizedCanvas),
          workflowWithValidation.runtime_projection.status,
          'not_synced',
          actor.id,
        ],
      );
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      const racedDraft = await this.databaseService.one<CanvasDraftRow>(
        `
          select
            id,
            workspace_id,
            project_id,
            installed_automation_id,
            source_template_version_id,
            workflow,
            workflow_hash,
            revision_counter,
            validation_summary,
            status,
            normalized_canvas,
            created_at,
            updated_at
          from app.automation_canvas_drafts
          where workspace_id = $1
            and installed_automation_id = $2
            and archived_at is null
          limit 1
        `,
        [workspaceId, automationId],
      );
      if (racedDraft) {
        const racedWorkflow = await this.hydrateWorkflowSchemas(
          normalizeWorkflowV2({
            ...racedDraft.workflow,
            draft_version_id:
              racedDraft.workflow.draft_version_id ?? racedDraft.id,
          }),
        );
        const racedValidation =
          this.validationService.validateWorkflow(racedWorkflow);
        const racedWorkflowWithValidation = this.withValidation(
          racedWorkflow,
          racedValidation,
        );
        return {
          ...racedDraft,
          workflow: racedWorkflowWithValidation,
          workflow_hash: this.hashWorkflow(racedWorkflowWithValidation),
          validation_summary: racedValidation,
        };
      }
      throw error;
    }

    return {
      id: draftId,
      workspace_id: workspaceId,
      project_id: null,
      installed_automation_id: automationId,
      source_template_version_id: automation.source_template_version_id,
      workflow: workflowWithValidation,
      workflow_hash: hash,
      revision_counter: 0,
      validation_summary: validation,
      status: 'editing',
      normalized_canvas: normalizedCanvas,
      created_at: now,
      updated_at: now,
    };
  }

  async createDraftFromVersion(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    versionId: string,
  ): Promise<CanvasDraftRow> {
    const workspaceId = requireWorkspaceId(access);
    const version = await this.databaseService.one<{
      readonly id: string;
      readonly workflow: LexFrameWorkflowV2;
      readonly normalized_canvas: CanvasReadModel | null;
    }>(
      `
        select id, workflow, normalized_canvas
        from app.automation_canvas_versions
        where id = $1
          and workspace_id = $2
          and installed_automation_id = $3
        limit 1
      `,
      [versionId, workspaceId, automationId],
    );
    if (!version) {
      throw new AppHttpException(
        'CANVAS_OPERATION_INVALID',
        404,
        'Canvas version was not found.',
      );
    }

    await this.archiveDraft(access, actor, automationId);

    const now = new Date().toISOString();
    const draftId = randomUUID();
    const workflow = this.withValidation(
      canonicalizeWorkflowV2({
        ...version.workflow,
        draft_version_id: draftId,
        published_version_id: version.id,
        revision_counter: 0,
        metadata: {
          ...version.workflow.metadata,
          status: 'draft',
        },
        updated_at: now,
      }),
      this.validationService.validateWorkflow(version.workflow),
    );
    const validation = this.validationService.validateWorkflow(workflow);
    const hash = this.hashWorkflow(workflow);
    const normalizedCanvas =
      version.normalized_canvas ??
      this.buildCanvasReadModel(workflow, validation);

    await this.databaseService.query(
      `
        insert into app.automation_canvas_drafts (
          id,
          workspace_id,
          project_id,
          installed_automation_id,
          source_template_version_id,
          base_version_id,
          current_version_id,
          workflow,
          workflow_hash,
          validation_summary,
          runtime_projection,
          normalized_canvas,
          runtime_projection_status,
          activepieces_sync_status,
          revision_counter,
          status,
          created_by_user_id,
          updated_by_user_id
        )
        values ($1, $2, null, $3, null, $4, $4, $5::jsonb, $6, $7::jsonb, $8::jsonb, $9::jsonb, 'sync_required', 'not_synced', 0, 'editing', $10, $10)
      `,
      [
        draftId,
        workspaceId,
        automationId,
        version.id,
        JSON.stringify(workflow),
        hash,
        JSON.stringify(validation),
        JSON.stringify(workflow.runtime_projection),
        JSON.stringify(normalizedCanvas),
        actor.id,
      ],
    );

    return {
      id: draftId,
      workspace_id: workspaceId,
      project_id: null,
      installed_automation_id: automationId,
      source_template_version_id: null,
      workflow,
      workflow_hash: hash,
      revision_counter: 0,
      validation_summary: validation,
      status: 'editing',
      normalized_canvas: normalizedCanvas,
      created_at: now,
      updated_at: now,
    };
  }

  async archiveDraft(
    access: AccessContext,
    actor: AuthenticatedActor,
    automationId: string,
  ) {
    const workspaceId = requireWorkspaceId(access);
    await this.databaseService.query(
      `
        update app.automation_canvas_drafts
        set status = 'archived',
            archived_at = timezone('utc', now()),
            updated_by_user_id = $3,
            updated_at = timezone('utc', now())
        where workspace_id = $1
          and installed_automation_id = $2
          and archived_at is null
      `,
      [workspaceId, automationId, actor.id],
    );
  }

  async getDraftForMutation(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
  ): Promise<CanvasDraftRow> {
    return this.ensureDraft(actor, access, automationId);
  }

  async getDraftForUpdate(
    client: {
      query: (
        text: string,
        values?: readonly unknown[],
      ) => Promise<{ rows: CanvasDraftRow[] }>;
    },
    access: AccessContext,
    automationId: string,
    draftId: string,
  ): Promise<CanvasDraftRow | null> {
    const workspaceId = requireWorkspaceId(access);
    const result = await client.query(
      `
        select
          id,
          workspace_id,
          project_id,
          installed_automation_id,
          source_template_version_id,
          workflow,
          workflow_hash,
          revision_counter,
          validation_summary,
          status,
          normalized_canvas,
          created_at,
          updated_at
        from app.automation_canvas_drafts
        where id = $1
          and workspace_id = $2
          and installed_automation_id = $3
          and archived_at is null
        for update
      `,
      [draftId, workspaceId, automationId],
    );
    return result.rows[0] ?? null;
  }

  async getAutomation(
    access: AccessContext,
    automationId: string,
  ): Promise<CanvasAutomationRow> {
    const workspaceId = requireWorkspaceId(access);
    const row = await this.databaseService.one<CanvasAutomationRow>(
      `
        select
          id,
          workspace_id,
          source_template_version_id,
          title,
          version,
          workflow,
          runtime_flow_id,
          sync_hash
        from app.installed_automations
        where id = $1
          and workspace_id = $2
          and deleted_at is null
        limit 1
      `,
      [automationId, workspaceId],
    );

    if (!row) {
      throw new AppHttpException(
        'AUTOMATION_NOT_FOUND',
        404,
        'Installed automation was not found.',
      );
    }

    return row;
  }

  async saveWorkflow(
    access: AccessContext,
    actor: AuthenticatedActor,
    draftId: string,
    automationId: string,
    workflow: LexFrameWorkflowV2,
    validation: CanvasValidationSummary,
    hash: string,
    revisionCounter: number,
  ) {
    const workspaceId = requireWorkspaceId(access);
    const normalizedCanvas = this.buildCanvasReadModel(workflow, validation);
    const draftStatus = normalizeDraftStatus(null, validation);

    await this.databaseService.query(
      `
        update app.automation_canvas_drafts
        set
          workflow = $4::jsonb,
          workflow_hash = $5,
          validation_summary = $6::jsonb,
          runtime_projection = $7::jsonb,
          revision_counter = $8,
          normalized_canvas = $9::jsonb,
          runtime_projection_status = $10,
          activepieces_sync_status = case
            when activepieces_sync_status = 'synced' then 'sync_required'
            else activepieces_sync_status
          end,
          status = $11,
          updated_by_user_id = $12,
          updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
          and installed_automation_id = $3
      `,
      [
        draftId,
        workspaceId,
        automationId,
        JSON.stringify(workflow),
        hash,
        JSON.stringify(validation),
        JSON.stringify(workflow.runtime_projection),
        revisionCounter,
        JSON.stringify(normalizedCanvas),
        workflow.runtime_projection.status,
        draftStatus,
        actor.id,
      ],
    );
  }

  listCanvasModules(): readonly CanvasModuleSummary[] {
    return [
      moduleItem(
        'manual_start',
        'Запуск вручную',
        'trigger',
        'trigger',
        'Play',
      ),
      moduleItem(
        'case_material_analysis',
        'Проанализировать материалы',
        'legal',
        'legalAction',
        'Search',
      ),
      moduleItem(
        'case_law_search',
        'Найти практику',
        'legal',
        'legalAction',
        'BookOpen',
      ),
      moduleItem(
        'claim_draft',
        'Подготовить документ',
        'legal',
        'legalAction',
        'FileText',
      ),
      moduleItem(
        'ai_fact_extract',
        'AI-извлечение фактов',
        'ai',
        'aiAction',
        'Sparkles',
      ),
      moduleItem('condition', 'Условие', 'control', 'condition', 'GitBranch'),
      moduleItem(
        'human_approval',
        'Согласование',
        'control',
        'approval',
        'CheckCircle',
      ),
      moduleItem(
        'email_delivery',
        'Доставка результата',
        'delivery',
        'delivery',
        'Send',
      ),
      moduleItem('end', 'Завершение', 'output', 'end', 'CircleStop'),
    ];
  }

  hashWorkflow(workflow: LexFrameWorkflowV2): string {
    return createHash('sha256')
      .update(stableStringify(canonicalWorkflowHashInput(workflow)))
      .digest('hex');
  }

  withValidation(
    workflow: LexFrameWorkflowV2,
    validation: CanvasValidationSummary,
  ): LexFrameWorkflowV2 {
    const canonical = canonicalizeWorkflowV2(workflow);
    return {
      ...canonical,
      validation,
      validation_state: validation,
      runtime_projection: {
        ...canonical.runtime_projection,
        can_compile: validation.can_compile,
        can_run: validation.can_run,
      },
      updated_at: canonical.updated_at,
    };
  }

  buildPermissions(access: AccessContext): CanvasPermissions {
    const permissions = new Set<PermissionCode>(access.permissions);
    const canEdit = permissions.has('canvas.edit');
    const canViewVersions =
      permissions.has('canvas.version.view') || permissions.has('canvas.view');
    const canCompareVersions =
      permissions.has('canvas.version.compare') ||
      permissions.has('canvas.view');
    const canPublish =
      permissions.has('canvas.publish') ||
      permissions.has('automation.publish');
    const canRestoreVersion =
      permissions.has('canvas.version.restore_as_draft') ||
      permissions.has('canvas.restore_version');

    return {
      can_view: permissions.has('canvas.view'),
      can_edit: canEdit,
      can_publish: canPublish,
      can_test:
        permissions.has('canvas.test.validate') ||
        permissions.has('canvas.test.step') ||
        permissions.has('canvas.test.dry_run') ||
        (canEdit && permissions.has('automation.run')),
      can_add_node: permissions.has('canvas.add_node'),
      can_delete_node: permissions.has('canvas.delete_node'),
      can_add_edge: permissions.has('canvas.add_edge'),
      can_delete_edge: permissions.has('canvas.delete_edge'),
      can_edit_layout: permissions.has('canvas.edit_layout'),
      can_edit_node_config: permissions.has('canvas.edit_node_config'),
      can_edit_bindings: permissions.has('canvas.edit_bindings'),
      can_edit_conditions: permissions.has('canvas.edit_conditions'),
      can_edit_error_handlers: permissions.has('canvas.edit_error_handlers'),
      can_edit_approval_gates: permissions.has('canvas.edit_approval_gates'),
      can_edit_delivery_steps: permissions.has('canvas.edit_delivery_steps'),
      can_edit_ai_steps: permissions.has('canvas.edit_ai_steps'),
      can_edit_runtime_mapping: permissions.has('canvas.edit_runtime_mapping'),
      can_import_runtime:
        permissions.has('canvas.import_runtime') ||
        permissions.has('canvas.runtime.import_apply'),
      can_compile: permissions.has('canvas.compile'),
      can_sync_runtime: permissions.has('canvas.sync_runtime'),
      can_view_compile_preview: permissions.has('canvas.view_compile_preview'),
      can_resolve_sync_conflict:
        permissions.has('canvas.resolve_sync_conflict') ||
        permissions.has('canvas.runtime.resolve_conflict'),
      can_override_policy: permissions.has('canvas.policy_override'),
      can_security_review: permissions.has('canvas.security_review'),
      can_read_audit: permissions.has('canvas.audit_read'),
      can_export_audit: permissions.has('canvas.audit_export'),
      can_view_connections:
        permissions.has('canvas.connection_view') ||
        permissions.has('connections.manage'),
      can_request_connection: permissions.has('canvas.connection_request'),
      can_manage_connections:
        permissions.has('canvas.connection_manage') ||
        permissions.has('connections.manage'),
      can_restore_version: canRestoreVersion,
      can_view_versions: canViewVersions,
      can_compare_versions: canCompareVersions,
      can_download_version_json:
        permissions.has('canvas.version.download_json') ||
        permissions.has('canvas.view_raw_dsl') ||
        permissions.has('canvas.debug'),
      can_create_checkpoint:
        permissions.has('canvas.checkpoint.create') || canEdit,
      can_validate_publish:
        permissions.has('canvas.publish.validate') ||
        permissions.has('canvas.view_validation') ||
        canPublish,
      can_restore_version_as_draft: canRestoreVersion,
      can_rollback_version:
        permissions.has('canvas.version.rollback') || canPublish,
      can_rollback_runtime:
        permissions.has('canvas.runtime.rollback') ||
        permissions.has('canvas.runtime.overwrite'),
      can_emergency_disable:
        permissions.has('canvas.version.emergency_disable') ||
        permissions.has('incident.manage'),
      can_view_runtime_projection:
        permissions.has('canvas.version.view_runtime_projection') ||
        permissions.has('canvas.runtime.view'),
      can_manage_locks: permissions.has('canvas.manage_locks'),
      can_view_validation:
        permissions.has('canvas.view_validation') ||
        permissions.has('canvas.view'),
      can_view_raw_dsl:
        permissions.has('canvas.view_raw_dsl') ||
        permissions.has('canvas.debug'),
      can_open_advanced_builder:
        permissions.has('canvas.open_advanced_builder') &&
        permissions.has('activepieces.open_builder'),
      can_debug: permissions.has('canvas.debug'),
      can_use_ai_assistant: permissions.has('canvas.ai.use'),
      can_ai_explain: permissions.has('canvas.ai.explain'),
      can_ai_propose_patch: permissions.has('canvas.ai.propose_patch'),
      can_ai_apply_patch: permissions.has('canvas.ai.apply_patch'),
      can_ai_configure_step: permissions.has('canvas.ai.configure_step'),
      can_ai_fix_validation: permissions.has('canvas.ai.fix_validation'),
      can_ai_debug_test: permissions.has('canvas.ai.debug_test'),
      can_ai_view_raw_context: permissions.has('canvas.ai.view_raw_context'),
      can_ai_use_sensitive_context: permissions.has(
        'canvas.ai.use_sensitive_context',
      ),
      can_ai_admin_diagnostics: permissions.has('canvas.ai.admin_diagnostics'),
    };
  }

  buildCanvasReadModel(
    workflow: LexFrameWorkflowV2,
    validation: CanvasValidationSummary = workflow.validation,
  ): CanvasReadModel {
    const issuesByNode = new Map<string, ValidationIssueSummary>();
    const issuesByEdge = new Map<string, ValidationIssueSummary>();
    for (const item of validation.issues ?? []) {
      if (item.affected_node_id) {
        issuesByNode.set(
          item.affected_node_id,
          mergeIssueState(
            issuesByNode.get(item.affected_node_id),
            item.severity,
          ),
        );
      }
      if (item.affected_edge_id) {
        issuesByEdge.set(
          item.affected_edge_id,
          mergeIssueState(
            issuesByEdge.get(item.affected_edge_id),
            item.severity,
          ),
        );
      }
    }
    return {
      nodes: workflow.nodes.map((node) => {
        const issueState = issuesByNode.get(node.id);
        return {
          id: node.id,
          type: node.type,
          position: {
            x: node.canvas?.x ?? node.layout.x,
            y: node.canvas?.y ?? node.layout.y,
          },
          data: {
            title: node.display_name,
            subtitle: node.description ?? node.module_code ?? node.block_code,
            badges: nodeBadges(node),
            validation_state: issueState?.state ?? 'valid',
            missing_inputs_count: missingInputCount(node, validation),
          },
        };
      }),
      edges: workflow.edges.map((edge) => ({
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        source_handle: edge.source_handle,
        target_handle: edge.target_handle,
        type: edge.type,
        label: edge.label ?? null,
        validation_state:
          issuesByEdge.get(edge.id)?.state ?? edge.validation_state ?? 'valid',
      })),
      viewport: {
        x: 0,
        y: 0,
        zoom: 1,
      },
    };
  }

  private createInitialWorkflow(
    automation: CanvasAutomationRow,
    draftId: string,
    now: string,
  ): LexFrameWorkflowV2 {
    const existing = automation.workflow;
    if (existing?.schema_version === '2.0') {
      return normalizeWorkflowV2({
        ...(existing as unknown as LexFrameWorkflowV2),
        id: `canvas_${automation.id}`,
        workspace_id: automation.workspace_id,
        automation_id: automation.id,
        draft_version_id:
          (existing as { readonly draft_version_id?: string }).draft_version_id ??
          draftId,
        published_version_id: null,
        metadata: {
          ...(existing as unknown as LexFrameWorkflowV2).metadata,
          status: 'draft',
        },
      });
    }

    const nodes = this.buildInitialNodes(existing);
    const edges = this.buildInitialEdges(existing, nodes);
    const workflow: LexFrameWorkflowV2 = {
      schema_version: '2.0',
      id: `canvas_${automation.id}`,
      workspace_id: automation.workspace_id,
      project_id: null,
      automation_id: automation.id,
      draft_version_id: draftId,
      published_version_id: null,
      revision_counter: 0,
      metadata: {
        title: automation.title,
        description: 'LexFrame Canvas v2 draft.',
        status: 'draft',
        canvas_mode: 'guided_vertical',
      },
      workflow_inputs: normalizeDataFields(
        existing?.workflow_inputs ?? existing?.inputs,
      ),
      workflow_outputs: normalizeDataFields(
        existing?.workflow_outputs ?? existing?.outputs,
      ),
      inputs: normalizeDataFields(
        existing?.workflow_inputs ?? existing?.inputs,
      ),
      outputs: normalizeDataFields(
        existing?.workflow_outputs ?? existing?.outputs,
      ),
      nodes,
      edges,
      variables: [],
      secrets_policy: defaultSecretsPolicy(),
      data_contracts: {},
      policies: defaultWorkflowPolicy(),
      validation_state: emptyValidation(),
      validation: emptyValidation(),
      runtime_projection: {
        status: automation.runtime_flow_id ? 'synced' : 'not_compiled',
        can_compile: false,
        can_run: false,
        activepieces_flow_id: automation.runtime_flow_id,
        sync_hash: automation.sync_hash,
        warnings: ['Compiler preview is a Stage 16.1 placeholder.'],
      },
      canvas_layout: {
        layout_version: '1.0',
        mode: 'guided_vertical',
        updated_at: now,
        nodes: Object.fromEntries(
          nodes.map((node) => [node.id, node.canvas ?? node.layout]),
        ),
      },
      layout: {
        mode: 'guided_vertical',
        updated_at: now,
      },
      created_at: now,
      updated_at: now,
    };

    return canonicalizeWorkflowV2(applyGuidedLayout(workflow));
  }

  private buildInitialNodes(
    existing: Record<string, unknown>,
  ): readonly WorkflowNode[] {
    const trigger = createWorkflowNode({
      id: 'trigger_manual_start',
      type: 'trigger',
      displayName: 'Запуск вручную',
      description: 'Ручной запуск сценария пользователем.',
      triggerKind: 'manual_start',
      x: 160,
      y: 60,
    });
    const steps = Array.isArray(existing?.steps) ? existing.steps : [];
    const stepNodes = steps
      .map((candidate, index) => {
        if (!isRecord(candidate)) {
          return null;
        }
        const stepId =
          stringValue(candidate.stepId) ?? stringValue(candidate.id);
        const moduleCode = stringValue(candidate.moduleCode);
        if (!stepId || !moduleCode) {
          return null;
        }

        return createWorkflowNode({
          id: stepId,
          type: nodeTypeForStep(candidate, moduleCode),
          displayName:
            stringValue(candidate.title) ??
            stringValue(candidate.name) ??
            `Шаг ${index + 1}`,
          description: stringValue(candidate.description),
          moduleCode,
          x: 160,
          y: 210 + index * 150,
        });
      })
      .filter((node): node is WorkflowNode => node !== null);
    const end = createWorkflowNode({
      id: 'end_success',
      type: 'end',
      displayName: 'Сценарий завершён',
      description: 'Явный результат выполнения workflow.',
      x: 160,
      y: 210 + stepNodes.length * 150,
    });

    return [trigger, ...stepNodes, end];
  }

  private buildInitialEdges(
    existing: Record<string, unknown>,
    nodes: readonly WorkflowNode[],
  ): readonly WorkflowEdge[] {
    const stepNodeIds = nodes
      .filter(
        (node) =>
          node.type !== 'trigger' &&
          node.type !== 'end' &&
          node.type !== 'note',
      )
      .map((node) => node.id);

    if (stepNodeIds.length === 0) {
      return [
        createWorkflowEdge({
          source: 'trigger_manual_start',
          target: 'end_success',
        }),
      ];
    }

    const transitionEdges = Array.isArray(existing?.transitions)
      ? existing.transitions
          .map((candidate) => {
            if (!isRecord(candidate)) {
              return null;
            }
            const from = stringValue(candidate.from);
            const to = stringValue(candidate.to);
            if (!from || !to) {
              return null;
            }
            return createWorkflowEdge({
              source: from,
              target: to,
              label: stringValue(candidate.condition),
              condition: stringValue(candidate.condition),
            });
          })
          .filter((edge): edge is WorkflowEdge => edge !== null)
      : [];

    if (transitionEdges.length > 0) {
      const incoming = new Set(
        transitionEdges.map((edge) => edge.target_node_id),
      );
      const outgoing = new Set(
        transitionEdges.map((edge) => edge.source_node_id),
      );
      return [
        createWorkflowEdge({
          source: 'trigger_manual_start',
          target:
            stepNodeIds.find((id) => !incoming.has(id)) ?? stepNodeIds[0]!,
        }),
        ...transitionEdges,
        createWorkflowEdge({
          source:
            [...stepNodeIds].reverse().find((id) => !outgoing.has(id)) ??
            stepNodeIds[stepNodeIds.length - 1]!,
          target: 'end_success',
        }),
      ];
    }

    const edges: WorkflowEdge[] = [];
    let previous = 'trigger_manual_start';
    for (const stepId of stepNodeIds) {
      edges.push(createWorkflowEdge({ source: previous, target: stepId }));
      previous = stepId;
    }
    edges.push(createWorkflowEdge({ source: previous, target: 'end_success' }));
    return edges;
  }

  private buildFeatureFlags(): CanvasFeatureFlags {
    return {
      canvas_v2: true,
      canvas_ai_assistant: true,
      canvas_advanced_graph: false,
      canvas_reverse_sync: true,
    };
  }

  private async hydrateWorkflowSchemas(
    workflow: LexFrameWorkflowV2,
  ): Promise<LexFrameWorkflowV2> {
    const normalized = normalizeWorkflowV2(workflow);
    const moduleCodes = [
      ...new Set(
        normalized.nodes
          .map((node) => node.module_code ?? node.block_code)
          .filter((code): code is string => Boolean(code)),
      ),
    ];

    if (moduleCodes.length === 0) {
      return normalized;
    }

    const result = await this.databaseService.query<ModuleSchemaRow>(
      `
        select
          lm.code,
          lv.version,
          lv.status,
          lv.input_schema,
          lv.output_schema
        from app.legal_modules lm
        left join lateral (
          select
            version,
            status,
            input_schema,
            output_schema
          from app.legal_module_versions lmv
          where lmv.module_id = lm.id
          order by
            case when lmv.status = 'published' then 0 else 1 end,
            lmv.published_at desc nulls last,
            lmv.created_at desc
          limit 1
        ) lv on true
        where lm.deleted_at is null
          and lm.code = any($1::text[])
      `,
      [moduleCodes],
    );
    const schemasByCode = new Map(result.rows.map((row) => [row.code, row]));

    return {
      ...normalized,
      inputs: normalizeDataFields(normalized.inputs),
      outputs: normalizeDataFields(normalized.outputs),
      nodes: normalized.nodes.map((node) => {
        const schema = schemasByCode.get(node.module_code ?? node.block_code);
        if (!schema) {
          const inputs = normalizeDataFields(node.inputs);
          const outputs = normalizeDataFields(node.outputs);
          return {
            ...node,
            inputs,
            outputs,
            handles: handlesWithDataPorts(node.handles, inputs, outputs),
          };
        }

        const inputs = moduleSchemaFields(schema.input_schema, node.inputs);
        const outputs = moduleSchemaFields(schema.output_schema, node.outputs);
        return {
          ...node,
          module_ref: {
            module_code: schema.code,
            module_version: schema.version,
            module_schema_hash: hashModuleSchema(schema),
            status: schema.status ?? 'draft',
          },
          module_version: schema.version,
          module_status: schema.status,
          module_schema_hash: hashModuleSchema(schema),
          dynamic_outputs_status: 'resolved',
          inputs,
          outputs,
          handles: handlesWithDataPorts(node.handles, inputs, outputs),
        };
      }),
    };
  }
}

function emptyValidation(): CanvasValidationSummary {
  return {
    status: 'valid',
    errors_count: 0,
    warnings_count: 0,
    policy_blocks_count: 0,
    issues: [],
    can_save: true,
    can_test: true,
    can_publish: true,
    can_compile: true,
    can_run: true,
    can_sync: true,
  };
}

function normalizeDataFields(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeDataField(item))
    .filter((item): item is WorkflowDataField => item !== null);
}

function normalizeWorkflowV2(workflow: LexFrameWorkflowV2): LexFrameWorkflowV2 {
  const canonical = canonicalizeWorkflowV2(workflow);
  const inputs = normalizeDataFields(
    canonical.workflow_inputs ?? canonical.inputs,
  );
  const outputs = normalizeDataFields(
    canonical.workflow_outputs ?? canonical.outputs,
  );
  return canonicalizeWorkflowV2({
    ...canonical,
    workflow_inputs: inputs,
    workflow_outputs: outputs,
    inputs,
    outputs,
    nodes: workflow.nodes.map((node) => ({
      ...node,
      node_type: node.node_type ?? node.type,
      block_code:
        node.block_code ?? node.module_code ?? node.trigger_kind ?? node.id,
      inputs: normalizeDataFields(node.inputs),
      outputs: normalizeDataFields(node.outputs),
      input_bindings: normalizeNodeBindings(node),
      handles: handlesWithDataPorts(
        node.handles ?? [],
        normalizeDataFields(node.inputs),
        normalizeDataFields(node.outputs),
      ),
      test_state: node.test_state ?? { sample_data_status: 'missing' },
      policies: node.policies ?? node.policy,
      canvas: node.canvas ?? node.layout,
    })),
    edges: workflow.edges.map((edge) => ({
      ...edge,
      edge_type: edge.edge_type ?? edge.type,
      source_port_id: edge.source_port_id ?? edge.source_handle,
      target_port_id: edge.target_port_id ?? edge.target_handle,
      validation_state: edge.validation_state ?? 'valid',
    })),
  });
}

function normalizeNodeBindings(node: WorkflowNode) {
  const raw = [
    ...(Array.isArray(node.input_bindings) ? node.input_bindings : []),
    ...bindingsRecordToArray(node),
  ];
  return raw
    .map((binding) => normalizeBinding(binding))
    .filter((binding) => binding !== null);
}

function bindingsRecordToArray(node: WorkflowNode): unknown[] {
  if (!isRecord(node.bindings)) {
    return [];
  }
  return Object.entries(node.bindings).map(([inputKey, source]) => ({
    target: {
      node_id: node.id,
      input_key: inputKey,
    },
    source,
  }));
}

function moduleSchemaFields(
  entries: readonly LegalModuleIoSchema[] | null | undefined,
  fallback: readonly WorkflowDataField[],
) {
  if (!entries || entries.length === 0) {
    return normalizeDataFields(fallback);
  }
  return entries
    .map((entry) =>
      normalizeDataField({
        key: entry.code,
        label: entry.label,
        data_type: inferSchemaDataType(entry.schema),
        item_schema: entry.schema,
        required: entry.schema.required === true,
        classification: stringValue(entry.schema.classification),
        allowed_sources: entry.schema.allowed_sources,
        preview_policy: entry.schema.preview_policy,
      }),
    )
    .filter((field): field is WorkflowDataField => field !== null);
}

function inferSchemaDataType(schema: Record<string, unknown>) {
  const explicit =
    stringValue(schema.data_type) ??
    stringValue(schema.dataType) ??
    stringValue(schema.lexframe_type) ??
    stringValue(schema.type);
  if (explicit === 'array' && isRecord(schema.items)) {
    const itemType = inferSchemaDataType(schema.items);
    if (itemType === 'document_ref') {
      return 'document_ref[]';
    }
    if (itemType === 'legal_source_ref') {
      return 'legal_source_ref[]';
    }
  }
  return normalizeDataType(explicit ?? 'json');
}

function hashModuleSchema(schema: ModuleSchemaRow) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: schema.version,
        input_schema: schema.input_schema ?? [],
        output_schema: schema.output_schema ?? [],
      }),
    )
    .digest('hex');
}

function nodeTypeForStep(
  candidate: Record<string, unknown>,
  moduleCode: string,
): WorkflowNode['type'] {
  const kind = stringValue(candidate.kind);
  if (kind === 'deliver' || moduleCode.startsWith('delivery.')) {
    return 'delivery';
  }
  if (moduleCode.includes('approval')) {
    return 'approval';
  }
  if (moduleCode.startsWith('ai.')) {
    return 'aiAction';
  }
  return 'legalAction';
}

function moduleItem(
  code: string,
  label: string,
  category: CanvasModuleSummary['category'],
  nodeType: CanvasModuleSummary['node_type'],
  icon: string,
): CanvasModuleSummary {
  return {
    code,
    label,
    category,
    description: `${label} в юридическом workflow LexFrame.`,
    node_type: nodeType,
    icon,
    disabled: false,
    disabled_reason: null,
  };
}

function normalizeVersionStatus(status: string): CanvasVersionStatus {
  if (isCanvasVersionStatus(status)) {
    return status;
  }

  return 'draft';
}

function isCanvasVersionStatus(status: string): status is CanvasVersionStatus {
  return [
    'draft',
    'published',
    'restored',
    'runtime_synced',
    'runtime_modified',
    'archived',
  ].includes(status);
}

function normalizeDraftStatus(
  status: string | null | undefined,
  validation: CanvasValidationSummary,
) {
  if (
    status === 'editing' ||
    status === 'validating' ||
    status === 'ready_to_publish' ||
    status === 'published_to_version' ||
    status === 'conflict' ||
    status === 'archived' ||
    status === 'draft' ||
    status === 'published' ||
    status === 'restored' ||
    status === 'runtime_synced' ||
    status === 'runtime_modified'
  ) {
    return status;
  }
  if (validation.status === 'invalid') {
    return 'invalid';
  }
  if (validation.can_publish) {
    return 'ready_to_publish';
  }
  return 'valid';
}

interface ValidationIssueSummary {
  readonly state: 'valid' | 'warning' | 'invalid';
}

function mergeIssueState(
  current: ValidationIssueSummary | undefined,
  severity: string,
): ValidationIssueSummary {
  if (severity === 'error' || severity === 'policy_block') {
    return { state: 'invalid' };
  }
  if (current?.state === 'invalid') {
    return current;
  }
  return { state: 'warning' };
}

function nodeBadges(node: WorkflowNode): readonly string[] {
  const badges: string[] = [];
  if (node.policy?.ai_action || node.policies?.ai_action) {
    badges.push('AI');
  }
  if (node.policy?.external_action || node.policies?.external_action) {
    badges.push('External');
  }
  const risk = node.policy?.risk_level ?? node.policies?.risk_level;
  if (typeof risk === 'string' && risk.length > 0) {
    badges.push(risk);
  }
  return badges;
}

function missingInputCount(
  node: WorkflowNode,
  validation: CanvasValidationSummary,
) {
  return validation.issues.filter(
    (issue) =>
      issue.affected_node_id === node.id &&
      issue.code === 'required_input_unbound',
  ).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { readonly code?: string }).code === '23505'
  );
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
