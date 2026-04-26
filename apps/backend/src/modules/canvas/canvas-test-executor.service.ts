import type {
  CanvasDebugError,
  CanvasTestRunPolicy,
  CanvasTestRunRedaction,
  CanvasTestRunStepStatus,
  CanvasTestRunStepSummary,
  WorkflowNode,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { CanvasDebugRedactionService } from './canvas-debug-redaction.service';
import { CanvasDryRunPolicyService } from './canvas-dry-run-policy.service';
import { CanvasFixtureService } from './canvas-fixture.service';
import { CanvasTestArtifactService } from './canvas-test-artifact.service';
import { DatabaseService } from '../database/database.service';
import type { CanvasExecutionPlan } from './canvas-test-planner.service';

@Injectable()
export class CanvasTestExecutor {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly dryRunPolicyService: CanvasDryRunPolicyService,
    private readonly fixtureService: CanvasFixtureService,
    private readonly redactionService: CanvasDebugRedactionService,
    private readonly artifactService: CanvasTestArtifactService,
  ) {}

  async execute(input: {
    readonly workspaceId: string;
    readonly testRunId: string;
    readonly plan: CanvasExecutionPlan;
    readonly policy: CanvasTestRunPolicy;
    readonly redaction: CanvasTestRunRedaction;
    readonly nodeIssues: ReadonlyMap<string, CanvasDebugError>;
    readonly onStepStarted?: (node: WorkflowNode) => Promise<void>;
    readonly onStepCompleted?: (
      step: CanvasTestRunStepSummary,
    ) => Promise<void>;
  }): Promise<readonly CanvasTestRunStepSummary[]> {
    const steps: CanvasTestRunStepSummary[] = [];
    let position = 0;

    for (const node of input.plan.nodes) {
      const startedAt = new Date();
      await input.onStepStarted?.(node);
      const issue = input.nodeIssues.get(node.id) ?? null;
      const decision = this.dryRunPolicyService.decide({
        node,
        dryRun: input.plan.mode === 'dry_run_full',
        policy: input.policy,
      });
      const status = statusForDecision(decision.action, issue);
      const inputSummary = this.redactionService.summarizeNodeInput(node);
      const outputPayload = buildOutputPayload({
        node,
        status,
        policyReason: decision.reason,
        fixture: this.fixtureService.generateNodeInputFixture(node),
      });
      const redacted = this.redactionService.redactPayload({
        node,
        payload: outputPayload,
        redaction: input.redaction,
      });
      const outputBlobId =
        status === 'succeeded' || status === 'simulated'
          ? await this.artifactService.storeRedactedBlob({
              workspaceId: input.workspaceId,
              testRunId: input.testRunId,
              nodeId: node.id,
              blobType: 'output',
              classification:
                node.policy.data_classification ?? 'workspace_internal',
              redactedPayload: redacted.payload,
            })
          : null;
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      await this.databaseService.query(
        `
          insert into app.automation_canvas_test_run_steps (
            test_run_id,
            workspace_id,
            node_id,
            display_name,
            module_code,
            status,
            started_at,
            finished_at,
            duration_ms,
            input_summary,
            output_summary,
            input_redacted,
            output_redacted,
            output_blob_ref,
            error_code,
            error_message,
            debug_error,
            diagnostic,
            position
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10::jsonb,
            $11::jsonb,
            true,
            $12,
            $13,
            $14,
            $15,
            $16::jsonb,
            $17::jsonb,
            $18
          )
        `,
        [
          input.testRunId,
          input.workspaceId,
          node.id,
          node.display_name,
          node.module_code ?? node.block_code,
          status,
          startedAt.toISOString(),
          finishedAt.toISOString(),
          durationMs,
          JSON.stringify(inputSummary),
          JSON.stringify(redacted.payload),
          redacted.redacted,
          outputBlobId,
          issue?.code ?? null,
          issue?.user_message ?? null,
          JSON.stringify(issue),
          JSON.stringify({
            policy_decision: decision.action,
            policy_reason: decision.reason,
            runtime_provider:
              node.runtime_mapping.provider ?? 'internal_worker',
          }),
          position,
        ],
      );

      const stepSummary: CanvasTestRunStepSummary = {
        node_id: node.id,
        display_name: node.display_name,
        module_code: node.module_code ?? node.block_code,
        status,
        input_summary: inputSummary,
        output_summary: redacted.payload,
        error: issue,
        timing: {
          started_at: startedAt.toISOString(),
          finished_at: finishedAt.toISOString(),
          duration_ms: durationMs,
        },
      };
      steps.push(stepSummary);
      await input.onStepCompleted?.(stepSummary);
      position += 1;
    }

    return steps;
  }
}

function statusForDecision(
  decision: 'execute' | 'simulate' | 'block',
  issue: CanvasDebugError | null,
): CanvasTestRunStepStatus {
  if (issue?.severity === 'policy_block') {
    return 'blocked_by_policy';
  }
  if (issue?.severity === 'error') {
    return 'failed';
  }
  if (decision === 'block') {
    return 'blocked_by_policy';
  }
  if (decision === 'simulate') {
    return 'simulated';
  }
  return 'succeeded';
}

function buildOutputPayload(input: {
  readonly node: WorkflowNode;
  readonly status: CanvasTestRunStepStatus;
  readonly policyReason: string | null;
  readonly fixture: Record<string, unknown>;
}) {
  return {
    node_id: input.node.id,
    display_name: input.node.display_name,
    status: input.status,
    simulated: input.status === 'simulated',
    policy_reason: input.policyReason,
    fixture_summary: {
      keys: Object.keys(input.fixture),
    },
    outputs: Object.fromEntries(
      input.node.outputs.map((output) => [
        output.key,
        {
          label: output.label,
          data_type: output.data_type,
          classification: output.classification,
          preview: previewValue(output.data_type ?? 'json'),
        },
      ]),
    ),
  };
}

function previewValue(dataType: string) {
  if (dataType.includes('document')) {
    return { id: 'test_artifact_preview', kind: 'document_preview' };
  }
  if (dataType.includes('report')) {
    return { status: 'ok', warnings: [] };
  }
  if (dataType.includes('array') || dataType.endsWith('[]')) {
    return [];
  }
  return 'Simulated test output';
}
