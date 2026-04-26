import type { StepInputDefinition, WorkflowNode } from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CanvasFixtureService {
  generateNodeInputFixture(node: WorkflowNode): Record<string, unknown> {
    return Object.fromEntries(
      node.inputs.map((input) => [input.key, sampleValueForInput(input, node)]),
    );
  }

  generateLoopItems(node: WorkflowNode, maxItems: number) {
    return Array.from(
      { length: Math.max(1, Math.min(maxItems, 5)) },
      (_, index) => ({
        item_no: index + 1,
        source: node.display_name,
        simulated: true,
      }),
    );
  }
}

function sampleValueForInput(
  input: StepInputDefinition,
  node: WorkflowNode,
): unknown {
  const key = input.key.toLowerCase();
  const type = input.data_type;

  if (
    key.includes('facts') ||
    type === 'fact_set' ||
    type === 'case_fact_set'
  ) {
    return [
      'Contract was signed on 2026-02-01',
      'Payment was not received',
      'Pre-trial claim has not been sent yet',
    ];
  }
  if (key.includes('amount') || type === 'money' || type === 'number') {
    return 150000;
  }
  if (type === 'boolean') {
    return true;
  }
  if (type === 'document_ref' || type === 'document_ref[]') {
    return type.endsWith('[]')
      ? [{ id: 'test_document_1', label: 'Test case material' }]
      : { id: 'test_document_1', label: 'Test case material' };
  }
  if (type === 'template_ref') {
    return { id: 'test_template_1', label: 'Pre-trial claim template' };
  }
  if (type === 'profile_ref' || type === 'profile_snapshot') {
    return { id: 'test_profile_1', label: 'Pre-trial work profile' };
  }
  if (key.includes('email') || key.includes('recipient')) {
    return 'test-recipient@example.invalid';
  }
  if (type === 'array') {
    return [];
  }
  if (type === 'object' || type === 'json') {
    return { simulated: true, node_id: node.id };
  }
  return `Sample ${input.label || input.key}`;
}
