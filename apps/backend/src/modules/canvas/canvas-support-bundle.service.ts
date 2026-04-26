import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import type { CanvasTestSupportBundle } from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { requireWorkspaceId } from './canvas-access';
import { CanvasDraftService } from './canvas-draft.service';
import { CanvasTestRunService } from './canvas-test-run.service';

@Injectable()
export class CanvasSupportBundleService {
  constructor(
    private readonly draftService: CanvasDraftService,
    private readonly testRunService: CanvasTestRunService,
    private readonly auditService: AuditService,
  ) {}

  async buildBundle(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    testRunId: string,
  ): Promise<CanvasTestSupportBundle> {
    const run = await this.testRunService.getRun(
      actor,
      access,
      automationId,
      testRunId,
    );
    const draft = await this.draftService.ensureDraft(
      actor,
      access,
      automationId,
    );
    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: requireWorkspaceId(access),
      action: 'canvas.support_bundle.generated',
      entityType: 'installed_automation',
      entityId: automationId,
      result: 'success',
      traceId: run.trace_id,
      eventCategory: 'canvas_testing',
      dataClass: 'internal',
      redactionApplied: true,
      metadata: {
        testRunId,
        stepCount: run.steps.length,
      },
    });

    return {
      test_run_id: run.test_run_id,
      trace_id: run.trace_id,
      draft_version_hash: draft.workflow_hash,
      validation: run.validation,
      step_statuses: run.steps,
      safe_error_codes: run.steps
        .map((step) => step.error?.code)
        .filter((code): code is string => Boolean(code)),
      redacted_summaries: run.steps
        .map((step) => step.output_summary)
        .filter(
          (summary): summary is Record<string, unknown> =>
            typeof summary === 'object' && summary !== null,
        ),
      runtime_projection_status: draft.workflow.runtime_projection.status,
      diagnostics: {
        browser: {},
        backend: {
          service: 'canvas-testing',
          status: run.status,
        },
      },
    };
  }
}
