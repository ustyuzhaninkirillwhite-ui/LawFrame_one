import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { requireWorkspaceId } from '../canvas/canvas-access';

@Injectable()
export class CanvasAiAuditService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async record(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly draftVersionId?: string | null;
    readonly sessionId?: string | null;
    readonly patchProposalId?: string | null;
    readonly eventName: string;
    readonly policyCodes?: readonly string[];
    readonly metadata?: Record<string, unknown>;
    readonly requestId?: string | null;
    readonly traceId?: string | null;
  }) {
    const workspaceId = requireWorkspaceId(input.access);

    await this.databaseService.query(
      `
        insert into app.canvas_ai_audit_events (
          workspace_id,
          automation_id,
          draft_version_id,
          session_id,
          patch_proposal_id,
          actor_user_id,
          event_name,
          policy_codes,
          safe_metadata,
          trace_id
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9::jsonb, $10)
      `,
      [
        workspaceId,
        input.automationId,
        input.draftVersionId ?? null,
        input.sessionId ?? null,
        input.patchProposalId ?? null,
        input.actor.id,
        input.eventName,
        input.policyCodes ?? [],
        JSON.stringify(input.metadata ?? {}),
        input.traceId ?? null,
      ],
    );

    await this.auditService.record({
      actorUserId: input.actor.id,
      actorEmail: input.actor.email,
      workspaceId,
      action: input.eventName,
      entityType: 'installed_automation',
      entityId: input.automationId,
      result: 'success',
      requestId: input.requestId ?? null,
      traceId: input.traceId ?? null,
      metadata: input.metadata ?? {},
    });
  }
}
