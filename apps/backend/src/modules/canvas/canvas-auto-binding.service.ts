import type {
  DataSource,
  LexFrameWorkflowV2,
  StepInputBinding,
  WorkflowDataField,
  WorkflowNode,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import {
  compatibility,
  fieldDataType,
  stableBindingId,
} from './canvas-io-utils';

@Injectable()
export class CanvasAutoBindingService {
  bind(input: {
    readonly workflow: LexFrameWorkflowV2;
    readonly node: WorkflowNode;
    readonly apply: boolean;
  }): {
    readonly bindings: readonly StepInputBinding[];
    readonly suggestions: readonly StepInputBinding[];
  } {
    const bindings: StepInputBinding[] = [];
    const suggestions: StepInputBinding[] = [];

    for (const targetInput of input.node.inputs) {
      if (!targetInput.required) {
        continue;
      }

      const candidates = collectCandidates(
        input.workflow,
        input.node,
        targetInput,
      );
      const best = candidates[0];
      if (!best) {
        continue;
      }

      const binding = createBinding(
        input.node.id,
        targetInput.key,
        best.source,
      );
      if (best.confidence >= 0.9 && input.apply) {
        bindings.push(binding);
      } else {
        suggestions.push(binding);
      }
    }

    return { bindings, suggestions };
  }
}

function collectCandidates(
  workflow: LexFrameWorkflowV2,
  targetNode: WorkflowNode,
  targetInput: WorkflowDataField,
) {
  const candidates: {
    readonly source: DataSource;
    readonly confidence: number;
  }[] = [];
  const targetType = fieldDataType(targetInput);
  const targetClassification = String(
    targetInput.classification ?? 'workspace_internal',
  );

  for (const output of previousOutputs(workflow, targetNode)) {
    const sourceType = fieldDataType(output.field);
    if (compatibility(sourceType, targetType).status === 'invalid') {
      continue;
    }
    if (
      !classificationAllowed(output.field.classification, targetClassification)
    ) {
      continue;
    }
    candidates.push({
      source: {
        type: 'step_output',
        node_id: output.node.id,
        output_key: output.field.key,
      },
      confidence:
        sourceType === targetType || output.field.key === targetInput.key
          ? 0.96
          : 0.72,
    });
  }

  for (const workflowInput of workflow.inputs) {
    const sourceType = fieldDataType(workflowInput);
    if (compatibility(sourceType, targetType).status === 'invalid') {
      continue;
    }
    if (
      !classificationAllowed(workflowInput.classification, targetClassification)
    ) {
      continue;
    }
    candidates.push({
      source: {
        type: 'workflow_input',
        input_key: workflowInput.key,
      },
      confidence:
        sourceType === targetType || workflowInput.key === targetInput.key
          ? 0.93
          : 0.68,
    });
  }

  return candidates.sort((left, right) => right.confidence - left.confidence);
}

function previousOutputs(
  workflow: LexFrameWorkflowV2,
  targetNode: WorkflowNode,
) {
  const targetIndex = workflow.nodes.findIndex(
    (node) => node.id === targetNode.id,
  );
  const nodes =
    targetIndex >= 0 ? workflow.nodes.slice(0, targetIndex) : workflow.nodes;
  return nodes.flatMap((node) =>
    node.outputs.map((field) => ({
      node,
      field,
    })),
  );
}

function createBinding(
  targetNodeId: string,
  targetInputKey: string,
  source: DataSource,
): StepInputBinding {
  return {
    id: stableBindingId(targetNodeId, targetInputKey, source),
    target: {
      node_id: targetNodeId,
      input_key: targetInputKey,
    },
    targetNodeId,
    targetInputKey,
    source,
    validation_state: 'valid',
    created_by: 'system',
    created_at: new Date().toISOString(),
  };
}

function classificationAllowed(
  sourceClassification: WorkflowDataField['classification'],
  targetClassification: string,
) {
  return (
    rank(String(sourceClassification ?? 'workspace_internal')) <=
    rank(targetClassification)
  );
}

function rank(classification: string) {
  switch (classification) {
    case 'public':
      return 0;
    case 'workspace_internal':
    case 'internal':
      return 1;
    case 'personal_data':
      return 2;
    case 'confidential':
    case 'client_material':
      return 3;
    case 'legal_secret':
    case 'secret':
    case 'runtime_only':
      return 4;
    default:
      return 2;
  }
}
