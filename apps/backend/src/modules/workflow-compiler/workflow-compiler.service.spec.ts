import type { LexFrameWorkflowV2 } from '@lexframe/contracts';
import { createWorkflowEdge, createWorkflowNode } from '../canvas/canvas-model';
import { ActivepiecesFlowParser } from './activepieces-flow-parser.service';
import { ActivepiecesProjectionBuilder } from './activepieces-projection-builder.service';
import { ActivepiecesReverseMapperService } from './activepieces-reverse-mapper.service';
import { RuntimeIRBuilder } from './runtime-ir-builder.service';
import { WorkflowNormalizerService } from './workflow-normalizer.service';
import { WorkflowPolicyValidator } from './workflow-policy-validator.service';
import { WorkflowSemanticDiffService } from './workflow-semantic-diff.service';
import { ConnectionRequirementResolver } from './connection-requirement-resolver.service';
import { normalizeCompileSourceWorkflowV2 } from './workflow-source-normalizer';

describe('WorkflowCompiler stage 16.10 building blocks', () => {
  const normalizer = new WorkflowNormalizerService();
  const irBuilder = new RuntimeIRBuilder(normalizer);
  const projectionBuilder = new ActivepiecesProjectionBuilder(normalizer);
  const flowParser = new ActivepiecesFlowParser();
  const reverseMapper = new ActivepiecesReverseMapperService();
  const semanticDiff = new WorkflowSemanticDiffService();

  it('computes source hash without UI-only layout state', () => {
    const workflow = workflowWithNode(legalNode());
    const moved = {
      ...workflow,
      layout: {
        ...workflow.layout,
        updated_at: '2026-04-25T12:00:00.000Z',
      },
      canvas_layout: {
        layout_version: '1.0',
        mode: 'guided_vertical' as const,
        updated_at: '2026-04-25T12:00:00.000Z',
        nodes: {
          legal_action: {
            x: 999,
            y: 777,
          },
        },
      },
      nodes: workflow.nodes.map((node) =>
        node.id === 'legal_action'
          ? {
              ...node,
              layout: {
                ...node.layout,
                x: 999,
                y: 777,
              },
            }
          : node,
      ),
    };

    expect(normalizer.computeSourceWorkflowHash(workflow)).toBe(
      normalizer.computeSourceWorkflowHash(moved),
    );
  });

  it('expands approval and delivery nodes into waitpoint-safe runtime IR', () => {
    const approval = createWorkflowNode({
      id: 'approval',
      type: 'approval',
      displayName: 'Approve',
      x: 160,
      y: 200,
    });
    const delivery = createWorkflowNode({
      id: 'delivery',
      type: 'delivery',
      displayName: 'Send',
      moduleCode: 'delivery.email',
      x: 160,
      y: 320,
    });
    const workflow = workflowWithNodes([approval, delivery]);
    const ir = irBuilder.build({
      workflow,
      sourceHash: normalizer.computeSourceWorkflowHash(workflow),
      mode: 'preview',
      generatedAt: '2026-04-25T00:00:00.000Z',
      topologicalOrder: ['trigger', 'approval', 'delivery', 'end'],
      connectionRequirements: [],
    });

    expect(ir.steps.map((step) => step.ir_step_id)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('approval_create_task'),
        expect.stringContaining('approval_wait_decision'),
        expect.stringContaining('delivery_email_send'),
        expect.stringContaining('delivery_email_audit'),
      ]),
    );
    expect(ir.steps.some((step) => step.runtime_kind === 'waitpoint')).toBe(
      true,
    );
  });

  it('forces AI nodes through the LexFrame AI Gateway piece', () => {
    const aiNode = {
      ...createWorkflowNode({
        id: 'ai',
        type: 'aiAction',
        displayName: 'AI draft',
        moduleCode: 'ai.draft',
        x: 160,
        y: 200,
      }),
      runtime_mapping: {
        provider: 'activepieces' as const,
        activepieces_piece: '@activepieces/piece-openai',
        activepieces_action: 'chat',
        can_compile: true,
      },
    };
    const workflow = workflowWithNode(aiNode);
    const ir = irBuilder.build({
      workflow,
      sourceHash: normalizer.computeSourceWorkflowHash(workflow),
      mode: 'preview',
      generatedAt: '2026-04-25T00:00:00.000Z',
      topologicalOrder: ['trigger', 'ai', 'end'],
      connectionRequirements: [],
    });

    expect(ir.steps[0]?.piece?.name).toBe('@lexframe/piece-ai-gateway');
  });

  it('blocks direct AI provider and raw document text in policy validation', async () => {
    const databaseService = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const policyValidator = new WorkflowPolicyValidator(
      databaseService as never,
    );
    const aiNode = {
      ...createWorkflowNode({
        id: 'ai',
        type: 'aiAction',
        displayName: 'AI draft',
        moduleCode: 'ai.draft',
        x: 160,
        y: 200,
      }),
      config: {
        document_text: 'raw text must not be sent',
      },
      runtime_mapping: {
        provider: 'activepieces' as const,
        activepieces_piece: '@activepieces/piece-openai',
        activepieces_action: 'chat',
        can_compile: true,
      },
    };
    const workflow = workflowWithNode(aiNode);
    const result = await policyValidator.validate({
      workflow,
      topologicalOrder: ['trigger', 'ai', 'end'],
      requiredPieces: [
        {
          piece_name: '@lexframe/piece-ai-gateway',
          piece_version: '0.1.0',
          action_name: 'run_ai_gateway',
          trigger_name: null,
          source_node_ids: ['ai'],
          status: 'available',
        },
      ],
      requiredConnections: [],
    });

    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'WF_COMPILER_DIRECT_AI_PROVIDER_FORBIDDEN',
        'WF_COMPILER_RAW_DOCUMENT_TEXT_FORBIDDEN',
      ]),
    );
  });

  it('builds deterministic Activepieces projection hashes', () => {
    const workflow = workflowWithNode(legalNode());
    const ir = irBuilder.build({
      workflow,
      sourceHash: normalizer.computeSourceWorkflowHash(workflow),
      mode: 'preview',
      generatedAt: '2026-04-25T00:00:00.000Z',
      topologicalOrder: ['trigger', 'legal_action', 'end'],
      connectionRequirements: [],
    });
    const first = projectionBuilder.build({ workflow, runtimeIr: ir });
    const second = projectionBuilder.build({ workflow, runtimeIr: ir });

    expect(first.projectionHash).toBe(second.projectionHash);
    expect(first.requiredPieces.map((piece) => piece.piece_name)).toContain(
      '@lexframe/piece-legal-module',
    );
  });

  it('canonicalizes Stage 3 template workflows before runtime compilation', () => {
    const workflow = normalizeCompileSourceWorkflowV2(
      {
        id: 'pretrial-claim-flow',
        version: 'v1',
        steps: [
          {
            id: 'case-search',
            moduleCode: 'legal.case-search',
            dependencies: [],
          },
          {
            id: 'materials-analysis',
            moduleCode: 'legal.material-analysis',
            dependencies: [],
          },
          {
            id: 'claim-draft',
            moduleCode: 'document.pretrial-draft',
            dependencies: ['case-search', 'materials-analysis'],
          },
          {
            id: 'delivery-draft',
            moduleCode: 'delivery.email-draft',
            dependencies: ['claim-draft'],
            requiresApproval: true,
          },
        ],
      },
      {
        workspaceId: 'workspace_test',
        automationId: 'automation_test',
        draftId: 'draft_test',
        title: 'Pre-trial claim package',
      },
    );

    expect(workflow.schema_version).toBe('2.0');
    expect(workflow.workspace_id).toBe('workspace_test');
    expect(workflow.automation_id).toBe('automation_test');
    expect(workflow.nodes.map((node) => node.id)).toEqual([
      'trigger_manual_start',
      'case-search',
      'materials-analysis',
      'claim-draft',
      'approval_before_delivery-draft',
      'delivery-draft',
      'end_success',
    ]);
    expect(
      workflow.nodes.map((node) => [
        node.id,
        node.type,
        node.block_code,
        node.runtime_mapping.provider,
        node.runtime_mapping.internal_route,
        node.runtime_mapping.activepieces_action,
      ]),
    ).toEqual([
      [
        'trigger_manual_start',
        'trigger',
        'manual_start',
        'activepieces',
        null,
        'manual_start',
      ],
      [
        'case-search',
        'legalAction',
        'case_law_search',
        'internal_worker',
        'legal_search.query',
        'case_law_search',
      ],
      [
        'materials-analysis',
        'legalAction',
        'case_material_analysis',
        'ai_gateway',
        'ai_gateway.case_material_analysis',
        null,
      ],
      [
        'claim-draft',
        'legalAction',
        'pretrial_claim_draft',
        'internal_worker',
        'document_generation.pretrial_claim',
        'pretrial_claim_draft',
      ],
      [
        'approval_before_delivery-draft',
        'approval',
        'human_approval',
        'manual',
        'approvals.create_task',
        null,
      ],
      [
        'delivery-draft',
        'delivery',
        'email_delivery',
        'internal_worker',
        'delivery.email',
        null,
      ],
      ['end_success', 'end', 'end_success', 'none', null, null],
    ]);
    expect(
      workflow.edges.map((edge) => [
        edge.source_node_id,
        edge.source_handle,
        edge.target_node_id,
        edge.type,
      ]),
    ).toEqual([
      ['trigger_manual_start', 'main_output', 'case-search', 'control'],
      ['case-search', 'main_output', 'materials-analysis', 'control'],
      ['materials-analysis', 'main_output', 'claim-draft', 'control'],
      [
        'claim-draft',
        'main_output',
        'approval_before_delivery-draft',
        'control',
      ],
      [
        'approval_before_delivery-draft',
        'approved',
        'delivery-draft',
        'approval',
      ],
      ['delivery-draft', 'sent', 'end_success', 'control'],
    ]);
    expect(
      workflow.nodes.find(
        (node) => node.id === 'approval_before_delivery-draft',
      )?.config,
    ).toEqual(
      expect.objectContaining({
        reason: 'External delivery approval required by legacy template.',
      }),
    );
    expect(
      workflow.nodes.find((node) => node.id === 'delivery-draft')?.config,
    ).toEqual(
      expect.objectContaining({
        channel: 'email',
        preview_required: true,
        connection_type: 'email_provider',
        connection_id: 'local-integrated-delivery-webhook',
      }),
    );
  });

  it('uses local-integrated delivery webhook as a non-secret email provider connection', async () => {
    const previousEnv = {
      LEXFRAME_READINESS_PROFILE: process.env.LEXFRAME_READINESS_PROFILE,
      LEXFRAME_DELIVERY_TRANSPORT: process.env.LEXFRAME_DELIVERY_TRANSPORT,
      LEXFRAME_DELIVERY_WEBHOOK_URL: process.env.LEXFRAME_DELIVERY_WEBHOOK_URL,
      LEXFRAME_DELIVERY_FROM_EMAIL: process.env.LEXFRAME_DELIVERY_FROM_EMAIL,
    };
    process.env.LEXFRAME_READINESS_PROFILE = 'local-integrated';
    process.env.LEXFRAME_DELIVERY_TRANSPORT = 'webhook';
    process.env.LEXFRAME_DELIVERY_WEBHOOK_URL =
      'http://127.0.0.1:8091/hooks/delivery';
    process.env.LEXFRAME_DELIVERY_FROM_EMAIL = 'noreply@lexframe.local';
    try {
      const delivery = createWorkflowNode({
        id: 'delivery',
        type: 'delivery',
        blockCode: 'email_delivery',
        displayName: 'Send',
        moduleCode: 'delivery.email-draft',
        x: 160,
        y: 200,
      });
      const databaseService = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };
      const resolver = new ConnectionRequirementResolver(
        databaseService as never,
      );

      const requirements = await resolver.resolve(
        'workspace_test',
        workflowWithNode(delivery),
      );

      expect(requirements).toEqual([
        expect.objectContaining({
          source_node_id: 'delivery',
          connection_type: 'email_provider',
          required: true,
          status: 'available',
          connection_external_id: 'local-integrated-delivery-webhook',
        }),
      ]);
    } finally {
      restoreEnv(previousEnv);
    }
  });

  it('parses Activepieces runtime into a sanitized runtime graph', () => {
    const graph = flowParser.parse({
      flowId: 'flow_test',
      projectId: 'project_test',
      flowVersionId: 'version_test',
      snapshot: runtimeSnapshot(),
    });
    const legalNode = graph.nodes.find(
      (node) => node.runtimeNodeId === 'runtime_legal',
    );

    expect(graph.flowId).toBe('flow_test');
    expect(graph.trigger?.runtimeType).toBe('PIECE_TRIGGER');
    expect(legalNode?.runtimeType).toBe('PIECE_ACTION');
    expect(legalNode?.input.api_key).toBe('[redacted]');
    expect(String(legalNode?.input.connection_id)).toMatch(/^connection:/);
    expect(graph.metadata.connectionIds[0]).toMatch(/^connection:/);
  });

  it('reverse-maps known LexFrame pieces into a candidate workflow', () => {
    const workflow = workflowWithNode(legalNode());
    const runtimeGraph = flowParser.parse({
      flowId: 'flow_test',
      projectId: 'project_test',
      flowVersionId: 'version_test',
      snapshot: runtimeSnapshot(),
    });
    const result = reverseMapper.map({
      workflow,
      runtimeGraph,
      context: { permissions: ['canvas.runtime.import_preview'] },
    });
    const updated = result.workflow.nodes.find(
      (node) => node.id === 'legal_action',
    );

    expect(result.importability).toBe('fully_importable');
    expect(result.unknownNodes).toHaveLength(0);
    expect(updated?.display_name).toBe('Draft claim after builder edit');
    expect(updated?.runtime_mapping.activepieces_piece).toBe(
      '@lexframe/piece-legal-module',
    );
  });

  it('classifies unknown direct AI runtime nodes as policy blocked', () => {
    const runtimeGraph = flowParser.parse({
      flowId: 'flow_test',
      projectId: 'project_test',
      flowVersionId: 'version_test',
      snapshot: {
        id: 'flow_test',
        actions: [
          {
            id: 'openai_direct',
            name: 'openai_direct',
            displayName: 'Direct OpenAI',
            type: 'PIECE',
            settings: {
              pieceName: '@activepieces/piece-openai',
              pieceVersion: '1.0.0',
              actionName: 'chat',
              input: { prompt: 'raw client facts' },
            },
          },
        ],
      },
    });
    const result = reverseMapper.map({
      workflow: workflowWithNode(legalNode()),
      runtimeGraph,
      context: { permissions: ['canvas.runtime.import_preview'] },
    });

    expect(result.importability).toBe('blocked_by_policy');
    expect(result.policyBlocks.map((item) => item.type)).toContain(
      'policy_violation',
    );
  });

  it('builds semantic diff items for imported runtime changes', () => {
    const workflow = workflowWithNode(legalNode());
    const runtimeGraph = flowParser.parse({
      flowId: 'flow_test',
      projectId: 'project_test',
      flowVersionId: 'version_test',
      snapshot: runtimeSnapshot(),
    });
    const result = reverseMapper.map({
      workflow,
      runtimeGraph,
      context: { permissions: ['canvas.runtime.import_preview'] },
    });
    const diff = semanticDiff.diff({
      before: workflow,
      after: result.workflow,
      reverseMapping: result,
    });

    expect(diff.map((item) => item.type)).toEqual(
      expect.arrayContaining(['node_config_changed', 'binding_changed']),
    );
    expect(diff.every((item) => item.title.length > 0)).toBe(true);
  });
});

function baseWorkflow(): LexFrameWorkflowV2 {
  const now = '2026-04-25T00:00:00.000Z';
  const trigger = createWorkflowNode({
    id: 'trigger',
    type: 'trigger',
    displayName: 'Manual start',
    x: 160,
    y: 60,
  });
  const end = createWorkflowNode({
    id: 'end',
    type: 'end',
    displayName: 'End',
    x: 160,
    y: 440,
  });

  return {
    schema_version: '2.0',
    id: 'wf_compiler_test',
    workspace_id: 'workspace_test',
    automation_id: 'automation_test',
    draft_version_id: 'draft_test',
    metadata: {
      title: 'Compiler workflow',
      status: 'draft',
      canvas_mode: 'guided_vertical',
    },
    inputs: [],
    outputs: [],
    nodes: [trigger, end],
    edges: [
      createWorkflowEdge({
        source: trigger.id,
        target: end.id,
      }),
    ],
    variables: [],
    validation: {
      status: 'valid',
      errors_count: 0,
      warnings_count: 0,
      policy_blocks_count: 0,
      issues: [],
      can_save: true,
      can_test: true,
      can_publish: true,
      can_compile: true,
      can_run: true,
      can_sync: true,
    },
    runtime_projection: {
      status: 'not_compiled',
      can_compile: false,
      can_run: false,
      warnings: [],
    },
    layout: {
      mode: 'guided_vertical',
      updated_at: now,
    },
    created_at: now,
    updated_at: now,
  };
}

function legalNode() {
  return {
    ...createWorkflowNode({
      id: 'legal_action',
      type: 'legalAction',
      displayName: 'Draft claim',
      moduleCode: 'legal.claim_draft',
      x: 160,
      y: 200,
    }),
    runtime_mapping: {
      provider: 'activepieces' as const,
      activepieces_piece: null,
      activepieces_action: null,
      can_compile: true,
    },
  };
}

function workflowWithNode(
  node: LexFrameWorkflowV2['nodes'][number],
): LexFrameWorkflowV2 {
  return workflowWithNodes([node]);
}

function workflowWithNodes(
  nodes: readonly LexFrameWorkflowV2['nodes'][number][],
): LexFrameWorkflowV2 {
  const base = baseWorkflow();
  const trigger = base.nodes[0]!;
  const end = base.nodes[1]!;
  const ordered = [trigger, ...nodes, end];
  return {
    ...base,
    nodes: ordered,
    edges: ordered.slice(0, -1).map((node, index) =>
      createWorkflowEdge({
        source: node.id,
        target: ordered[index + 1]!.id,
      }),
    ),
  };
}

function restoreEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function runtimeSnapshot() {
  return {
    id: 'flow_test',
    displayName: 'Runtime test flow',
    trigger: {
      id: 'runtime_trigger',
      name: 'runtime_trigger',
      displayName: 'Manual trigger',
      type: 'PIECE_TRIGGER',
      settings: {
        pieceName: '@lexframe/piece-canvas-trigger',
        pieceVersion: '0.1.0',
        triggerName: 'manual_start',
        input: {
          lexframe: {
            node_id: 'trigger',
          },
        },
      },
      metadata: {
        lexframeSourceNodeId: 'trigger',
      },
    },
    actions: [
      {
        id: 'runtime_legal',
        name: 'runtime_legal',
        displayName: 'Draft claim after builder edit',
        type: 'PIECE',
        settings: {
          pieceName: '@lexframe/piece-legal-module',
          pieceVersion: '0.1.0',
          actionName: 'run_module',
          input: {
            api_key: 'secret-value',
            connection_id: 'ap_connection_raw',
            lexframe: {
              node_id: 'legal_action',
              module_code: 'legal.claim_draft',
            },
            prompt: 'Use the builder-edited prompt.',
          },
        },
        metadata: {
          lexframeSourceNodeId: 'legal_action',
        },
      },
    ],
  };
}
