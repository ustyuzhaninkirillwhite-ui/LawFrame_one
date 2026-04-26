import type {
  CanvasSnapshot,
  CanvasSnapshotRequest,
  CanvasSnapshotResponse,
  CanvasValidationSummary,
  LexFrameWorkflowV2,
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
import { CanvasLockService } from './canvas-lock.service';
import { CanvasValidationService } from './canvas-validation.service';

@Injectable()
export class CanvasSnapshotService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly draftService: CanvasDraftService,
    private readonly validationService: CanvasValidationService,
    private readonly lockService: CanvasLockService,
    private readonly auditService: AuditService,
  ) {}

  async createSnapshot(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    input: CanvasSnapshotRequest = {},
  ): Promise<CanvasSnapshotResponse> {
    const draft = await this.draftService.ensureDraft(
      actor,
      access,
      automationId,
    );
    if (input.draft_id && input.draft_id !== draft.id) {
      throw new AppHttpException(
        'CANVAS_OPERATION_INVALID',
        400,
        'Snapshot request draft_id does not match the active draft.',
      );
    }
    const snapshot = await this.persistSnapshot({
      actor,
      access,
      automationId,
      draftId: draft.id,
      workflow: draft.workflow,
      validation: draft.validation_summary,
      revision: draft.revision_counter,
      reason: normalizeSnapshotReason(input.reason ?? 'manual_save'),
      note: input.note ?? null,
      checkpointName: input.checkpoint_name ?? null,
      checkpointDescription: input.checkpoint_description ?? null,
      checkpointKind: normalizeCheckpointKind(
        input.checkpoint_kind ?? 'manual',
      ),
      isNamed: input.is_named ?? Boolean(input.checkpoint_name),
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'canvas.snapshot.created',
      entityType: 'installed_automation',
      entityId: automationId,
      result: 'success',
      metadata: {
        draftId: draft.id,
        snapshotId: snapshot.id,
        revision: snapshot.revision,
        reason: snapshot.reason,
      },
    });

    return {
      snapshot,
      state: await this.draftService.getCanvasState(
        actor,
        access,
        automationId,
      ),
    };
  }

  async restoreSnapshot(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    snapshotId: string,
  ): Promise<CanvasSnapshotResponse> {
    const draft = await this.draftService.ensureDraft(
      actor,
      access,
      automationId,
    );
    await this.lockService.assertLockHeld(
      access,
      actor,
      automationId,
      draft.id,
    );
    const workspaceId = requireWorkspaceId(access);
    const snapshot = await this.databaseService.one<{
      readonly id: string;
      readonly draft_version_id: string;
      readonly revision: number;
      readonly snapshot_hash: string;
      readonly workflow: LexFrameWorkflowV2;
      readonly reason: string;
      readonly note: string | null;
      readonly checkpoint_name: string | null;
      readonly checkpoint_description: string | null;
      readonly checkpoint_kind: CanvasSnapshot['checkpoint_kind'];
      readonly retention_until: string | null;
      readonly is_named: boolean;
      readonly created_at: string;
    }>(
      `
        select id, draft_version_id, revision, snapshot_hash, workflow, reason, note,
               checkpoint_name, checkpoint_description, checkpoint_kind, retention_until, is_named, created_at
        from app.automation_canvas_snapshots
        where id = $1
          and workspace_id = $2
          and installed_automation_id = $3
        limit 1
      `,
      [snapshotId, workspaceId, automationId],
    );
    if (!snapshot) {
      throw new AppHttpException(
        'CANVAS_OPERATION_INVALID',
        404,
        'Canvas snapshot was not found.',
      );
    }

    await this.persistSnapshot({
      actor,
      access,
      automationId,
      draftId: draft.id,
      workflow: draft.workflow,
      validation: draft.validation_summary,
      revision: draft.revision_counter,
      reason: 'before_restore',
      note: `Before restoring snapshot ${snapshotId}`,
      checkpointKind: 'system',
      isNamed: false,
    });

    const validation = this.validationService.fastValidate(snapshot.workflow);
    const workflow = this.draftService.withValidation(
      {
        ...snapshot.workflow,
        draft_version_id: draft.id,
        revision_counter: draft.revision_counter + 1,
        updated_at: new Date().toISOString(),
      },
      validation,
    );
    const hash = this.draftService.hashWorkflow(workflow);
    await this.draftService.saveWorkflow(
      access,
      actor,
      draft.id,
      automationId,
      workflow,
      validation,
      hash,
      draft.revision_counter + 1,
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'canvas.snapshot.restored',
      entityType: 'installed_automation',
      entityId: automationId,
      result: 'success',
      metadata: {
        draftId: draft.id,
        snapshotId,
        revision: draft.revision_counter + 1,
      },
    });

    return {
      snapshot: {
        id: snapshot.id,
        draft_id: snapshot.draft_version_id,
        revision: snapshot.revision,
        snapshot_hash: snapshot.snapshot_hash,
        reason: snapshot.reason,
        note: snapshot.note,
        checkpoint_name: snapshot.checkpoint_name,
        checkpoint_description: snapshot.checkpoint_description,
        checkpoint_kind: snapshot.checkpoint_kind,
        retention_until: snapshot.retention_until,
        is_named: snapshot.is_named,
        created_at: snapshot.created_at,
      },
      state: await this.draftService.getCanvasState(
        actor,
        access,
        automationId,
      ),
    };
  }

  async persistSnapshot(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly draftId: string;
    readonly workflow: LexFrameWorkflowV2;
    readonly validation: CanvasValidationSummary;
    readonly revision: number;
    readonly reason: string;
    readonly note?: string | null;
    readonly checkpointName?: string | null;
    readonly checkpointDescription?: string | null;
    readonly checkpointKind?: CanvasSnapshot['checkpoint_kind'];
    readonly isNamed?: boolean;
  }): Promise<CanvasSnapshot> {
    const id = randomUUID();
    const hash = this.draftService.hashWorkflow(input.workflow);
    const normalizedCanvas = this.draftService.buildCanvasReadModel(
      input.workflow,
      input.validation,
    );
    await this.databaseService.query(
      `
        insert into app.automation_canvas_snapshots (
          id,
          workspace_id,
          installed_automation_id,
          draft_version_id,
          revision,
          snapshot_hash,
          workflow,
          normalized_canvas,
          reason,
          note,
          checkpoint_name,
          checkpoint_description,
          checkpoint_kind,
          retention_until,
          is_named,
          created_by_user_id
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16)
        on conflict (draft_version_id, revision, reason) do nothing
      `,
      [
        id,
        requireWorkspaceId(input.access),
        input.automationId,
        input.draftId,
        input.revision,
        hash,
        JSON.stringify(input.workflow),
        JSON.stringify(normalizedCanvas),
        normalizeSnapshotReason(input.reason),
        input.note ?? null,
        input.checkpointName ?? null,
        input.checkpointDescription ?? null,
        normalizeCheckpointKind(input.checkpointKind ?? 'auto'),
        retentionUntil(input.checkpointKind ?? 'auto', input.isNamed ?? false),
        input.isNamed ?? Boolean(input.checkpointName),
        input.actor.id,
      ],
    );
    return {
      id,
      draft_id: input.draftId,
      revision: input.revision,
      snapshot_hash: hash,
      reason: normalizeSnapshotReason(input.reason),
      note: input.note ?? null,
      checkpoint_name: input.checkpointName ?? null,
      checkpoint_description: input.checkpointDescription ?? null,
      checkpoint_kind: normalizeCheckpointKind(input.checkpointKind ?? 'auto'),
      retention_until: retentionUntil(
        input.checkpointKind ?? 'auto',
        input.isNamed ?? false,
      ),
      is_named: input.isNamed ?? Boolean(input.checkpointName),
      created_at: new Date().toISOString(),
    };
  }
}

function normalizeSnapshotReason(reason: string) {
  if (
    [
      'initial',
      'autosave_checkpoint',
      'manual_save',
      'before_publish',
      'after_publish',
      'before_import_runtime',
      'before_restore',
      'system_maintenance',
    ].includes(reason)
  ) {
    return reason;
  }
  return 'manual_save';
}

function normalizeCheckpointKind(
  value: CanvasSnapshot['checkpoint_kind'] | null | undefined,
): NonNullable<CanvasSnapshot['checkpoint_kind']> {
  switch (value) {
    case 'manual':
    case 'system':
    case 'publish':
      return value;
    default:
      return 'auto';
  }
}

function retentionUntil(
  kind: CanvasSnapshot['checkpoint_kind'] | null | undefined,
  isNamed: boolean,
) {
  if (isNamed || kind === 'manual' || kind === 'publish') {
    return null;
  }
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 90);
  return date.toISOString();
}
