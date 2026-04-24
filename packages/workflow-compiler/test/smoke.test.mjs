import assert from 'node:assert/strict';
import test from 'node:test';

import compilerModule from '../dist/index.js';

const {
  compileLexFrameWorkflowToActivepiecesFlow,
  diffActivepiecesProjection,
  reverseSyncActivepiecesFlowToLexFrameProjection,
} = compilerModule;

test('compiles LexFrame workflow steps and reverse-syncs the projection', () => {
  const flow = compileLexFrameWorkflowToActivepiecesFlow({
    title: 'Document workflow',
    steps: [
      {
        id: 'generate_document',
        title: 'Generate document',
        moduleCode: 'document.generate',
        input: { templateId: 'template_1' },
      },
    ],
  });

  assert.equal(flow.valid, true);
  assert.equal(flow.displayName, 'Document workflow');
  assert.equal(flow.trigger.nextAction.settings.pieceName, '@lexframe/piece-document');
  assert.deepEqual(flow.connectionIds, []);

  const projection = reverseSyncActivepiecesFlowToLexFrameProjection(flow);

  assert.equal(projection.steps.length, 1);
  assert.equal(projection.steps[0].id, 'generate_document');
  assert.equal(projection.steps[0].lexFrameType, 'piece_step');
  assert.equal(projection.steps[0].requiredPiece, '@lexframe/piece-document');
});

test('reports added and changed Activepieces projection steps', () => {
  const before = reverseSyncActivepiecesFlowToLexFrameProjection(
    compileLexFrameWorkflowToActivepiecesFlow({
      title: 'Before',
      steps: [
        {
          id: 'deliver',
          title: 'Deliver',
          moduleCode: 'delivery.email',
        },
      ],
    }),
  );
  const afterFlow = compileLexFrameWorkflowToActivepiecesFlow({
    title: 'After',
    steps: [
      {
        id: 'deliver',
        title: 'Deliver',
        moduleCode: 'delivery.email',
        metadata: {
          activepieces: {
            pieceName: '@activepieces/piece-slack',
          },
        },
      },
      {
        id: 'audit',
        title: 'Audit',
        moduleCode: 'workflow.audit',
      },
    ],
  });
  const after = reverseSyncActivepiecesFlowToLexFrameProjection(afterFlow);

  const diff = diffActivepiecesProjection(before, after);

  assert.ok(diff.some((entry) => entry.kind === 'changed_action' && entry.stepId === 'deliver'));
  assert.ok(diff.some((entry) => entry.kind === 'added_step' && entry.stepId === 'audit'));
});
