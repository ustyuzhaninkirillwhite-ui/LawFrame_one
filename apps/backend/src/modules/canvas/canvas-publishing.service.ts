import type {
  CanvasPublishBlocker,
  CanvasPublishReport,
  CanvasPublishRequest,
  CanvasPublishResponse,
  CanvasRestoreVersionResponse,
  CanvasValidationSummary,
  LexFrameWorkflowV2,
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
import { CanvasAuthorizationService } from './canvas-authorization.service';
import { CanvasDraftService } from './canvas-draft.service';
import { CanvasRuntimeProjectionService } from './canvas-runtime-projection.service';
import { CanvasSnapshotService } from './canvas-snapshot.service';
import { CanvasValidationService } from './canvas-validation.service';

@Injectable()
export class CanvasPublishingService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly draftService: CanvasDraftService,
    private readonly validationService: CanvasValidationService,
    private readonly runtimeProjectionService: CanvasRuntimeProjectionService,
    private readonly snapshotService: CanvasSnapshotService,
    private readonly auditService: AuditService,
    private readonly authorizationService: CanvasAuthorizationService,
  ) {}

  async publishDraft(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    input: CanvasPublishRequest = {},
  ): Promise<CanvasPublishResponse> {
    if (
      !access.permissions.includes('canvas.publish') &&
      !access.permissions.includes('automation.publish')
    ) {
      throw new AppHttpException(
        'CANVAS_PERMISSION_DENIED',
        403,
        'Canvas publish permission is required.',
      );
    }
    const securityDecision = await this.authorizationService.authorizeEndpoint({
      actor,
      access,
      automationId,
      endpoint: 'publish',
    });
    await this.authorizationService.assertAllowed({
      actor,
      access,
      automationId,
      decision: securityDecision,
    });

    const draft = await this.draftService.ensureDraft(
      actor,
      access,
      automationId,
    );
    if (input.draft_id && input.draft_id !== draft.id) {
      throw new AppHttpException(
        'CANVAS_OPERATION_INVALID',
        400,
        'Publish request draft_id does not match the active draft.',
      );
    }
    if (
      input.expected_revision !== undefined &&
      input.expected_revision !== null &&
      input.expected_revision !== draft.revision_counter
    ) {
      throw new AppHttpException(
        'CANVAS_REVISION_CONFLICT',
        409,
        'Canvas draft revision has changed.',
        {
          current_revision: draft.revision_counter,
          current_hash: draft.workflow_hash,
          resolution: { type: 'reload_required', can_rebase: false },
        },
      );
    }

    const validation = this.validationService.publishGateValidate(
      draft.workflow,
    );
    const runtimeProjection = this.runtimeProjectionService.preview(
      draft.workflow,
    );
    const runtimeBlockers = runtimeProjection.unsupported_nodes.map((node) =>
      publishBlocker(
        'RUNTIME_MAPPING_MISSING',
        'Runtime mapping missing',
        node.reason,
        'runtime',
        node.node_id,
      ),
    );
    const publishReport = buildPublishReport({
      draftId: draft.id,
      draftHash: draft.workflow_hash,
      revision: draft.revision_counter,
      workflow: draft.workflow,
      validation,
      runtimeProjection,
      blockers: runtimeBlockers,
    });
    if (!validation.can_publish) {
      await this.auditService.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        workspaceId: access.activeWorkspace?.id ?? null,
        action: 'canvas.publish.blocked',
        entityType: 'installed_automation',
        entityId: automationId,
        result: 'denied',
        reasonCode: 'CANVAS_PUBLISH_VALIDATION_FAILED',
        metadata: {
          draftId: draft.id,
          validationStatus: validation.status,
          errors: validation.errors_count,
          policyBlocks: validation.policy_blocks_count,
        },
      });
      throw new AppHttpException(
        'CANVAS_PUBLISH_VALIDATION_FAILED',
        422,
        'Canvas draft cannot be published before validation passes.',
        {
          validation,
          publish_report: publishReport,
        },
      );
    }
    if (!runtimeProjection.can_compile || runtimeBlockers.length > 0) {
      await this.auditService.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        workspaceId: access.activeWorkspace?.id ?? null,
        action: 'canvas.publish.blocked',
        entityType: 'installed_automation',
        entityId: automationId,
        result: 'denied',
        reasonCode: 'CANVAS_PUBLISH_RUNTIME_BLOCKED',
        metadata: {
          draftId: draft.id,
          unsupportedNodes: runtimeProjection.unsupported_nodes.length,
        },
      });
      throw new AppHttpException(
        'CANVAS_PUBLISH_RUNTIME_BLOCKED',
        422,
        'Canvas draft cannot be published because runtime projection is not compilable.',
        {
          publish_report: publishReport,
        },
      );
    }

    await this.snapshotService.persistSnapshot({
      actor,
      access,
      automationId,
      draftId: draft.id,
      workflow: draft.workflow,
      validation,
      revision: draft.revision_counter,
      reason: 'before_publish',
      note: input.change_note ?? null,
      checkpointKind: 'publish',
      isNamed: false,
    });

    const workspaceId = requireWorkspaceId(access);
    const versionId = randomUUID();
    const compileReportId = randomUUID();
    const runtimeProjectionId = randomUUID();
    const versionNo = await this.nextVersionNo(workspaceId, automationId);
    const workflow = this.draftService.withValidation(
      draft.workflow,
      validation,
    );
    const hash = this.draftService.hashWorkflow(workflow);
    const normalizedCanvas = this.draftService.buildCanvasReadModel(
      workflow,
      validation,
    );
    const validationResultId = await this.persistValidationResult({
      actor,
      access,
      automationId,
      draftId: draft.id,
      validation,
      revision: draft.revision_counter,
    });
    const runtimeIr =
      (runtimeProjection as unknown as { readonly runtime_ir?: unknown })
        .runtime_ir ?? runtimeProjection;
    const validationWarnings =
      (validation as unknown as { readonly warnings?: unknown }).warnings ?? [];

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          insert into app.automation_canvas_versions (
            id,
            workspace_id,
            installed_automation_id,
            draft_version_id,
            version_no,
            schema_version,
            workflow,
            normalized_canvas,
            workflow_hash,
            validation_result_id,
            compile_preview_id,
            version_name,
            version_description,
            publish_report,
            status,
            change_note,
            published_by_user_id
          )
          values ($1, $2, $3, $4, $5, '2.0', $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13::jsonb, 'published', $14, $15)
        `,
        [
          versionId,
          workspaceId,
          automationId,
          draft.id,
          versionNo,
          JSON.stringify(workflow),
          JSON.stringify(normalizedCanvas),
          hash,
          validationResultId,
          compileReportId,
          input.version_name ?? null,
          input.version_description ?? null,
          JSON.stringify(publishReport),
          input.change_note ?? null,
          actor.id,
        ],
      );

      await client.query(
        `
          insert into app.automation_compile_reports (
            id,
            workspace_id,
            automation_id,
            automation_version_id,
            draft_version_id,
            compiler_version,
            target_runtime,
            compile_mode,
            source_workflow_hash,
            status,
            validation_result,
            runtime_ir,
            activepieces_projection,
            generated_operations,
            required_pieces,
            required_connections,
            warnings,
            blocking_issues,
            created_by
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            'stage16-canvas-publisher',
            'activepieces',
            'publish_and_sync',
            $6,
            $7,
            $8::jsonb,
            $9::jsonb,
            $10::jsonb,
            '[]'::jsonb,
            $11::jsonb,
            $12::jsonb,
            $13::jsonb,
            $14::jsonb,
            $15
          )
        `,
        [
          compileReportId,
          workspaceId,
          automationId,
          versionId,
          draft.id,
          hash,
          validation.warnings_count > 0 ? 'compiled_with_warnings' : 'compiled',
          JSON.stringify(validation),
          JSON.stringify(runtimeIr),
          JSON.stringify(runtimeProjection),
          JSON.stringify(runtimeProjection.required_pieces),
          JSON.stringify(runtimeProjection.required_connections),
          JSON.stringify(validationWarnings),
          JSON.stringify(runtimeBlockers),
          actor.id,
        ],
      );

      await client.query(
        `
          insert into app.automation_runtime_projections (
            id,
            workspace_id,
            automation_id,
            automation_version_id,
            provider,
            projection_json,
            projection_hash,
            compile_report,
            compile_report_id,
            required_pieces,
            required_connections,
            pinned_piece_versions,
            created_by
          )
          values ($1, $2, $3, $4, 'activepieces', $5::jsonb, $6, $7::jsonb, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12)
        `,
        [
          runtimeProjectionId,
          workspaceId,
          automationId,
          versionId,
          JSON.stringify(runtimeProjection),
          runtimeProjection.projection_hash,
          JSON.stringify({
            publish_report: publishReport,
            source: 'canvas_publish',
            compile_report_id: compileReportId,
          }),
          compileReportId,
          JSON.stringify(runtimeProjection.required_pieces),
          JSON.stringify(runtimeProjection.required_connections),
          JSON.stringify(
            runtimeProjection.required_pieces.map((piece) => ({
              piece_name: piece.package_name,
              version_range: piece.version,
              node_ids: piece.node_ids,
            })),
          ),
          actor.id,
        ],
      );

      await client.query(
        `
          update app.automation_canvas_versions
          set runtime_projection_id = $4
          where id = $1
            and workspace_id = $2
            and installed_automation_id = $3
        `,
        [versionId, workspaceId, automationId, runtimeProjectionId],
      );

      await client.query(
        `
          update app.automation_canvas_drafts
          set current_version_id = $4,
              status = 'published_to_version',
              runtime_projection_status = 'sync_required',
              activepieces_sync_status = 'sync_required',
              updated_by_user_id = $5,
              updated_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
            and installed_automation_id = $3
        `,
        [draft.id, workspaceId, automationId, versionId, actor.id],
      );

      await client.query(
        `
          update app.installed_automations
          set workflow = $3::jsonb,
              workflow_state = 'published',
              sync_state = 'pending',
              active_canvas_version_id = $4,
              production_disabled_at = null,
              production_disabled_reason = null,
              production_disabled_by = null,
              updated_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
        `,
        [automationId, workspaceId, JSON.stringify(workflow), versionId],
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'canvas.version.published',
      entityType: 'installed_automation',
      entityId: automationId,
      result: 'success',
      metadata: {
        draftId: draft.id,
        versionId,
        versionNo,
        runtimeProjectionId,
        compileReportId,
        projectionHash: runtimeProjection.projection_hash,
        validationStatus: validation.status,
      },
    });

    return {
      version_id: versionId,
      version_no: versionNo,
      version_hash: hash,
      status: 'published',
      compile_preview_id: compileReportId,
      runtime_projection_id: runtimeProjectionId,
      active_version_id: versionId,
      publish_report: publishReport,
      runtime_sync_status: 'sync_required',
    };
  }

  async restoreVersionAsDraft(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    versionId: string,
  ): Promise<CanvasRestoreVersionResponse> {
    if (
      !access.permissions.includes('canvas.restore_version') &&
      !access.permissions.includes('canvas.version.restore_as_draft')
    ) {
      throw new AppHttpException(
        'CANVAS_PERMISSION_DENIED',
        403,
        'Canvas restore permission is required.',
      );
    }
    const draft = await this.draftService.createDraftFromVersion(
      actor,
      access,
      automationId,
      versionId,
    );
    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'canvas.version.restored_as_draft',
      entityType: 'installed_automation',
      entityId: automationId,
      result: 'success',
      metadata: {
        versionId,
        draftId: draft.id,
      },
    });
    return {
      draft_id: draft.id,
      revision: draft.revision_counter,
      draft_hash: draft.workflow_hash,
      state: await this.draftService.getCanvasState(
        actor,
        access,
        automationId,
      ),
    };
  }

  private async nextVersionNo(workspaceId: string, automationId: string) {
    const row = await this.databaseService.one<{ readonly next_no: number }>(
      `
        select coalesce(max(version_no), 0) + 1 as next_no
        from app.automation_canvas_versions
        where workspace_id = $1
          and installed_automation_id = $2
      `,
      [workspaceId, automationId],
    );
    return row?.next_no ?? 1;
  }

  private async persistValidationResult(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly draftId: string;
    readonly validation: CanvasValidationSummary;
    readonly revision: number;
  }) {
    const id = randomUUID();
    await this.databaseService.query(
      `
        insert into app.automation_canvas_validation_results (
          id,
          workspace_id,
          installed_automation_id,
          draft_version_id,
          revision,
          validation_level,
          status,
          errors,
          warnings,
          policy_blocks,
          summary,
          can_save,
          can_test,
          can_publish,
          can_compile,
          can_run,
          created_by_user_id
        )
        values ($1, $2, $3, $4, $5, 'publish_gate', $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15, $16)
      `,
      [
        id,
        requireWorkspaceId(input.access),
        input.automationId,
        input.draftId,
        input.revision,
        input.validation.status,
        JSON.stringify(
          input.validation.issues.filter((issue) => issue.severity === 'error'),
        ),
        JSON.stringify(
          input.validation.issues.filter(
            (issue) => issue.severity === 'warning',
          ),
        ),
        JSON.stringify(
          input.validation.issues.filter(
            (issue) => issue.severity === 'policy_block',
          ),
        ),
        JSON.stringify(input.validation),
        input.validation.can_save,
        input.validation.can_test,
        input.validation.can_publish,
        input.validation.can_compile,
        input.validation.can_run,
        input.actor.id,
      ],
    );
    return id;
  }
}

function buildPublishReport(input: {
  readonly draftId: string;
  readonly draftHash: string;
  readonly revision: number;
  readonly workflow: LexFrameWorkflowV2;
  readonly validation: CanvasValidationSummary;
  readonly runtimeProjection: RuntimeProjectionOutput;
  readonly blockers: readonly CanvasPublishBlocker[];
}): CanvasPublishReport {
  const validationBlockers = input.validation.issues
    .filter(
      (issue) =>
        issue.severity === 'error' ||
        issue.severity === 'policy_block' ||
        issue.blocks?.includes('publish'),
    )
    .map((issue) =>
      publishBlocker(
        issue.code,
        issue.title,
        issue.message,
        issue.severity === 'policy_block' ? 'policy' : 'validation',
        issue.affected_node_id,
      ),
    );
  const warnings = input.validation.issues
    .filter((issue) => issue.severity === 'warning')
    .map((issue) =>
      publishBlocker(
        issue.code,
        issue.title,
        issue.message,
        issue.category === 'runtime' ? 'runtime' : 'validation',
        issue.affected_node_id,
        'warning',
      ),
    );
  return {
    draft_id: input.draftId,
    draft_hash: input.draftHash,
    expected_revision: input.revision,
    validation: input.validation,
    blockers: [...validationBlockers, ...input.blockers],
    warnings,
    graph_summary: {
      nodes: input.workflow.nodes.length,
      edges: input.workflow.edges.length,
      approval_nodes: input.workflow.nodes.filter(
        (node) => node.type === 'approval',
      ).length,
      external_actions: input.workflow.nodes.filter(
        (node) => node.policy?.external_action,
      ).length,
      ai_actions: input.workflow.nodes.filter((node) => node.policy?.ai_action)
        .length,
    },
    required_connections: input.runtimeProjection.required_connections,
    required_pieces: input.runtimeProjection.required_pieces,
    runtime_diff: [],
    projection_hash: input.runtimeProjection.projection_hash,
    can_publish:
      input.validation.can_publish === true &&
      input.runtimeProjection.can_compile === true &&
      validationBlockers.length === 0 &&
      input.blockers.length === 0,
    generated_at: new Date().toISOString(),
  };
}

function publishBlocker(
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
