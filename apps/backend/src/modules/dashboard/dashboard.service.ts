import type {
  DashboardEventListResponse,
  DashboardSnapshot,
  RunArtifact,
  SystemStatusSummary,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RuntimeHealthService } from '../ops/runtime-health.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { LiveEventsService } from '../realtime/live-events.service';
import { RunSnapshotService } from '../runs/run-snapshot.service';

interface ArtifactRow {
  readonly id: string;
  readonly workflow_run_id: string;
  readonly document_id: string;
  readonly document_version_id: string;
  readonly artifact_type: string;
  readonly title: string;
  readonly mime_type: string;
  readonly source: RunArtifact['source'];
  readonly created_at: string;
}

const ACTIVE_RUN_STATUSES = new Set([
  'queued',
  'created',
  'precheck_failed',
  'ready_to_start',
  'starting',
  'running',
  'waiting_approval',
  'waiting_delivery_approval',
  'delivering',
  'retrying',
]);

@Injectable()
export class DashboardService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly runSnapshotService: RunSnapshotService,
    private readonly approvalsService: ApprovalsService,
    private readonly recommendationsService: RecommendationsService,
    private readonly notificationsService: NotificationsService,
    private readonly liveEventsService: LiveEventsService,
    private readonly runtimeHealthService: RuntimeHealthService,
  ) {}

  async getSnapshot(
    actor: AuthenticatedActor,
    access: AccessContext,
  ): Promise<DashboardSnapshot> {
    const workspaceId = access.activeWorkspace!.id;
    const [
      runs,
      approvals,
      recommendations,
      unreadNotificationsCount,
      recentArtifacts,
      systemStatus,
      snapshotVersion,
    ] = await Promise.all([
      this.runSnapshotService.listRuns(access),
      this.approvalsService.listTasks(access),
      this.recommendationsService.list(actor, access),
      this.notificationsService.countUnread(access, actor.id),
      this.loadRecentArtifacts(workspaceId),
      this.getSystemStatus(),
      this.liveEventsService.getSnapshotVersion(workspaceId, actor.id),
    ]);

    return {
      snapshotVersion,
      generatedAt: new Date().toISOString(),
      activeRuns: runs
        .filter((item) => ACTIVE_RUN_STATUSES.has(item.status))
        .slice(0, 6),
      failedRuns: runs.filter((item) => item.status === 'failed').slice(0, 6),
      pendingApprovals: approvals
        .filter((item) => item.status === 'pending')
        .slice(0, 8),
      recentArtifacts,
      recommendations: recommendations.slice(0, 6),
      unreadNotificationsCount,
      systemStatus,
    };
  }

  listEvents(
    actor: AuthenticatedActor,
    access: AccessContext,
    sinceSequence?: number,
  ): Promise<DashboardEventListResponse> {
    return this.liveEventsService.listDashboardEvents({
      workspaceId: access.activeWorkspace!.id,
      userId: actor.id,
      sinceSequence,
    });
  }

  getSystemStatus(): Promise<SystemStatusSummary> {
    return this.runtimeHealthService.getSystemStatus();
  }

  private async loadRecentArtifacts(
    workspaceId: string,
  ): Promise<readonly RunArtifact[]> {
    const result = await this.databaseService.query<ArtifactRow>(
      `
        select
          id,
          workflow_run_id,
          document_id,
          document_version_id,
          artifact_type,
          title,
          mime_type,
          source,
          created_at
        from app.run_artifacts
        where workspace_id = $1
        order by created_at desc
        limit 8
      `,
      [workspaceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      workflowRunId: row.workflow_run_id,
      documentId: row.document_id,
      documentVersionId: row.document_version_id,
      artifactType: row.artifact_type,
      title: row.title,
      mimeType: row.mime_type,
      source: row.source,
      createdAt: row.created_at,
    }));
  }
}
