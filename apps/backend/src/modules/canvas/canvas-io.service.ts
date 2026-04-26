import type {
  BindingValidationState,
  CanvasBindingValidationResponse,
  CanvasIoResponse,
  CanvasPinnedDataResponse,
  CanvasSampleOutputResponse,
  CanvasSourcesResponse,
  LexFrameDataType,
  WorkflowDataField,
  WorkflowNode,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { DatabaseService } from '../database/database.service';
import { requireWorkspaceId } from './canvas-access';
import {
  bindingId,
  bindingTargetInputKey,
  bindingTargetNodeId,
  fieldClassification,
  fieldDataType,
  makeCandidate,
  normalizeBinding,
} from './canvas-io-utils';
import { CanvasDraftService } from './canvas-draft.service';
import { CanvasValidationService } from './canvas-validation.service';

interface SampleDataRow {
  readonly id: string;
  readonly node_id: string;
  readonly output_key: string;
  readonly data_type: LexFrameDataType;
  readonly classification: string;
  readonly preview_payload: Record<string, unknown> | null;
  readonly redacted_payload: Record<string, unknown> | null;
  readonly source: CanvasSampleOutputResponse['source'];
}

@Injectable()
export class CanvasIoService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly draftService: CanvasDraftService,
    private readonly validationService: CanvasValidationService,
  ) {}

  async getIo(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
  ): Promise<CanvasIoResponse> {
    const draft = await this.draftService.ensureDraft(
      actor,
      access,
      automationId,
    );
    const validation = this.validationService.validateWorkflow(draft.workflow);
    const usedOutputs = new Set<string>();
    const allOutputs = new Set<string>();

    for (const node of draft.workflow.nodes) {
      for (const output of node.outputs) {
        allOutputs.add(`${node.id}:${output.key}`);
      }
      for (const binding of node.input_bindings ?? []) {
        const source = binding.source;
        if (source.type === 'step_output') {
          usedOutputs.add(`${source.node_id}:${source.output_key}`);
        }
      }
    }
    for (const output of draft.workflow.outputs) {
      if (output.source && typeof output.source !== 'string') {
        const source = output.source;
        if (source.type === 'step_output') {
          usedOutputs.add(`${source.node_id}:${source.output_key}`);
        }
      }
    }

    return {
      workflow_inputs: draft.workflow.inputs,
      workflow_outputs: draft.workflow.outputs,
      nodes: draft.workflow.nodes.map((node) => ({
        node_id: node.id,
        inputs: node.inputs,
        outputs: node.outputs,
        bindings: node.input_bindings ?? [],
      })),
      validation: {
        missing_required_inputs: validation.issues
          .filter((issue) => issue.code === 'required_input_unbound')
          .map(
            (issue) => `${issue.affected_node_id}:${issue.affected_input_key}`,
          ),
        invalid_bindings: validation.issues
          .filter(
            (issue) =>
              issue.scope === 'binding' &&
              (issue.severity === 'error' || issue.severity === 'policy_block'),
          )
          .map((issue) => issue.affected_binding_id ?? issue.id),
        unused_outputs: [...allOutputs].filter((key) => !usedOutputs.has(key)),
      },
    };
  }

  async listSources(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    nodeId: string,
    inputKey: string,
  ): Promise<CanvasSourcesResponse> {
    const draft = await this.draftService.ensureDraft(
      actor,
      access,
      automationId,
    );
    const targetNode = draft.workflow.nodes.find((node) => node.id === nodeId);
    const targetInput = targetNode?.inputs.find(
      (input) => input.key === inputKey,
    );
    if (!targetNode || !targetInput) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        404,
        'Canvas input was not found.',
      );
    }

    const nodesById = new Map(
      draft.workflow.nodes.map((node) => [node.id, node]),
    );
    const candidates = [
      ...draft.workflow.inputs.map((input) =>
        makeCandidate({
          source: { type: 'workflow_input', input_key: input.key },
          target: targetInput,
          nodesById,
          workflowInputs: draft.workflow.inputs,
        }),
      ),
      ...draft.workflow.nodes
        .filter((node) => node.id !== targetNode.id)
        .flatMap((node) =>
          node.outputs.map((output) =>
            makeCandidate({
              source: {
                type: 'step_output',
                node_id: node.id,
                output_key: output.key,
              },
              target: targetInput,
              nodesById,
              workflowInputs: draft.workflow.inputs,
            }),
          ),
        ),
      ...systemSources(targetInput, nodesById, draft.workflow.inputs),
    ];

    return {
      compatible_sources: candidates.filter(
        (candidate) => candidate.compatibility !== 'invalid',
      ),
      incompatible_sources: candidates.filter(
        (candidate) => candidate.compatibility === 'invalid',
      ),
    };
  }

  async validateBinding(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    body: unknown,
  ): Promise<CanvasBindingValidationResponse> {
    const draft = await this.draftService.ensureDraft(
      actor,
      access,
      automationId,
    );
    const binding = normalizeBinding(body);
    if (!binding) {
      return {
        status: 'invalid',
        issues: [
          {
            code: 'binding_invalid_shape',
            message: 'Binding target and source are required.',
            severity: 'error',
          },
        ],
      };
    }

    if (
      binding.source.type === 'expression' &&
      !access.permissions.includes('canvas.debug')
    ) {
      return {
        status: 'policy_blocked',
        issues: [
          {
            code: 'expression_requires_advanced_permission',
            message:
              'Raw expressions are available only to advanced/debug users.',
            severity: 'policy_block',
          },
        ],
      };
    }

    const targetNodeId = bindingTargetNodeId(binding);
    const targetInputKey = bindingTargetInputKey(binding);
    const workflow = {
      ...draft.workflow,
      nodes: draft.workflow.nodes.map((node) =>
        node.id === targetNodeId
          ? {
              ...node,
              input_bindings: [
                ...(node.input_bindings ?? []).filter(
                  (item) => bindingTargetInputKey(item) !== targetInputKey,
                ),
                binding,
              ],
            }
          : node,
      ),
    };
    const validation = this.validationService.validateWorkflow(workflow);
    const id = bindingId(binding);
    const relevant = validation.issues.filter(
      (issue) =>
        issue.affected_binding_id === id ||
        (issue.affected_node_id === targetNodeId &&
          issue.affected_input_key === targetInputKey &&
          issue.scope === 'binding'),
    );

    return {
      status: statusFromIssues(relevant),
      issues: relevant.map((issue) => ({
        code: issue.code,
        message: issue.message,
        severity: issue.severity,
        suggested_transform: issue.suggested_transform,
      })),
    };
  }

  async getSampleOutput(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    nodeId: string,
    outputKey: string,
  ): Promise<CanvasSampleOutputResponse> {
    const workspaceId = requireWorkspaceId(access);
    const draft = await this.draftService.ensureDraft(
      actor,
      access,
      automationId,
    );
    const node = draft.workflow.nodes.find((item) => item.id === nodeId);
    const output = node?.outputs.find((item) => item.key === outputKey);
    if (!node || !output) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        404,
        'Canvas output was not found.',
      );
    }

    const row = await this.databaseService.one<SampleDataRow>(
      `
        select
          sd.id,
          sd.node_id,
          sd.output_key,
          sd.data_type,
          sd.classification,
          sd.preview_payload,
          sd.redacted_payload,
          case when pd.id is not null then 'pinned' else sd.source end as source
        from app.automation_canvas_sample_data sd
        left join app.automation_canvas_pinned_data pd
          on pd.workspace_id = sd.workspace_id
         and pd.installed_automation_id = sd.installed_automation_id
         and pd.draft_version_id = sd.draft_version_id
         and pd.node_id = sd.node_id
         and pd.output_key = sd.output_key
         and pd.pinned_sample_data_id = sd.id
        where sd.workspace_id = $1
          and sd.installed_automation_id = $2
          and sd.draft_version_id = $3
          and sd.node_id = $4
          and sd.output_key = $5
        order by pd.pinned_at desc nulls last, sd.created_at desc
        limit 1
      `,
      [workspaceId, automationId, draft.id, nodeId, outputKey],
    );

    return {
      node_id: nodeId,
      output_key: outputKey,
      data_type: row?.data_type ?? fieldDataType(output),
      classification: row?.classification ?? fieldClassification(output),
      preview_payload: row?.preview_payload ?? null,
      redacted_payload: row?.redacted_payload ?? null,
      source: row?.source ?? 'missing',
    };
  }

  async pinSampleData(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    nodeId: string,
    outputKey: string,
    sampleDataId: string,
  ): Promise<CanvasPinnedDataResponse> {
    const workspaceId = requireWorkspaceId(access);
    const draft = await this.draftService.ensureDraft(
      actor,
      access,
      automationId,
    );
    await this.databaseService.query(
      `
        insert into app.automation_canvas_pinned_data (
          workspace_id,
          installed_automation_id,
          draft_version_id,
          node_id,
          output_key,
          pinned_sample_data_id,
          pinned_by
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (workspace_id, installed_automation_id, draft_version_id, node_id, output_key)
        do update set
          pinned_sample_data_id = excluded.pinned_sample_data_id,
          pinned_by = excluded.pinned_by,
          pinned_at = timezone('utc', now())
      `,
      [
        workspaceId,
        automationId,
        draft.id,
        nodeId,
        outputKey,
        sampleDataId,
        actor.id,
      ],
    );
    return { pinned: true, pinned_sample_data_id: sampleDataId };
  }

  async unpinSampleData(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    nodeId: string,
    outputKey: string,
  ): Promise<CanvasPinnedDataResponse> {
    const workspaceId = requireWorkspaceId(access);
    const draft = await this.draftService.ensureDraft(
      actor,
      access,
      automationId,
    );
    await this.databaseService.query(
      `
        delete from app.automation_canvas_pinned_data
        where workspace_id = $1
          and installed_automation_id = $2
          and draft_version_id = $3
          and node_id = $4
          and output_key = $5
      `,
      [workspaceId, automationId, draft.id, nodeId, outputKey],
    );
    return { pinned: false, pinned_sample_data_id: null };
  }
}

function systemSources(
  target: WorkflowDataField,
  nodesById: Map<string, WorkflowNode>,
  workflowInputs: readonly WorkflowDataField[],
) {
  return ['run_id', 'workspace_id', 'actor_user_id'].map((key) =>
    makeCandidate({
      source: { type: 'system_value', key },
      target,
      nodesById,
      workflowInputs,
    }),
  );
}

function statusFromIssues(
  issues: readonly { readonly severity: string; readonly code: string }[],
): BindingValidationState {
  if (issues.some((issue) => issue.severity === 'policy_block')) {
    return 'policy_blocked';
  }
  if (issues.some((issue) => issue.code.includes('stale'))) {
    return 'stale';
  }
  if (issues.some((issue) => issue.severity === 'error')) {
    return 'invalid';
  }
  if (issues.some((issue) => issue.severity === 'warning')) {
    return 'warning';
  }
  return 'valid';
}
