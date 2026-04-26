import type {
  CanvasAiPatchApplyRequest,
  CanvasAiPatchApplyResponse,
  CanvasAiPatchProposal,
  CanvasAiPatchRejectRequest,
  CanvasAiPatchRejectResponse,
  CanvasAiPatchStatus,
  CanvasOperation,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { CanvasDraftService } from '../canvas/canvas-draft.service';
import { CanvasOperationService } from '../canvas/canvas-operation.service';
import { DatabaseService } from '../database/database.service';
import { requireWorkspaceId } from '../canvas/canvas-access';
import { CanvasAiAuditService } from './canvas-ai-audit.service';
import { CanvasPolicyValidator } from './canvas-policy-validator.service';
import { CanvasPatchValidator } from './canvas-patch-validator.service';

interface CanvasAiPatchProposalRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly automation_id: string;
  readonly draft_version_id: string;
  readonly session_id: string;
  readonly status: CanvasAiPatchStatus;
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
export class CanvasPatchApplyService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly draftService: CanvasDraftService,
    private readonly operationService: CanvasOperationService,
    private readonly patchValidator: CanvasPatchValidator,
    private readonly policyValidator: CanvasPolicyValidator,
    private readonly auditService: CanvasAiAuditService,
  ) {}

  async getProposal(
    access: AccessContext,
    automationId: string,
    patchId: string,
  ): Promise<CanvasAiPatchProposal> {
    const row = await this.getProposalRow(access, automationId, patchId);
    return mapProposalRow(row);
  }

  async apply(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly request: CanvasAiPatchApplyRequest;
    readonly requestId?: string | null;
    readonly traceId?: string | null;
  }): Promise<CanvasAiPatchApplyResponse> {
    if (!input.request.user_confirmation) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Canvas AI patch apply requires user_confirmation=true.',
      );
    }

    const row = await this.getProposalRow(
      input.access,
      input.automationId,
      input.request.patch_id,
    );
    if (row.status !== 'ready_for_review') {
      throw new AppHttpException(
        'CANVAS_AI_PATCH_NOT_APPLICABLE',
        409,
        'Canvas AI patch is not ready for apply.',
      );
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await this.markExpired(row.id);
      throw new AppHttpException(
        'CANVAS_AI_PATCH_EXPIRED',
        409,
        'Canvas AI patch proposal has expired.',
      );
    }
    if (row.base_workflow_hash !== input.request.base_workflow_hash) {
      throw new AppHttpException(
        'AI_PATCH_CONFLICT_BASE_HASH_CHANGED',
        409,
        'Canvas AI patch base hash does not match the apply request.',
      );
    }

    const draft = await this.draftService.ensureDraft(
      input.actor,
      input.access,
      input.automationId,
    );
    const currentHash = this.draftService.hashWorkflow(draft.workflow);
    if (currentHash !== row.base_workflow_hash) {
      throw new AppHttpException(
        'AI_PATCH_CONFLICT_BASE_HASH_CHANGED',
        409,
        'Canvas draft changed after AI proposal was created.',
        {
          expected_hash: row.base_workflow_hash,
          current_hash: currentHash,
        },
      );
    }

    const operations = row.operations.map((operation, index) => ({
      ...operation,
      base_workflow_hash: row.base_workflow_hash,
      idempotency_key:
        operation.idempotency_key ?? `canvas_ai_patch:${row.id}:${index}`,
    }));

    const preview = await this.patchValidator.validate({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      draftId: row.draft_version_id,
      baseWorkflowHash: row.base_workflow_hash,
      operations,
    });
    const policy = this.policyValidator.validate({
      workflow: draft.workflow,
      operations,
      includeSensitiveContext: false,
    });

    if (!preview.would_succeed || !policy.allowed) {
      throw new AppHttpException(
        'AI_PATCH_POLICY_BLOCKED',
        409,
        'Canvas AI patch no longer passes validation or policy checks.',
        {
          validation_status: preview.validation.status,
          policy_codes: policy.codes,
        },
      );
    }

    const operationResponse = await this.operationService.applyOperations(
      input.actor,
      input.access,
      input.automationId,
      {
        draft_id: row.draft_version_id,
        base_hash: row.base_workflow_hash,
        client_batch_id: `canvas_ai_patch:${row.id}`,
        operations,
      },
      {
        requestId: input.requestId ?? null,
        traceId: input.traceId ?? null,
      },
    );

    await this.databaseService.query(
      `
        update app.canvas_ai_patch_proposals
        set status = 'applied',
            applied_at = timezone('utc', now()),
            proposed_workflow_hash = $3,
            validation_summary = $4::jsonb,
            policy_result = $5::jsonb,
            updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
      `,
      [
        row.id,
        requireWorkspaceId(input.access),
        operationResponse.new_workflow_hash,
        JSON.stringify(operationResponse.validation),
        JSON.stringify(policy),
      ],
    );

    await this.auditService.record({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      draftVersionId: row.draft_version_id,
      sessionId: row.session_id,
      patchProposalId: row.id,
      eventName: 'canvas_ai.patch_applied',
      metadata: {
        operations: operations.map((operation) => operation.operation_type),
        workflowHash: operationResponse.new_workflow_hash,
      },
      requestId: input.requestId ?? null,
      traceId: input.traceId ?? null,
    });

    return {
      status: 'applied',
      patch_id: row.id,
      session_id: row.session_id,
      draft_version_id: row.draft_version_id,
      workflow_hash: operationResponse.new_workflow_hash,
      revision_counter: operationResponse.revision_counter,
      operation_response: operationResponse,
    };
  }

  async reject(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly patchId: string;
    readonly request: CanvasAiPatchRejectRequest;
    readonly requestId?: string | null;
    readonly traceId?: string | null;
  }): Promise<CanvasAiPatchRejectResponse> {
    const row = await this.getProposalRow(
      input.access,
      input.automationId,
      input.patchId,
    );
    const rejectedAt = new Date().toISOString();

    await this.databaseService.query(
      `
        update app.canvas_ai_patch_proposals
        set status = 'rejected',
            rejected_at = $3,
            rejection_reason = $4,
            updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
      `,
      [
        row.id,
        requireWorkspaceId(input.access),
        rejectedAt,
        input.request.reason ?? null,
      ],
    );

    await this.auditService.record({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      draftVersionId: row.draft_version_id,
      sessionId: row.session_id,
      patchProposalId: row.id,
      eventName: 'canvas_ai.patch_rejected',
      metadata: { reason: input.request.reason ?? null },
      requestId: input.requestId ?? null,
      traceId: input.traceId ?? null,
    });

    return {
      status: 'rejected',
      patch_id: row.id,
      session_id: row.session_id,
      rejected_at: rejectedAt,
    };
  }

  private async getProposalRow(
    access: AccessContext,
    automationId: string,
    patchId: string,
  ) {
    const row = await this.databaseService.one<CanvasAiPatchProposalRow>(
      `
        select
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
        from app.canvas_ai_patch_proposals
        where id = $1
          and workspace_id = $2
          and automation_id = $3
        limit 1
      `,
      [patchId, requireWorkspaceId(access), automationId],
    );
    if (!row) {
      throw new AppHttpException(
        'CANVAS_AI_PATCH_NOT_FOUND',
        404,
        'Canvas AI patch proposal was not found.',
      );
    }
    return row;
  }

  private async markExpired(patchId: string) {
    await this.databaseService.query(
      `
        update app.canvas_ai_patch_proposals
        set status = 'expired',
            updated_at = timezone('utc', now())
        where id = $1
          and status <> 'applied'
      `,
      [patchId],
    );
  }
}

function mapProposalRow(row: CanvasAiPatchProposalRow): CanvasAiPatchProposal {
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
