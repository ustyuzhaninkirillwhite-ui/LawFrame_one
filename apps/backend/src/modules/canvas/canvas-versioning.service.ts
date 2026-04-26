import type {
  CanvasCheckpointRequest,
  CanvasCheckpointResponse,
  CanvasPublishBlocker,
  CanvasPublishReport,
  CanvasPublishValidateResponse,
  CanvasRollbackImpactResponse,
  CanvasRollbackRequest,
  CanvasRollbackResponse,
  CanvasRuntimeProjectionVersion,
  CanvasVersionCompareResponse,
  CanvasVersionExportResponse,
  CanvasVersionStateResponse,
  CanvasVersionSummary,
  CanvasVersionsResponse,
  LexFrameWorkflowV2,
  RuntimeBindingDto,
  RuntimeProjectionOutput,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { requireWorkspaceId } from './canvas-access';
import { CanvasDraftService } from './canvas-draft.service';
import { CanvasRuntimeProjectionService } from './canvas-runtime-projection.service';
import { CanvasSnapshotService } from './canvas-snapshot.service';
import { CanvasValidationService } from './canvas-validation.service';
import { CanvasVersionDiffService } from './canvas-version-diff.service';

interface VersionArtifact {
  readonly id: string;
  readonly status: string;
  readonly title: string | null;
  readonly version_no: number | null;
  readonly workflow: LexFrameWorkflowV2;
  readonly normalized_canvas: unknown;
  readonly workflow_hash: string;
  readonly runtime_projection_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface RuntimeBindingRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly installed_automation_id: string;
  readonly automation_version_id: string | null;
  readonly runtime_projection_id: string | null;
  readonly runtime: RuntimeBindingDto['runtime'];
  readonly external_project_id: string | null;
  readonly external_flow_id: string | null;
  readonly activepieces_flow_version_id: string | null;
  readonly status: string;
  readonly source_workflow_hash: string | null;
  readonly runtime_hash: string | null;
  readonly last_synced_hash: string | null;
  readonly last_compile_report_id: string | null;
  readonly last_synced_at: string | null;
  readonly last_checked_at: string | null;
  readonly active: boolean;
  readonly projection: unknown;
}

@Injectable()
export class CanvasVersioningService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly draftService: CanvasDraftService,
    private readonly validationService: CanvasValidationService,
    private readonly runtimeProjectionService: CanvasRuntimeProjectionService,
    private readonly snapshotService: CanvasSnapshotService,
    private readonly diffService: CanvasVersionDiffService,
    private readonly auditService: AuditService,
  ) {}

  async getVersionState(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
  ): Promise<CanvasVersionStateResponse> {
    const workspaceId = requireWorkspaceId(access);
    const [draft, automation, binding, latestCheckpoint, conflict] =
      await Promise.all([
        this.draftService.ensureDraft(actor, access, automationId),
        this.loadAutomationState(workspaceId, automationId),
        this.loadRuntimeBinding(workspaceId, automationId),
        this.loadLatestCheckpoint(workspaceId, automationId),
        this.loadRuntimeConflict(workspaceId, automationId),
      ]);
    const activeVersion = automation?.active_canvas_version_id
      ? await this.loadVersionSummary(
          workspaceId,
          automationId,
          automation.active_canvas_version_id,
        )
      : await this.loadLatestPublishedVersion(workspaceId, automationId);

    return {
      automation_id: automationId,
      active_draft: {
        draft_id: draft.id,
        revision: draft.revision_counter,
        workflow_hash: draft.workflow_hash,
        status:
          draft.status as CanvasVersionStateResponse['active_draft']['status'],
      },
      active_published_version: activeVersion,
      runtime_binding: toBindingDto(binding),
      disabled_state: {
        disabled: Boolean(automation?.production_disabled_at),
        reason:
          automation?.production_disabled_reason ??
          automation?.disabled_reason ??
          null,
        disabled_at: automation?.production_disabled_at ?? null,
        disabled_by: automation?.production_disabled_by ?? null,
      },
      latest_checkpoint: latestCheckpoint,
      runtime_conflict: {
        has_conflict: Boolean(conflict),
        conflict_id: conflict?.id ?? null,
        status: conflict?.status ?? null,
      },
      permissions: this.draftService.buildPermissions(access),
    };
  }

  async listVersions(
    access: AccessContext,
    automationId: string,
    query: {
      readonly status?: string | null;
      readonly include_checkpoints?: boolean;
      readonly cursor?: string | null;
      readonly limit?: number | null;
    } = {},
  ): Promise<CanvasVersionsResponse> {
    const workspaceId = requireWorkspaceId(access);
    const limit = Math.max(1, Math.min(query.limit ?? 50, 100));
    const statusFilter =
      query.status && query.status !== 'all' ? query.status : null;
    const automation = await this.loadAutomationState(
      workspaceId,
      automationId,
    );

    const drafts = await this.databaseService.query<{
      readonly id: string;
      readonly status: string;
      readonly title: string | null;
      readonly workflow_hash: string;
      readonly revision_counter: number;
      readonly validation_status: string | null;
      readonly created_at: string;
      readonly updated_at: string;
    }>(
      `
        select
          d.id,
          d.status,
          d.workflow -> 'metadata' ->> 'title' as title,
          d.workflow_hash,
          d.revision_counter,
          d.validation_summary ->> 'status' as validation_status,
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
        limit $3
      `,
      [workspaceId, automationId, limit],
    );

    const published = await this.databaseService.query<{
      readonly id: string;
      readonly status: string;
      readonly title: string | null;
      readonly workflow_hash: string;
      readonly validation_status: string | null;
      readonly version_no: number;
      readonly runtime_projection_id: string | null;
      readonly runtime_sync_status: string | null;
      readonly published_at: string | null;
      readonly created_at: string;
      readonly updated_at: string;
    }>(
      `
        select
          v.id,
          v.status,
          coalesce(v.version_name, v.workflow -> 'metadata' ->> 'title') as title,
          v.workflow_hash,
          coalesce(vr.status, vr.summary ->> 'status') as validation_status,
          v.version_no,
          v.runtime_projection_id,
          b.status as runtime_sync_status,
          v.published_at,
          v.created_at,
          coalesce(v.archived_at, v.published_at, v.created_at) as updated_at
        from app.automation_canvas_versions v
        left join app.automation_canvas_validation_results vr
          on vr.id = v.validation_result_id
        left join app.automation_runtime_bindings b
          on b.workspace_id = v.workspace_id
         and b.installed_automation_id = v.installed_automation_id
         and b.automation_version_id = v.id
        where v.workspace_id = $1
          and v.installed_automation_id = $2
          and ($3::text is null or v.status = $3)
        order by v.version_no desc
        limit $4
      `,
      [workspaceId, automationId, statusFilter, limit],
    );

    const checkpoints = query.include_checkpoints
      ? await this.databaseService.query<{
          readonly id: string;
          readonly snapshot_hash: string;
          readonly revision: number;
          readonly reason: string;
          readonly checkpoint_name: string | null;
          readonly checkpoint_kind: string | null;
          readonly is_named: boolean;
          readonly created_at: string;
        }>(
          `
            select id, snapshot_hash, revision, reason, checkpoint_name, checkpoint_kind, is_named, created_at
            from app.automation_canvas_snapshots
            where workspace_id = $1
              and installed_automation_id = $2
            order by created_at desc
            limit $3
          `,
          [workspaceId, automationId, limit],
        )
      : { rows: [] };

    const versionRows: CanvasVersionSummary[] = [
      ...drafts.rows.map((row) => ({
        id: row.id,
        status: normalizeVersionStatus(row.status),
        title: row.title ?? 'Canvas draft',
        workflow_hash: row.workflow_hash,
        revision_counter: row.revision_counter,
        validation_status: normalizeValidationStatus(row.validation_status),
        is_current: row.id === drafts.rows[0]?.id,
        is_active: false,
        entry_type: 'draft' as const,
        version_no: null,
        runtime_projection_id: null,
        runtime_sync_status: null,
        published_at: null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
      ...published.rows.map((row) => ({
        id: row.id,
        status: normalizeVersionStatus(row.status),
        title: row.title ?? `Version ${row.version_no}`,
        workflow_hash: row.workflow_hash,
        revision_counter: 0,
        validation_status: normalizeValidationStatus(row.validation_status),
        is_current: row.id === automation?.active_canvas_version_id,
        is_active: row.id === automation?.active_canvas_version_id,
        entry_type: 'published_version' as const,
        version_no: row.version_no,
        runtime_projection_id: row.runtime_projection_id,
        runtime_sync_status: mapRuntimeStatus(row.runtime_sync_status),
        published_at: row.published_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
      ...checkpoints.rows.map((row) => ({
        id: row.id,
        status: 'draft' as const,
        title:
          row.checkpoint_name ??
          `${row.is_named ? 'Named' : 'Auto'} checkpoint r${row.revision}`,
        workflow_hash: row.snapshot_hash,
        revision_counter: row.revision,
        validation_status: 'valid' as const,
        is_current: false,
        is_active: false,
        entry_type: row.is_named
          ? ('named_checkpoint' as const)
          : ('auto_checkpoint' as const),
        version_no: null,
        runtime_projection_id: null,
        runtime_sync_status: null,
        published_at: null,
        created_at: row.created_at,
        updated_at: row.created_at,
      })),
    ].slice(0, limit);

    return {
      current_draft_version_id: drafts.rows[0]?.id ?? null,
      active_version_id: automation?.active_canvas_version_id ?? null,
      disabled: Boolean(automation?.production_disabled_at),
      versions: versionRows,
      next_cursor: null,
    };
  }

  async createCheckpoint(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    input: CanvasCheckpointRequest = {},
  ): Promise<CanvasCheckpointResponse> {
    if (!hasAny(access, ['canvas.checkpoint.create', 'canvas.edit'])) {
      throw new AppHttpException(
        'CANVAS_PERMISSION_DENIED',
        403,
        'Canvas checkpoint permission is required.',
      );
    }
    const response = await this.snapshotService.createSnapshot(
      actor,
      access,
      automationId,
      {
        ...input,
        reason: input.reason ?? 'manual_save',
        is_named: input.is_named ?? Boolean(input.checkpoint_name),
        checkpoint_kind: input.checkpoint_kind ?? 'manual',
      },
    );
    await this.audit('canvas.checkpoint.created', actor, access, automationId, {
      snapshotId: response.snapshot.id,
      checkpointName: response.snapshot.checkpoint_name,
      checkpointKind: response.snapshot.checkpoint_kind,
    });
    return response;
  }

  async compareVersions(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    fromId: string,
    toId: string,
  ): Promise<CanvasVersionCompareResponse> {
    if (!hasAny(access, ['canvas.version.compare', 'canvas.view'])) {
      throw new AppHttpException(
        'CANVAS_PERMISSION_DENIED',
        403,
        'Canvas version compare permission is required.',
      );
    }
    const workspaceId = requireWorkspaceId(access);
    const [from, to] = await Promise.all([
      this.loadArtifact(workspaceId, automationId, fromId),
      this.loadArtifact(workspaceId, automationId, toId),
    ]);
    const result = this.diffService.compare({
      automationId,
      fromId: from.id,
      toId: to.id,
      fromWorkflow: from.workflow,
      toWorkflow: to.workflow,
    });
    await this.audit(
      'canvas.version.diff.viewed',
      actor,
      access,
      automationId,
      {
        fromId,
        toId,
        changedNodes: result.summary.changed_nodes,
      },
    );
    return result;
  }

  async validatePublish(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    input: {
      readonly draft_id?: string | null;
      readonly expected_revision?: number | null;
    } = {},
  ): Promise<CanvasPublishValidateResponse> {
    if (
      !hasAny(access, [
        'canvas.publish.validate',
        'canvas.view_validation',
        'canvas.publish',
      ])
    ) {
      throw new AppHttpException(
        'CANVAS_PERMISSION_DENIED',
        403,
        'Canvas publish validation permission is required.',
      );
    }
    const draft = await this.draftService.ensureDraft(
      actor,
      access,
      automationId,
    );
    const blockers: CanvasPublishBlocker[] = [];
    if (input.draft_id && input.draft_id !== draft.id) {
      blockers.push(
        blocker(
          'DRAFT_MISMATCH',
          'Draft mismatch',
          'Request draft_id does not match the active draft.',
          'revision',
        ),
      );
    }
    if (
      input.expected_revision !== undefined &&
      input.expected_revision !== null &&
      input.expected_revision !== draft.revision_counter
    ) {
      blockers.push(
        blocker(
          'REVISION_CHANGED',
          'Draft changed',
          'Draft revision changed after validation.',
          'revision',
        ),
      );
    }
    const validation = this.validationService.publishGateValidate(
      draft.workflow,
    );
    const projection = this.runtimeProjectionService.preview(draft.workflow);
    blockers.push(
      ...validation.issues
        .filter(
          (issue) =>
            issue.severity === 'error' ||
            issue.severity === 'policy_block' ||
            issue.blocks?.includes('publish'),
        )
        .map((issue) =>
          blocker(
            issue.code,
            issue.title,
            issue.message,
            issue.severity === 'policy_block' ? 'policy' : 'validation',
            issue.affected_node_id,
          ),
        ),
    );
    blockers.push(
      ...projection.unsupported_nodes.map((node) =>
        blocker(
          'RUNTIME_MAPPING_MISSING',
          'Runtime mapping missing',
          node.reason,
          'runtime',
          node.node_id,
        ),
      ),
    );
    const report = this.buildPublishReport(
      draft.id,
      draft.workflow,
      draft.workflow_hash,
      draft.revision_counter,
      validation,
      projection,
      blockers,
    );
    await this.audit('canvas.publish.validation', actor, access, automationId, {
      draftId: draft.id,
      canPublish: report.can_publish,
      blockers: report.blockers.length,
    });
    return {
      automation_id: automationId,
      report,
      runtime_projection: projection,
    };
  }

  async rollbackImpact(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    input: {
      readonly rollback_type?: CanvasRollbackRequest['rollback_type'] | null;
      readonly target_version_id?: string | null;
    },
  ): Promise<CanvasRollbackImpactResponse> {
    const workspaceId = requireWorkspaceId(access);
    const rollbackType = input.rollback_type ?? 'publish_previous_version';
    const automation = await this.loadAutomationState(
      workspaceId,
      automationId,
    );
    const targetId = input.target_version_id ?? null;
    const counts = await this.loadRunImpact(workspaceId, automationId);
    const blockers: CanvasPublishBlocker[] = [];
    let diff: CanvasVersionCompareResponse | null = null;
    if (rollbackType !== 'emergency_disable' && !targetId) {
      blockers.push(
        blocker(
          'TARGET_VERSION_REQUIRED',
          'Target version required',
          'Rollback requires target_version_id.',
          'revision',
        ),
      );
    }
    if (
      targetId &&
      automation?.active_canvas_version_id &&
      targetId !== automation.active_canvas_version_id
    ) {
      diff = await this.compareVersions(
        actor,
        access,
        automationId,
        automation.active_canvas_version_id,
        targetId,
      );
    }
    const response: CanvasRollbackImpactResponse = {
      automation_id: automationId,
      rollback_type: rollbackType,
      target_version_id: targetId,
      current_active_version_id: automation?.active_canvas_version_id ?? null,
      impact_report: {
        ...counts,
        policy:
          'Running and waiting approval runs continue on their stored snapshots. Queued runs keep the current queue policy unless explicitly cancelled.',
        warnings: [
          counts.running_runs > 0
            ? 'Running runs will not be mutated by rollback.'
            : null,
          counts.waiting_delivery_approval_runs > 0
            ? 'Waiting delivery approval should be policy-rechecked after rollback.'
            : null,
        ].filter((item): item is string => Boolean(item)),
      },
      diff,
      can_rollback: blockers.length === 0,
      blockers,
    };
    await this.audit(
      'canvas.rollback.impact_viewed',
      actor,
      access,
      automationId,
      {
        rollbackType,
        targetId,
        canRollback: response.can_rollback,
      },
    );
    return response;
  }

  async rollback(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    input: CanvasRollbackRequest,
  ): Promise<CanvasRollbackResponse> {
    if (
      !input.reason?.trim() ||
      !input.confirm_impact ||
      !input.idempotency_key
    ) {
      throw new AppHttpException(
        'CANVAS_ROLLBACK_CONFIRMATION_REQUIRED',
        400,
        'Rollback requires reason, confirm_impact, and idempotency_key.',
      );
    }
    this.assertRollbackPermission(access, input.rollback_type);
    const workspaceId = requireWorkspaceId(access);
    const existing = await this.loadRollbackByKey(
      workspaceId,
      automationId,
      input.idempotency_key,
    );
    if (existing) {
      return this.rollbackResponseFromRow(workspaceId, automationId, existing);
    }
    if (input.rollback_type === 'restore_as_draft') {
      if (!input.target_version_id) {
        throw new AppHttpException(
          'CANVAS_ROLLBACK_TARGET_REQUIRED',
          400,
          'target_version_id is required.',
        );
      }
      await this.draftService.createDraftFromVersion(
        actor,
        access,
        automationId,
        input.target_version_id,
      );
      return this.recordRollback(
        actor,
        access,
        automationId,
        input,
        null,
        input.target_version_id,
        null,
        null,
      );
    }
    if (input.rollback_type === 'emergency_disable') {
      return this.emergencyDisable(actor, access, automationId, {
        reason: input.reason,
        idempotency_key: input.idempotency_key,
      });
    }
    if (!input.target_version_id) {
      throw new AppHttpException(
        'CANVAS_ROLLBACK_TARGET_REQUIRED',
        400,
        'target_version_id is required.',
      );
    }
    const automation = await this.loadAutomationState(
      workspaceId,
      automationId,
    );
    if (
      input.expected_active_version_id &&
      input.expected_active_version_id !== automation?.active_canvas_version_id
    ) {
      throw new AppHttpException(
        'CANVAS_ROLLBACK_ACTIVE_VERSION_CHANGED',
        409,
        'Active Canvas version changed before rollback.',
      );
    }
    const target = await this.loadArtifact(
      workspaceId,
      automationId,
      input.target_version_id,
    );
    const beforeBinding = await this.loadRuntimeBinding(
      workspaceId,
      automationId,
    );
    let afterBinding: RuntimeBindingRow | null = beforeBinding;
    if (input.rollback_type === 'runtime_binding_rollback' && !beforeBinding) {
      throw new AppHttpException(
        'CANVAS_RUNTIME_BINDING_NOT_FOUND',
        404,
        'Runtime binding rollback requires an existing runtime binding.',
      );
    }

    await this.databaseService.transaction(async (client) => {
      if (input.rollback_type === 'runtime_binding_rollback') {
        const projection = await this.loadProjectionForVersion(
          workspaceId,
          automationId,
          target.id,
        );
        if (!projection) {
          throw new AppHttpException(
            'CANVAS_RUNTIME_PROJECTION_NOT_FOUND',
            404,
            'Target version has no runtime projection.',
          );
        }
        if (
          beforeBinding?.runtime_hash &&
          projection.projection_hash !== beforeBinding.runtime_hash &&
          projection.projection_hash !== beforeBinding.last_synced_hash
        ) {
          throw new AppHttpException(
            'CANVAS_RUNTIME_PROJECTION_INCOMPATIBLE',
            409,
            'Runtime binding rollback requires a hash-compatible projection.',
          );
        }
        await client.query(
          `
            update app.automation_runtime_bindings
            set automation_version_id = $4,
                runtime_projection_id = $5,
                source_workflow_hash = $6,
                updated_at = timezone('utc', now())
            where workspace_id = $1
              and installed_automation_id = $2
              and id = $3
          `,
          [
            workspaceId,
            automationId,
            beforeBinding?.id,
            target.id,
            projection.id,
            target.workflow_hash,
          ],
        );
      } else {
        await client.query(
          `
            update app.installed_automations
            set active_canvas_version_id = $3,
                workflow = $4::jsonb,
                workflow_state = 'published',
                sync_state = case when sync_state = 'synced' then 'pending' else sync_state end,
                production_disabled_at = null,
                production_disabled_reason = null,
                production_disabled_by = null,
                updated_at = timezone('utc', now())
            where workspace_id = $1
              and id = $2
          `,
          [
            workspaceId,
            automationId,
            target.id,
            JSON.stringify(target.workflow),
          ],
        );
      }
    });

    afterBinding = await this.loadRuntimeBinding(workspaceId, automationId);
    return this.recordRollback(
      actor,
      access,
      automationId,
      input,
      automation?.active_canvas_version_id ?? null,
      target.id,
      beforeBinding,
      afterBinding,
    );
  }

  async emergencyDisable(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    input: {
      readonly reason?: string | null;
      readonly idempotency_key?: string | null;
    },
  ): Promise<CanvasRollbackResponse> {
    if (
      !hasAny(access, ['canvas.version.emergency_disable', 'incident.manage'])
    ) {
      throw new AppHttpException(
        'CANVAS_PERMISSION_DENIED',
        403,
        'Emergency disable permission is required.',
      );
    }
    const workspaceId = requireWorkspaceId(access);
    const idempotencyKey =
      input.idempotency_key ??
      `emergency-disable:${automationId}:${Date.now()}`;
    const existing = await this.loadRollbackByKey(
      workspaceId,
      automationId,
      idempotencyKey,
    );
    if (existing) {
      return this.rollbackResponseFromRow(workspaceId, automationId, existing);
    }
    const reason = input.reason?.trim() || 'Emergency disable requested.';
    const automation = await this.loadAutomationState(
      workspaceId,
      automationId,
    );
    const beforeBinding = await this.loadRuntimeBinding(
      workspaceId,
      automationId,
    );
    await this.databaseService.query(
      `
        update app.installed_automations
        set production_disabled_at = timezone('utc', now()),
            production_disabled_reason = $3,
            production_disabled_by = $4,
            sync_state = 'disabled',
            available = false,
            disabled_reason = $3,
            updated_at = timezone('utc', now())
        where workspace_id = $1
          and id = $2
      `,
      [workspaceId, automationId, reason, actor.id],
    );
    return this.recordRollback(
      actor,
      access,
      automationId,
      {
        rollback_type: 'emergency_disable',
        reason,
        confirm_impact: true,
        expected_active_version_id:
          automation?.active_canvas_version_id ?? null,
        idempotency_key: idempotencyKey,
      },
      automation?.active_canvas_version_id ?? null,
      null,
      beforeBinding,
      beforeBinding,
    );
  }

  async getRuntimeProjection(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    versionId: string,
  ): Promise<CanvasRuntimeProjectionVersion> {
    if (
      !hasAny(access, [
        'canvas.version.view_runtime_projection',
        'canvas.runtime.view',
      ])
    ) {
      throw new AppHttpException(
        'CANVAS_PERMISSION_DENIED',
        403,
        'Runtime projection view permission is required.',
      );
    }
    const projection = await this.loadProjectionForVersion(
      requireWorkspaceId(access),
      automationId,
      versionId,
    );
    if (!projection) {
      throw new AppHttpException(
        'CANVAS_RUNTIME_PROJECTION_NOT_FOUND',
        404,
        'Runtime projection was not found.',
      );
    }
    await this.audit(
      'canvas.runtime_projection.viewed',
      actor,
      access,
      automationId,
      {
        versionId,
        runtimeProjectionId: projection.id,
      },
    );
    return projection;
  }

  async exportVersion(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    versionId: string,
  ): Promise<CanvasVersionExportResponse> {
    if (
      !hasAny(access, [
        'canvas.version.download_json',
        'canvas.view_raw_dsl',
        'canvas.debug',
      ])
    ) {
      throw new AppHttpException(
        'CANVAS_PERMISSION_DENIED',
        403,
        'Canvas JSON export permission is required.',
      );
    }
    const workspaceId = requireWorkspaceId(access);
    const artifact = await this.loadArtifact(
      workspaceId,
      automationId,
      versionId,
    );
    const projection = artifact.runtime_projection_id
      ? await this.getRuntimeProjection(
          actor,
          access,
          automationId,
          artifact.id,
        )
      : null;
    await this.audit('canvas.version.exported', actor, access, automationId, {
      versionId,
      workflowHash: artifact.workflow_hash,
      redacted: true,
    });
    return {
      automation_id: automationId,
      version_id: artifact.id,
      exported_at: new Date().toISOString(),
      redacted: true,
      workflow: redactSecrets(artifact.workflow) as LexFrameWorkflowV2,
      workflow_hash: artifact.workflow_hash,
      runtime_projection: projection
        ? {
            ...projection,
            projection: redactSecrets(
              projection.projection,
            ) as RuntimeProjectionOutput,
          }
        : null,
      audit_metadata: {
        exported_by_user_id: actor.id,
        title: artifact.title,
        status: artifact.status,
        version_no: artifact.version_no,
      },
    };
  }

  private buildPublishReport(
    draftId: string,
    workflow: LexFrameWorkflowV2,
    draftHash: string,
    revision: number,
    validation: CanvasPublishReport['validation'],
    projection: RuntimeProjectionOutput,
    blockers: readonly CanvasPublishBlocker[],
  ): CanvasPublishReport {
    const warningIssues = validation.issues.filter(
      (issue) => issue.severity === 'warning',
    );
    const warnings = [
      ...warningIssues.map((issue) =>
        blocker(
          issue.code,
          issue.title,
          issue.message,
          issue.category === 'runtime' ? 'runtime' : 'validation',
          issue.affected_node_id,
          'warning',
        ),
      ),
      ...projection.policy_warnings.map((warning) =>
        blocker(
          warning.code,
          'Runtime policy warning',
          warning.message,
          'policy',
          warning.node_id,
          'warning',
        ),
      ),
    ];
    return {
      draft_id: draftId,
      draft_hash: draftHash,
      expected_revision: revision,
      validation,
      blockers,
      warnings,
      graph_summary: {
        nodes: workflow.nodes.length,
        edges: workflow.edges.length,
        approval_nodes: workflow.nodes.filter(
          (node) => node.type === 'approval',
        ).length,
        external_actions: workflow.nodes.filter(
          (node) => node.policy?.external_action,
        ).length,
        ai_actions: workflow.nodes.filter((node) => node.policy?.ai_action)
          .length,
      },
      required_connections: projection.required_connections,
      required_pieces: projection.required_pieces,
      runtime_diff: [],
      projection_hash: projection.projection_hash,
      can_publish:
        validation.can_publish === true &&
        projection.can_compile === true &&
        blockers.length === 0,
      generated_at: new Date().toISOString(),
    };
  }

  private async recordRollback(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    input: CanvasRollbackRequest,
    fromVersionId: string | null,
    toVersionId: string | null,
    beforeBinding: RuntimeBindingRow | null,
    afterBinding: RuntimeBindingRow | null,
  ): Promise<CanvasRollbackResponse> {
    const workspaceId = requireWorkspaceId(access);
    const impact = await this.rollbackImpact(actor, access, automationId, {
      rollback_type: input.rollback_type,
      target_version_id: toVersionId,
    });
    const rollbackId = randomUUID();
    await this.databaseService.query(
      `
        insert into app.automation_version_rollbacks (
          id,
          workspace_id,
          automation_id,
          from_version_id,
          to_version_id,
          rollback_type,
          reason,
          impact_report,
          runtime_binding_before,
          runtime_binding_after,
          idempotency_key,
          actor_user_id,
          completed_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, timezone('utc', now()))
      `,
      [
        rollbackId,
        workspaceId,
        automationId,
        fromVersionId,
        toVersionId,
        input.rollback_type,
        input.reason,
        JSON.stringify(impact.impact_report),
        JSON.stringify(toBindingDto(beforeBinding)),
        JSON.stringify(toBindingDto(afterBinding)),
        input.idempotency_key,
        actor.id,
      ],
    );
    await this.audit('canvas.version.rollback', actor, access, automationId, {
      rollbackId,
      rollbackType: input.rollback_type,
      fromVersionId,
      toVersionId,
    });
    const state = await this.getVersionState(actor, access, automationId);
    return {
      rollback_id: rollbackId,
      automation_id: automationId,
      rollback_type: input.rollback_type,
      from_version_id: fromVersionId,
      to_version_id: toVersionId,
      active_version_id: state.active_published_version?.id ?? null,
      runtime_binding: state.runtime_binding,
      disabled_state: state.disabled_state,
      impact_report: impact.impact_report,
    };
  }

  private async rollbackResponseFromRow(
    workspaceId: string,
    automationId: string,
    row: {
      readonly id: string;
      readonly rollback_type: CanvasRollbackRequest['rollback_type'];
      readonly from_version_id: string | null;
      readonly to_version_id: string | null;
      readonly impact_report: CanvasRollbackResponse['impact_report'];
      readonly runtime_binding_after: RuntimeBindingDto | null;
    },
  ): Promise<CanvasRollbackResponse> {
    const automation = await this.loadAutomationState(
      workspaceId,
      automationId,
    );
    return {
      rollback_id: row.id,
      automation_id: automationId,
      rollback_type: row.rollback_type,
      from_version_id: row.from_version_id,
      to_version_id: row.to_version_id,
      active_version_id: automation?.active_canvas_version_id ?? null,
      runtime_binding: row.runtime_binding_after,
      disabled_state: {
        disabled: Boolean(automation?.production_disabled_at),
        reason: automation?.production_disabled_reason ?? null,
        disabled_at: automation?.production_disabled_at ?? null,
        disabled_by: automation?.production_disabled_by ?? null,
      },
      impact_report: row.impact_report,
    };
  }

  private async loadAutomationState(workspaceId: string, automationId: string) {
    return this.databaseService.one<{
      readonly id: string;
      readonly active_canvas_version_id: string | null;
      readonly production_disabled_at: string | null;
      readonly production_disabled_reason: string | null;
      readonly production_disabled_by: string | null;
      readonly disabled_reason: string | null;
    }>(
      `
        select id, active_canvas_version_id, production_disabled_at,
               production_disabled_reason, production_disabled_by, disabled_reason
        from app.installed_automations
        where workspace_id = $1
          and id = $2
          and deleted_at is null
        limit 1
      `,
      [workspaceId, automationId],
    );
  }

  private async loadLatestCheckpoint(
    workspaceId: string,
    automationId: string,
  ) {
    return this.databaseService.one<
      NonNullable<CanvasVersionStateResponse['latest_checkpoint']>
    >(
      `
        select
          id,
          draft_version_id as draft_id,
          revision,
          snapshot_hash,
          reason,
          note,
          checkpoint_name,
          checkpoint_description,
          checkpoint_kind,
          retention_until,
          is_named,
          created_at
        from app.automation_canvas_snapshots
        where workspace_id = $1
          and installed_automation_id = $2
        order by created_at desc
        limit 1
      `,
      [workspaceId, automationId],
    );
  }

  private async loadRuntimeConflict(workspaceId: string, automationId: string) {
    return this.databaseService.one<{
      readonly id: string;
      readonly status: string;
    }>(
      `
        select id, status
        from app.runtime_sync_conflicts
        where workspace_id = $1
          and automation_id = $2
          and status = 'open'
        order by created_at desc
        limit 1
      `,
      [workspaceId, automationId],
    );
  }

  private async loadVersionSummary(
    workspaceId: string,
    automationId: string,
    versionId: string,
  ): Promise<CanvasVersionSummary | null> {
    const row = await this.databaseService.one<{
      readonly id: string;
      readonly status: string;
      readonly title: string | null;
      readonly workflow_hash: string;
      readonly validation_status: string | null;
      readonly version_no: number;
      readonly runtime_projection_id: string | null;
      readonly published_at: string | null;
      readonly created_at: string;
    }>(
      `
        select v.id, v.status, coalesce(v.version_name, v.workflow -> 'metadata' ->> 'title') as title,
               v.workflow_hash, coalesce(vr.status, vr.summary ->> 'status') as validation_status,
               v.version_no, v.runtime_projection_id, v.published_at, v.created_at
        from app.automation_canvas_versions v
        left join app.automation_canvas_validation_results vr on vr.id = v.validation_result_id
        where v.workspace_id = $1
          and v.installed_automation_id = $2
          and v.id = $3
        limit 1
      `,
      [workspaceId, automationId, versionId],
    );
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      status: normalizeVersionStatus(row.status),
      title: row.title ?? `Version ${row.version_no}`,
      workflow_hash: row.workflow_hash,
      revision_counter: 0,
      validation_status: normalizeValidationStatus(row.validation_status),
      is_current: true,
      is_active: true,
      entry_type: 'published_version',
      version_no: row.version_no,
      runtime_projection_id: row.runtime_projection_id,
      runtime_sync_status: null,
      published_at: row.published_at,
      created_at: row.created_at,
      updated_at: row.published_at ?? row.created_at,
    };
  }

  private async loadLatestPublishedVersion(
    workspaceId: string,
    automationId: string,
  ) {
    const row = await this.databaseService.one<{ readonly id: string }>(
      `
        select id
        from app.automation_canvas_versions
        where workspace_id = $1
          and installed_automation_id = $2
          and status in ('published', 'restored')
        order by version_no desc
        limit 1
      `,
      [workspaceId, automationId],
    );
    return row
      ? this.loadVersionSummary(workspaceId, automationId, row.id)
      : null;
  }

  private async loadArtifact(
    workspaceId: string,
    automationId: string,
    id: string,
  ): Promise<VersionArtifact> {
    const version = await this.databaseService.one<VersionArtifact>(
      `
        select id, status, coalesce(version_name, workflow -> 'metadata' ->> 'title') as title,
               version_no, workflow, normalized_canvas, workflow_hash, runtime_projection_id,
               created_at, coalesce(archived_at, published_at, created_at) as updated_at
        from app.automation_canvas_versions
        where workspace_id = $1
          and installed_automation_id = $2
          and id = $3
        limit 1
      `,
      [workspaceId, automationId, id],
    );
    if (version) {
      return version;
    }
    const draft = await this.databaseService.one<VersionArtifact>(
      `
        select id, status, workflow -> 'metadata' ->> 'title' as title,
               null::integer as version_no, workflow, normalized_canvas, workflow_hash,
               null::uuid as runtime_projection_id, created_at, updated_at
        from app.automation_canvas_drafts
        where workspace_id = $1
          and installed_automation_id = $2
          and id = $3
        limit 1
      `,
      [workspaceId, automationId, id],
    );
    if (draft) {
      return draft;
    }
    const snapshot = await this.databaseService.one<VersionArtifact>(
      `
        select id, reason as status, coalesce(checkpoint_name, reason) as title,
               null::integer as version_no, workflow, normalized_canvas, snapshot_hash as workflow_hash,
               null::uuid as runtime_projection_id, created_at, created_at as updated_at
        from app.automation_canvas_snapshots
        where workspace_id = $1
          and installed_automation_id = $2
          and id = $3
        limit 1
      `,
      [workspaceId, automationId, id],
    );
    if (snapshot) {
      return snapshot;
    }
    throw new AppHttpException(
      'CANVAS_VERSION_NOT_FOUND',
      404,
      'Canvas version, draft, or checkpoint was not found.',
    );
  }

  private async loadRuntimeBinding(workspaceId: string, automationId: string) {
    return this.databaseService.one<RuntimeBindingRow>(
      `
        select id, workspace_id, installed_automation_id, automation_version_id,
               runtime_projection_id, runtime, external_project_id, external_flow_id,
               activepieces_flow_version_id, status, source_workflow_hash,
               runtime_hash, last_synced_hash, last_compile_report_id,
               last_synced_at, last_checked_at, active, projection
        from app.automation_runtime_bindings
        where workspace_id = $1
          and installed_automation_id = $2
          and active = true
        limit 1
      `,
      [workspaceId, automationId],
    );
  }

  private async loadProjectionForVersion(
    workspaceId: string,
    automationId: string,
    versionId: string,
  ): Promise<CanvasRuntimeProjectionVersion | null> {
    const row = await this.databaseService.one<{
      readonly id: string;
      readonly automation_id: string;
      readonly automation_version_id: string;
      readonly provider: RuntimeBindingDto['runtime'];
      readonly projection_hash: string;
      readonly projection_json: RuntimeProjectionOutput | null;
      readonly compile_report: unknown;
      readonly required_pieces: RuntimeProjectionOutput['required_pieces'];
      readonly required_connections: RuntimeProjectionOutput['required_connections'];
      readonly pinned_piece_versions: CanvasRuntimeProjectionVersion['pinned_piece_versions'];
      readonly created_at: string;
    }>(
      `
        select id, automation_id, automation_version_id, provider, projection_hash,
               projection_json, compile_report, required_pieces, required_connections,
               pinned_piece_versions, created_at
        from app.automation_runtime_projections
        where workspace_id = $1
          and automation_id = $2
          and automation_version_id = $3
        order by created_at desc
        limit 1
      `,
      [workspaceId, automationId, versionId],
    );
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      automation_id: row.automation_id,
      automation_version_id: row.automation_version_id,
      provider: row.provider,
      projection_hash: row.projection_hash,
      projection: redactSecrets(row.projection_json) as RuntimeProjectionOutput,
      compile_report: redactSecrets(row.compile_report),
      required_pieces: row.required_pieces,
      required_connections: row.required_connections,
      pinned_piece_versions: row.pinned_piece_versions,
      created_at: row.created_at,
    };
  }

  private async loadRunImpact(workspaceId: string, automationId: string) {
    const row = await this.databaseService.one<{
      readonly queued_runs: number | string;
      readonly running_runs: number | string;
      readonly waiting_approval_runs: number | string;
      readonly waiting_delivery_approval_runs: number | string;
    }>(
      `
        select
          count(*) filter (where wr.status = 'queued')::int as queued_runs,
          count(*) filter (where wr.status = 'running')::int as running_runs,
          count(*) filter (where wr.status = 'waiting_approval')::int as waiting_approval_runs,
          count(distinct dr.id) filter (where dr.status = 'waiting_approval')::int as waiting_delivery_approval_runs
        from app.workflow_runs wr
        left join app.delivery_requests dr
          on dr.workflow_run_id = wr.id
         and dr.workspace_id = wr.workspace_id
        where wr.workspace_id = $1
          and wr.installed_automation_id = $2
          and wr.status in ('queued', 'running', 'waiting_approval')
      `,
      [workspaceId, automationId],
    );
    return {
      queued_runs: Number(row?.queued_runs ?? 0),
      running_runs: Number(row?.running_runs ?? 0),
      waiting_approval_runs: Number(row?.waiting_approval_runs ?? 0),
      waiting_delivery_approval_runs: Number(
        row?.waiting_delivery_approval_runs ?? 0,
      ),
    };
  }

  private async loadRollbackByKey(
    workspaceId: string,
    automationId: string,
    idempotencyKey: string,
  ) {
    return this.databaseService.one<{
      readonly id: string;
      readonly rollback_type: CanvasRollbackRequest['rollback_type'];
      readonly from_version_id: string | null;
      readonly to_version_id: string | null;
      readonly impact_report: CanvasRollbackResponse['impact_report'];
      readonly runtime_binding_after: RuntimeBindingDto | null;
    }>(
      `
        select id, rollback_type, from_version_id, to_version_id,
               impact_report, runtime_binding_after
        from app.automation_version_rollbacks
        where workspace_id = $1
          and automation_id = $2
          and idempotency_key = $3
        limit 1
      `,
      [workspaceId, automationId, idempotencyKey],
    );
  }

  private assertRollbackPermission(
    access: AccessContext,
    rollbackType: CanvasRollbackRequest['rollback_type'],
  ) {
    const permissionsByType: Record<
      CanvasRollbackRequest['rollback_type'],
      readonly string[]
    > = {
      restore_as_draft: [
        'canvas.version.restore_as_draft',
        'canvas.restore_version',
      ],
      publish_previous_version: ['canvas.version.rollback', 'canvas.publish'],
      runtime_binding_rollback: [
        'canvas.runtime.rollback',
        'canvas.runtime.overwrite',
      ],
      emergency_disable: [
        'canvas.version.emergency_disable',
        'incident.manage',
      ],
    };
    if (!hasAny(access, permissionsByType[rollbackType])) {
      throw new AppHttpException(
        'CANVAS_PERMISSION_DENIED',
        403,
        'Canvas rollback permission is required.',
      );
    }
  }

  private async audit(
    action: string,
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action,
      entityType: 'installed_automation',
      entityId: automationId,
      result: 'success',
      metadata,
    });
  }
}

function toBindingDto(row: RuntimeBindingRow | null): RuntimeBindingDto | null {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    automation_id: row.installed_automation_id,
    automation_version_id: row.automation_version_id,
    runtime_projection_id: row.runtime_projection_id,
    runtime: row.runtime,
    activepieces_project_id: row.external_project_id,
    activepieces_flow_id: row.external_flow_id,
    activepieces_flow_version_id: row.activepieces_flow_version_id,
    status: mapRuntimeStatus(row.status),
    active: row.active,
    source_workflow_hash: row.source_workflow_hash,
    runtime_hash: row.runtime_hash,
    last_synced_hash: row.last_synced_hash,
    last_compile_report_id: row.last_compile_report_id,
    last_synced_at: row.last_synced_at,
    last_checked_at: row.last_checked_at,
  };
}

function hasAny(access: AccessContext, permissions: readonly string[]) {
  return permissions.some((permission) =>
    access.permissions.includes(permission as never),
  );
}

function blocker(
  code: string,
  title: string,
  message: string,
  category: CanvasPublishBlocker['category'],
  nodeId: string | null = null,
  severity: CanvasPublishBlocker['severity'] = 'blocker',
): CanvasPublishBlocker {
  return {
    code,
    title,
    message,
    category,
    severity,
    affected_node_id: nodeId,
  };
}

function normalizeVersionStatus(
  status: string,
): CanvasVersionSummary['status'] {
  switch (status) {
    case 'published':
    case 'restored':
    case 'runtime_synced':
    case 'runtime_modified':
    case 'superseded':
    case 'archived':
      return status;
    default:
      return 'draft';
  }
}

function normalizeValidationStatus(
  value: string | null | undefined,
): CanvasVersionSummary['validation_status'] {
  switch (value) {
    case 'valid':
    case 'valid_with_warnings':
    case 'invalid':
      return value;
    default:
      return 'invalid';
  }
}

function mapRuntimeStatus(
  status: string | null | undefined,
): RuntimeBindingDto['status'] {
  switch (status) {
    case 'not_compiled':
    case 'compile_required':
    case 'compile_failed':
    case 'compile_preview_ready':
    case 'sync_required':
    case 'syncing':
    case 'synced':
    case 'runtime_modified':
    case 'importable':
    case 'import_requires_review':
    case 'import_blocked_by_policy':
    case 'conflict':
    case 'unknown_runtime_nodes':
    case 'blocked_by_policy':
    case 'deprecated_piece':
    case 'missing_connection':
    case 'runtime_unavailable':
    case 'preview':
      return status;
    case 'pending':
      return 'sync_required';
    case 'failed':
      return 'compile_failed';
    default:
      return 'compile_required';
  }
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
      if (
        [
          'secret',
          'secret_ref',
          'provider_key',
          'providerKey',
          'credential',
          'credentials',
          'signed_url',
          'signedUrl',
          'document_text',
          'documentText',
          'raw_text',
          'rawText',
          'raw_payload',
          'rawPayload',
        ].includes(key)
      ) {
        return [key, '[redacted]'];
      }
      return [key, redactSecrets(nested)];
    }),
  );
}
