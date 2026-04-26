import type {
  CanvasValidationBlockTarget,
  CanvasValidationIssueCategory,
  CanvasValidationMode,
  CanvasValidationResult,
  LexFrameWorkflowV2,
  StepInputBinding,
  SuggestedFix,
  ValidationIssue,
  WorkflowDataField,
  WorkflowEdge,
  WorkflowNode,
} from '@lexframe/contracts';
import {
  canvasBindingSchema,
  canvasEdgeSchema,
  canvasNodeSchema,
  canvasWorkflowV2Schema,
} from '@lexframe/contracts';
import {
  findCanvasBlockDefinition,
  findCanvasValidationRule,
} from '@lexframe/workflow-dsl';
import Ajv2020 from 'ajv/dist/2020';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  bindingId,
  bindingTargetInputKey,
  bindingTargetNodeId,
  compatibility,
  dataSourceClassification,
  dataSourceType,
  fieldDataType,
  normalizeBinding,
} from './canvas-io-utils';
import {
  canonicalWorkflowHashInput,
  canonicalizeWorkflowV2,
  stableStringify,
  toCanonicalEdgeType,
} from './canvas-canonical';

type IssueInput = Partial<
  Omit<
    ValidationIssue,
    | 'id'
    | 'validation_run_id'
    | 'created_at'
    | 'code'
    | 'scope'
    | 'title'
    | 'message'
  >
> & {
  readonly id?: string;
  readonly scope: ValidationIssue['scope'];
  readonly title: string;
  readonly message: string;
};

interface ValidationContext {
  readonly mode: CanvasValidationMode;
  readonly reason: string | null;
  readonly scope: CanvasValidationResult['scope'];
  readonly includeRuntimeChecks: boolean;
  readonly validationRunId: string;
  readonly createdAt: string;
  readonly workflow: LexFrameWorkflowV2;
  readonly nodesById: Map<string, WorkflowNode>;
  readonly workflowInputs: readonly WorkflowDataField[];
  readonly workflowHash: string;
}

interface ValidateWorkflowInput {
  readonly mode?: CanvasValidationMode;
  readonly reason?: string | null;
  readonly scope?: CanvasValidationResult['scope'];
  readonly includeRuntimeChecks?: boolean;
}

@Injectable()
export class CanvasValidationService {
  private readonly ajv = new Ajv2020({ allErrors: true, strict: false });
  private readonly workflowSchemaValidator: ValidateFunction;
  private readonly nodeSchemaValidator: ValidateFunction;
  private readonly edgeSchemaValidator: ValidateFunction;
  private readonly bindingSchemaValidator: ValidateFunction;

  constructor() {
    addFormats(this.ajv);
    this.workflowSchemaValidator = this.ajv.compile(
      canvasWorkflowV2Schema as object,
    );
    this.nodeSchemaValidator = this.ajv.compile(canvasNodeSchema as object);
    this.edgeSchemaValidator = this.ajv.compile(canvasEdgeSchema as object);
    this.bindingSchemaValidator = this.ajv.compile(
      canvasBindingSchema as object,
    );
  }

  fastValidate(candidate: LexFrameWorkflowV2): CanvasValidationResult {
    return this.validateWorkflow(candidate, { mode: 'fast' });
  }

  fullValidate(candidate: LexFrameWorkflowV2): CanvasValidationResult {
    return this.validateWorkflow(candidate, { mode: 'full' });
  }

  publishGateValidate(candidate: LexFrameWorkflowV2): CanvasValidationResult {
    return this.validateWorkflow(candidate, {
      mode: 'publish_gate',
      scope: 'publish',
      includeRuntimeChecks: true,
    });
  }

  runtimeGateValidate(candidate: LexFrameWorkflowV2): CanvasValidationResult {
    return this.validateWorkflow(candidate, {
      mode: 'runtime_gate',
      scope: 'runtime',
      includeRuntimeChecks: true,
    });
  }

  operationPreviewValidate(
    candidate: LexFrameWorkflowV2,
  ): CanvasValidationResult {
    return this.validateWorkflow(candidate, {
      mode: 'operation_preview',
      scope: 'operation',
    });
  }

  fieldLevelValidate(
    candidate: LexFrameWorkflowV2,
    nodeId?: string | null,
  ): CanvasValidationResult {
    const result = this.validateWorkflow(candidate, {
      mode: 'field_level',
      scope: 'node',
    });
    if (!nodeId) {
      return result;
    }
    return {
      ...result,
      issues: result.issues.filter(
        (issue) =>
          issue.affected_node_id === nodeId || issue.scope === 'workflow',
      ),
    };
  }

  validateWorkflow(
    candidate: LexFrameWorkflowV2,
    input: ValidateWorkflowInput = {},
  ): CanvasValidationResult {
    const workflow = canonicalizeWorkflowV2(candidate);
    const mode = input.mode ?? 'full';
    const context: ValidationContext = {
      mode,
      reason: input.reason ?? null,
      scope: input.scope ?? 'draft',
      includeRuntimeChecks:
        input.includeRuntimeChecks === true ||
        mode === 'runtime_gate' ||
        mode === 'publish_gate',
      validationRunId: randomUUID(),
      createdAt: new Date().toISOString(),
      workflow,
      nodesById: new Map(workflow.nodes.map((node) => [node.id, node])),
      workflowInputs: workflow.workflow_inputs ?? workflow.inputs ?? [],
      workflowHash: hashWorkflowForValidation(workflow),
    };

    const issues = [
      ...this.runStructuralValidators(context),
      ...this.runSchemaValidators(context),
      ...this.runTypeValidators(context),
      ...this.runSemanticValidators(context),
      ...this.runPolicyValidators(context),
      ...(context.includeRuntimeChecks
        ? this.runRuntimeValidators(context)
        : []),
      ...this.runUxValidators(context),
    ];

    return this.buildResult(context, issues);
  }

  explainIssue(issue: ValidationIssue) {
    const fixLabels = (issue.suggested_fixes ?? []).map((fix) => fix.label);
    return {
      issue_id: issue.id,
      plain_explanation:
        issue.developer_message ??
        issue.message ??
        `${issue.code} prevents one or more Canvas actions.`,
      suggested_actions: issue.suggested_fixes ?? [],
      summary: fixLabels.length > 0 ? fixLabels.join(', ') : null,
    };
  }

  private runStructuralValidators(context: ValidationContext) {
    const issues: ValidationIssue[] = [];
    const workflow = context.workflow;
    const triggers = workflow.nodes.filter((node) => node.type === 'trigger');

    issues.push(...this.detectDuplicateNodeIds(context));
    issues.push(...this.detectDuplicateEdgeIds(context));

    const schemaVersion = (workflow as { readonly schema_version?: unknown })
      .schema_version;
    if (schemaVersion !== '2.0') {
      issues.push(
        issue('WF_SCHEMA_001_WORKFLOW_SCHEMA_INVALID', {
          scope: 'workflow',
          title: 'Unsupported DSL version',
          message:
            'Canvas supports only LexFrame Workflow DSL schema_version 2.0.',
          developer_message: `Received schema_version ${String(schemaVersion)}.`,
          blocks: [
            'save',
            'test_step',
            'test_flow',
            'compile',
            'publish',
            'run',
            'sync',
          ],
          evidence: {
            expected: '2.0',
            actual: schemaVersion,
          },
        }),
      );
    }

    if (triggers.length === 0) {
      issues.push(
        issue('WF_STRUCTURE_001_TRIGGER_REQUIRED', {
          scope: 'workflow',
          title: 'Trigger is missing',
          message:
            'Add a trigger block before testing, compiling, or publishing.',
        }),
      );
    }

    if (
      workflow.metadata.canvas_mode === 'guided_vertical' &&
      triggers.length > 1
    ) {
      issues.push(
        issue('WF_STRUCTURE_002_SINGLE_PRIMARY_TRIGGER', {
          scope: 'workflow',
          title: 'Too many triggers',
          message: 'Guided Canvas mode allows only one primary trigger.',
          evidence: { expected: 1, actual: triggers.length },
        }),
      );
    }

    if (!workflow.nodes.some((node) => node.type === 'end')) {
      issues.push(
        issue('WF_STRUCTURE_003_END_NODE_REQUIRED', {
          scope: 'workflow',
          title: 'End block is missing',
          message: 'Add an explicit end block for workflow outputs and status.',
        }),
      );
    }

    for (const edge of workflow.edges) {
      const source = context.nodesById.get(edge.source_node_id);
      const target = context.nodesById.get(edge.target_node_id);

      if (!source || !target) {
        issues.push(
          issue('WF_STRUCTURE_005_EDGE_TARGET_EXISTS', {
            scope: 'edge',
            title: 'Edge references a missing node',
            message: `Edge ${edge.id} points to a missing source or target node.`,
            affected_edge_id: edge.id,
            evidence: {
              source_node_id: edge.source_node_id,
              target_node_id: edge.target_node_id,
            },
          }),
        );
        continue;
      }

      if (source.id === target.id) {
        issues.push(
          issue('WF_STRUCTURE_007_NO_UNSUPPORTED_CYCLE', {
            scope: 'edge',
            title: 'Self-loop is not supported',
            message: 'A Canvas node cannot connect to itself.',
            affected_node_id: source.id,
            affected_edge_id: edge.id,
          }),
        );
      }

      if (!hasHandle(source, edge.source_handle, 'output')) {
        issues.push(
          issue('WF_STRUCTURE_006_HANDLE_EXISTS', {
            scope: 'edge',
            title: 'Source handle is missing',
            message: `Node ${source.display_name} does not expose ${edge.source_handle}.`,
            affected_node_id: source.id,
            affected_edge_id: edge.id,
            field_path: `edges.${edge.id}.source_handle`,
          }),
        );
      }

      if (!hasHandle(target, edge.target_handle, 'input')) {
        issues.push(
          issue('WF_STRUCTURE_006_HANDLE_EXISTS', {
            scope: 'edge',
            title: 'Target handle is missing',
            message: `Node ${target.display_name} does not accept ${edge.target_handle}.`,
            affected_node_id: target.id,
            affected_edge_id: edge.id,
            field_path: `edges.${edge.id}.target_handle`,
          }),
        );
      }

      if (target.type === 'trigger') {
        issues.push(
          issue('WF_STRUCTURE_007_NO_UNSUPPORTED_CYCLE', {
            scope: 'edge',
            title: 'Trigger cannot have incoming runtime edges',
            message: 'A trigger must be the start of a workflow branch.',
            affected_node_id: target.id,
            affected_edge_id: edge.id,
          }),
        );
      }
      if (source.type === 'end' && edgeType(edge) !== 'annotation_link') {
        issues.push(
          issue('WF_STRUCTURE_007_NO_UNSUPPORTED_CYCLE', {
            scope: 'edge',
            title: 'End block cannot have outgoing runtime edges',
            message: 'End blocks terminate workflow execution.',
            affected_node_id: source.id,
            affected_edge_id: edge.id,
          }),
        );
      }
    }

    for (const node of disconnectedControlNodes(workflow)) {
      issues.push(
        issue('WF_STRUCTURE_004_NO_DISCONNECTED_NODE', {
          scope: 'node',
          title: 'Node is disconnected',
          message: `${node.display_name} is not reachable from the primary trigger.`,
          affected_node_id: node.id,
        }),
      );
    }

    for (const node of workflow.nodes) {
      if (node.type === 'condition') {
        const outgoing = outgoingRuntimeEdges(workflow, node.id);
        const hasFallback = outgoing.some((edge) =>
          ['otherwise', 'false_branch', 'out:false'].includes(
            String(edge.source_handle),
          ),
        );
        if (outgoing.length < 2 || !hasFallback) {
          issues.push(
            issue('WF_STRUCTURE_008_ROUTER_FALLBACK_REQUIRED', {
              scope: 'node',
              title: 'Fallback branch is missing',
              message: 'Condition blocks should include a fallback branch.',
              affected_node_id: node.id,
              suggested_fixes: [addFallbackBranchFix(node.id)],
            }),
          );
        }
      }

      if (node.type === 'loop') {
        const outgoing = outgoingRuntimeEdges(workflow, node.id);
        const hasBody = outgoing.some((edge) =>
          ['loop_item', 'out:item'].includes(String(edge.source_handle)),
        );
        const hasDone = outgoing.some((edge) =>
          ['after_loop', 'out:done'].includes(String(edge.source_handle)),
        );
        if (!hasBody || !hasDone) {
          issues.push(
            issue('WF_STRUCTURE_009_LOOP_BODY_REQUIRED', {
              scope: 'node',
              title: 'Loop structure is incomplete',
              message: 'Loop blocks need both item and done paths.',
              affected_node_id: node.id,
            }),
          );
        }
        if (!hasConfiguredValue(node, ['max_items', 'maxItems', 'limit'])) {
          issues.push(
            issue('WF_STRUCTURE_009_LOOP_BODY_REQUIRED', {
              scope: 'node',
              title: 'Loop limit is missing',
              message: 'Loop blocks must define a maximum item limit.',
              affected_node_id: node.id,
              field_path: `nodes.${node.id}.config.max_items`,
            }),
          );
        }
      }

      if (
        node.type === 'merge' &&
        incomingRuntimeEdges(workflow, node.id).length < 2
      ) {
        issues.push(
          issue('WF_STRUCTURE_010_MERGE_INPUTS_REQUIRED', {
            scope: 'node',
            title: 'Merge inputs are incomplete',
            message: 'Merge blocks require at least two incoming branches.',
            affected_node_id: node.id,
          }),
        );
      }
    }

    if (hasUnsupportedCycle(workflow)) {
      issues.push(
        issue('WF_STRUCTURE_007_NO_UNSUPPORTED_CYCLE', {
          scope: 'workflow',
          title: 'Unsupported cycle detected',
          message: 'Use a loop block instead of raw control-flow cycles.',
        }),
      );
    }

    return issues;
  }

  private runSchemaValidators(context: ValidationContext) {
    const issues: ValidationIssue[] = [];
    issues.push(
      ...schemaIssues(
        this.workflowSchemaValidator,
        context.workflow,
        'WF_SCHEMA_001_WORKFLOW_SCHEMA_INVALID',
        'workflow',
      ),
    );

    for (const [index, node] of context.workflow.nodes.entries()) {
      issues.push(
        ...schemaIssues(
          this.nodeSchemaValidator,
          node,
          'WF_SCHEMA_002_NODE_SCHEMA_INVALID',
          'node',
          node,
          undefined,
          `nodes.${index}`,
        ),
      );

      const block = findCanvasBlockDefinition(
        node.block_code ?? node.module_code ?? '',
      );
      if (block?.configSchema) {
        issues.push(
          ...schemaIssues(
            this.ajv.compile(block.configSchema as object),
            node.config,
            'WF_SCHEMA_004_NODE_CONFIG_INVALID',
            'node',
            node,
            undefined,
            `nodes.${node.id}.config`,
          ),
        );
      }

      for (const [bindingIndex, binding] of (
        node.input_bindings ?? []
      ).entries()) {
        issues.push(
          ...schemaIssues(
            this.bindingSchemaValidator,
            binding,
            'WF_SCHEMA_006_BINDING_SCHEMA_INVALID',
            'binding',
            node,
            undefined,
            `nodes.${node.id}.input_bindings.${bindingIndex}`,
          ),
        );
      }
    }

    for (const [index, edge] of context.workflow.edges.entries()) {
      issues.push(
        ...schemaIssues(
          this.edgeSchemaValidator,
          edge,
          'WF_SCHEMA_003_EDGE_SCHEMA_INVALID',
          'edge',
          undefined,
          edge,
          `edges.${index}`,
        ),
      );
      if (
        typeof edge.condition === 'string' &&
        edge.condition.trim().startsWith('{')
      ) {
        try {
          JSON.parse(edge.condition);
        } catch {
          issues.push(
            issue('WF_SCHEMA_005_CONDITION_SCHEMA_INVALID', {
              scope: 'edge',
              title: 'Condition expression is invalid',
              message: 'Condition JSON must be syntactically valid.',
              affected_edge_id: edge.id,
              field_path: `edges.${edge.id}.condition`,
            }),
          );
        }
      }
    }

    return issues;
  }

  private runTypeValidators(context: ValidationContext) {
    const issues: ValidationIssue[] = [];

    for (const node of context.workflow.nodes) {
      if (['trigger', 'note', 'group'].includes(node.type)) {
        continue;
      }
      const bindings = (node.input_bindings ?? [])
        .map((binding) => normalizeBinding(binding))
        .filter((binding): binding is StepInputBinding => binding !== null);
      const bindingsByInput = new Map(
        bindings.map((binding) => [bindingTargetInputKey(binding), binding]),
      );

      for (const input of node.inputs ?? []) {
        const hasDefault =
          Object.prototype.hasOwnProperty.call(input, 'default_value') ||
          Boolean(input.default_source);
        if (input.required && !hasDefault && !bindingsByInput.has(input.key)) {
          issues.push(
            issue('WF_TYPE_001_REQUIRED_INPUT_MISSING', {
              scope: 'binding',
              title: 'Required input is not bound',
              message: `${input.label} on ${node.display_name} needs a data source.`,
              affected_node_id: node.id,
              affected_input_key: input.key,
              field_path: `nodes.${node.id}.inputs.${input.key}`,
              suggested_fix:
                'Bind a workflow input, previous step output, or default value.',
              suggested_fixes: [bindInputFix(node.id, input.key)],
            }),
          );
        }
      }

      for (const binding of bindings) {
        issues.push(...this.validateSingleBinding(context, binding));
      }
    }

    return issues;
  }

  private validateSingleBinding(
    context: ValidationContext,
    binding: StepInputBinding,
  ) {
    const issues: ValidationIssue[] = [];
    const id = bindingId(binding);
    const targetNodeId = bindingTargetNodeId(binding);
    const targetInputKey = bindingTargetInputKey(binding);
    const targetNode = targetNodeId
      ? context.nodesById.get(targetNodeId)
      : null;
    const targetInput = targetNode?.inputs.find(
      (input) => input.key === targetInputKey,
    );

    if (!targetNode || !targetInputKey || !targetInput) {
      return [
        issue('WF_TYPE_003_INPUT_NOT_FOUND', {
          scope: 'binding',
          title: 'Binding target is missing',
          message: 'Binding points to a missing node or input.',
          affected_node_id: targetNodeId,
          affected_binding_id: id,
          affected_input_key: targetInputKey,
        }),
      ];
    }

    const source = binding.source;
    if (source.type === 'workflow_input') {
      const workflowInput = context.workflowInputs.find(
        (input) => input.key === source.input_key,
      );
      if (!workflowInput) {
        issues.push(
          issue('WF_TYPE_002_OUTPUT_NOT_FOUND', {
            scope: 'binding',
            title: 'Workflow input is missing',
            message: `Workflow input ${source.input_key} no longer exists.`,
            affected_node_id: targetNode.id,
            affected_binding_id: id,
            affected_input_key: targetInput.key,
          }),
        );
      }
    }

    if (source.type === 'step_output') {
      const sourceNode = context.nodesById.get(source.node_id);
      const sourceOutput = sourceNode?.outputs.find(
        (output) => output.key === source.output_key,
      );
      if (!sourceNode || !sourceOutput) {
        issues.push(
          issue('WF_TYPE_002_OUTPUT_NOT_FOUND', {
            scope: 'binding',
            title: 'Source output is stale',
            message: `Source output ${source.node_id}.${source.output_key} no longer exists.`,
            affected_node_id: targetNode.id,
            affected_binding_id: id,
            affected_input_key: targetInput.key,
            evidence: {
              source_node_id: source.node_id,
              target_node_id: targetNode.id,
            },
          }),
        );
      } else if (
        !hasControlPath(context.workflow, sourceNode.id, targetNode.id)
      ) {
        issues.push(
          issue('WF_TYPE_005_NULLABLE_TO_REQUIRED_WITHOUT_FALLBACK', {
            severity: 'warning',
            scope: 'binding',
            title: 'Source may not run before target',
            message: `${sourceNode.display_name} is not guaranteed to run before ${targetNode.display_name}.`,
            affected_node_id: targetNode.id,
            affected_binding_id: id,
            affected_input_key: targetInput.key,
            blocks: [],
            suggested_fix:
              'Move the binding after a merge/fallback path or provide a default.',
          }),
        );
      }
    }

    const sourceType = dataSourceType(
      source,
      context.workflowInputs,
      context.nodesById,
    );
    const targetType = fieldDataType(targetInput);
    const compatible = compatibility(sourceType, targetType);

    if (source.type === 'secret_ref' && targetType === 'string') {
      issues.push(
        issue('WF_POLICY_005_SECRET_VALUE_IN_CONFIG', {
          scope: 'binding',
          title: 'Secret cannot be exposed as string',
          message: 'Secret references must stay server-side references.',
          affected_node_id: targetNode.id,
          affected_binding_id: id,
          affected_input_key: targetInput.key,
        }),
      );
    } else if (compatible.status === 'invalid') {
      const code =
        compatible.suggested_transform === 'pick_one'
          ? 'WF_TYPE_006_ARRAY_TO_SCALAR_WITHOUT_TRANSFORM'
          : 'WF_TYPE_004_INCOMPATIBLE_TYPES';
      issues.push(
        issue(code, {
          scope: 'binding',
          title: 'Input type is incompatible',
          message: compatible.reason ?? 'Source type cannot feed this input.',
          affected_node_id: targetNode.id,
          affected_binding_id: id,
          affected_input_key: targetInput.key,
          suggested_transform: compatible.suggested_transform,
          evidence: { expected: targetType, actual: sourceType },
        }),
      );
    } else if (compatible.status === 'warning' && !binding.transform) {
      issues.push(
        issue('WF_TYPE_004_INCOMPATIBLE_TYPES', {
          severity: 'warning',
          scope: 'binding',
          title: 'Transform is recommended',
          message:
            compatible.reason ?? 'Source should be transformed explicitly.',
          affected_node_id: targetNode.id,
          affected_binding_id: id,
          affected_input_key: targetInput.key,
          blocks: [],
          suggested_transform: compatible.suggested_transform,
        }),
      );
    }

    if (
      targetInput.options &&
      source.type === 'manual_value' &&
      !targetInput.options.includes(String(source.value))
    ) {
      issues.push(
        issue('WF_TYPE_007_ENUM_VALUE_INVALID', {
          scope: 'node',
          title: 'Enum value is invalid',
          message: `${String(source.value)} is not an allowed value for ${targetInput.label}.`,
          affected_node_id: targetNode.id,
          affected_input_key: targetInput.key,
          field_path: `nodes.${targetNode.id}.inputs.${targetInput.key}`,
          evidence: { expected: targetInput.options, actual: source.value },
        }),
      );
    }

    const sourceClassification = dataSourceClassification(
      source,
      context.workflowInputs,
      context.nodesById,
    );
    if (
      targetNode.policy.external_action &&
      ['confidential', 'legal_secret', 'client_material', 'secret'].includes(
        String(sourceClassification),
      ) &&
      !hasApprovalBefore(context.workflow, targetNode.id)
    ) {
      issues.push(
        issue('WF_POLICY_001_EXTERNAL_ACTION_REQUIRES_APPROVAL', {
          scope: 'binding',
          title: 'Classified data needs approval before external action',
          message:
            'External delivery of classified data must pass an approval node first.',
          affected_node_id: targetNode.id,
          affected_binding_id: id,
          affected_input_key: targetInput.key,
          suggested_fixes: [insertApprovalBeforeFix(targetNode.id)],
        }),
      );
    }

    return issues;
  }

  private runSemanticValidators(context: ValidationContext) {
    const issues: ValidationIssue[] = [];
    for (const node of context.workflow.nodes) {
      const moduleCode = node.module_code ?? node.block_code;
      const hasFacts = hasConfiguredInput(node, ['facts', 'case_facts']);
      const hasTemplate = hasConfiguredInput(node, ['template', 'template_id']);
      const hasProfile = hasConfiguredInput(node, ['profile', 'profile_id']);
      const hasCounterparty = hasConfiguredInput(node, [
        'counterparty',
        'counterparty_id',
      ]);

      if (moduleCode === 'claim_draft' && !hasFacts) {
        issues.push(
          semanticIssue('WF_LEGAL_001_CLAIM_DRAFT_REQUIRES_FACTS', node),
        );
      }
      if (moduleCode === 'pretrial_claim_draft') {
        if (!hasFacts) {
          issues.push(
            semanticIssue('WF_LEGAL_001_CLAIM_DRAFT_REQUIRES_FACTS', node),
          );
        }
        if (!hasCounterparty) {
          issues.push(
            semanticIssue(
              'WF_LEGAL_002_PRETRIAL_CLAIM_REQUIRES_COUNTERPARTY',
              node,
              'counterparty',
            ),
          );
        }
        if (!hasTemplate) {
          issues.push(
            semanticIssue(
              'WF_LEGAL_003_DOCUMENT_TEMPLATE_REQUIRED',
              node,
              'template_id',
            ),
          );
        }
        if (!hasProfile) {
          issues.push(
            semanticIssue(
              'WF_LEGAL_005_PROFILE_REQUIRED_FOR_PERSONALIZED_DRAFT',
              node,
              'profile_id',
            ),
          );
        }
      }
      if (
        ['document_template_apply', 'document_structure_check'].includes(
          moduleCode,
        ) &&
        !hasTemplate
      ) {
        issues.push(
          semanticIssue(
            'WF_LEGAL_003_DOCUMENT_TEMPLATE_REQUIRED',
            node,
            'template_id',
          ),
        );
      }
      if (
        moduleCode === 'case_law_search' &&
        !hasConfiguredOutputConsumer(context.workflow, node.id)
      ) {
        issues.push(
          issue('WF_LEGAL_004_CASE_LAW_SEARCH_RESULT_NOT_SELECTED', {
            severity: 'warning',
            scope: 'node',
            title: 'Case law results are not consumed',
            message:
              'Connect selected case law sources to a drafting, analysis, or citation step.',
            affected_node_id: node.id,
            blocks: [],
          }),
        );
      }
      if (
        moduleCode === 'ai_extract_facts' &&
        !node.outputs.some((output) => output.key.includes('citation'))
      ) {
        issues.push(
          issue('WF_LEGAL_006_LEGAL_SOURCE_CITATION_REQUIRED_FOR_RAG_OUTPUT', {
            severity: 'warning',
            scope: 'node',
            title: 'Citation output is missing',
            message: 'AI legal outputs should expose citations or evidence.',
            affected_node_id: node.id,
            blocks: [],
          }),
        );
      }
    }
    return issues;
  }

  private runPolicyValidators(context: ValidationContext) {
    const issues: ValidationIssue[] = [];
    for (const node of context.workflow.nodes) {
      if (
        (node.type === 'delivery' || node.policy.external_action) &&
        !hasApprovalBefore(context.workflow, node.id)
      ) {
        issues.push(
          issue('WF_POLICY_001_EXTERNAL_ACTION_REQUIRES_APPROVAL', {
            scope: 'node',
            title: 'External action requires approval',
            message:
              'Add an approval gate before external delivery or client-facing send actions.',
            affected_node_id: node.id,
            suggested_fixes: [insertApprovalBeforeFix(node.id)],
          }),
        );
      }

      if (
        node.type === 'aiAction' &&
        node.runtime_mapping.provider !== 'ai_gateway'
      ) {
        issues.push(
          issue('WF_POLICY_002_AI_ROUTE_FORBIDDEN_FOR_DATA_CLASS', {
            scope: 'node',
            title: 'AI action bypasses AI gateway',
            message: 'AI actions must route through the LexFrame AI Gateway.',
            affected_node_id: node.id,
            evidence: {
              expected: 'ai_gateway',
              actual: node.runtime_mapping.provider,
              module_code: node.module_code ?? node.block_code,
            },
          }),
        );
      }

      for (const found of scanForbiddenValues(node.config)) {
        issues.push(
          issue(found.code, {
            scope: 'node',
            title: found.title,
            message: found.message,
            affected_node_id: node.id,
            field_path: `nodes.${node.id}.config.${found.path}`,
            evidence: { actual: found.redactedValue },
            suggested_fixes: [removeSecretFix(node.id, found.path)],
          }),
        );
      }

      if (looksLikeCodeStep(node)) {
        issues.push(
          issue('WF_POLICY_008_CODE_STEP_FORBIDDEN', {
            scope: 'node',
            title: 'Code step is blocked',
            message:
              'Code or custom execution steps require explicit admin review.',
            affected_node_id: node.id,
          }),
        );
      }
    }

    for (const node of context.workflow.nodes) {
      for (const binding of (node.input_bindings ?? [])
        .map((item) => normalizeBinding(item))
        .filter((item): item is StepInputBinding => item !== null)) {
        const source = binding.source;
        if (
          source.type === 'document' &&
          isRecord(source) &&
          typeof source.workspace_id === 'string' &&
          source.workspace_id !== context.workflow.workspace_id
        ) {
          issues.push(
            issue('WF_POLICY_004_CROSS_WORKSPACE_REFERENCE', {
              scope: 'binding',
              title: 'Cross-workspace reference is blocked',
              message:
                'Document references must belong to the active workspace.',
              affected_node_id: node.id,
              affected_binding_id: bindingId(binding),
              affected_input_key: bindingTargetInputKey(binding),
              evidence: {
                expected: context.workflow.workspace_id,
                actual: source.workspace_id,
              },
            }),
          );
        }
      }
    }

    return issues;
  }

  private runRuntimeValidators(context: ValidationContext) {
    const issues: ValidationIssue[] = [];
    for (const node of context.workflow.nodes) {
      if (['note', 'group', 'end'].includes(node.type)) {
        continue;
      }
      const provider = node.runtime_mapping.provider;
      if (!provider) {
        issues.push(
          runtimeIssue('WF_RUNTIME_001_RUNTIME_MAPPING_MISSING', node),
        );
        continue;
      }
      if (node.runtime_mapping.can_compile === false) {
        issues.push(
          runtimeIssue('WF_RUNTIME_008_COMPILER_UNSUPPORTED_NODE', node),
        );
      }
      if (provider === 'activepieces') {
        if (!node.runtime_mapping.activepieces_piece) {
          issues.push(
            runtimeIssue('WF_RUNTIME_002_ACTIVEPIECES_PIECE_MISSING', node),
          );
        }
        if (!node.runtime_mapping.activepieces_action) {
          issues.push(
            runtimeIssue('WF_RUNTIME_003_ACTIVEPIECES_ACTION_MISSING', node),
          );
        }
      }
      if (
        node.policy.external_action &&
        !hasConnectionBinding(node) &&
        node.type !== 'approval'
      ) {
        issues.push(runtimeIssue('WF_RUNTIME_004_CONNECTION_REQUIRED', node));
      }
    }
    return issues;
  }

  private runUxValidators(context: ValidationContext) {
    const issues: ValidationIssue[] = [];
    for (const node of context.workflow.nodes) {
      if (!node.display_name?.trim() || /^new node$/i.test(node.display_name)) {
        issues.push(
          issue('WF_UX_001_DISPLAY_NAME_MISSING', {
            scope: 'node',
            title: 'Display name is missing',
            message: 'Give the step a readable legal-language name.',
            affected_node_id: node.id,
            field_path: `nodes.${node.id}.display_name`,
          }),
        );
      }
      if (node.type === 'approval' && !hasConfiguredValue(node, ['reason'])) {
        issues.push(
          issue('WF_UX_003_APPROVAL_REASON_MISSING', {
            scope: 'node',
            title: 'Approval reason is missing',
            message: 'Explain why this workflow needs human approval.',
            affected_node_id: node.id,
            field_path: `nodes.${node.id}.config.reason`,
          }),
        );
      }
      if (
        node.type === 'end' &&
        !node.description &&
        !hasConfiguredValue(node, ['result_description', 'resultDescription'])
      ) {
        issues.push(
          issue('WF_UX_004_END_RESULT_DESCRIPTION_MISSING', {
            scope: 'node',
            title: 'End result description is missing',
            message: 'Describe the workflow result for no-code users.',
            affected_node_id: node.id,
          }),
        );
      }
      if (
        ['high', 'critical'].includes(String(node.policy.risk_level ?? '')) &&
        !node.policy.data_classification
      ) {
        issues.push(
          issue('WF_UX_005_RISK_BADGE_REQUIRED', {
            scope: 'node',
            title: 'Risk badge metadata is incomplete',
            message: 'High-risk steps need a visible data sensitivity badge.',
            affected_node_id: node.id,
          }),
        );
      }
    }

    for (const edge of context.workflow.edges) {
      const source = context.nodesById.get(edge.source_node_id);
      if (
        source?.type === 'condition' &&
        !edge.label &&
        edgeType(edge) !== 'annotation_link'
      ) {
        issues.push(
          issue('WF_UX_002_BRANCH_LABEL_MISSING', {
            scope: 'edge',
            title: 'Branch label is missing',
            message: 'Condition branches should have readable labels.',
            affected_edge_id: edge.id,
            affected_node_id: source.id,
          }),
        );
      }
    }

    return issues;
  }

  private detectDuplicateNodeIds(context: ValidationContext) {
    const seen = new Set<string>();
    const issues: ValidationIssue[] = [];
    for (const node of context.workflow.nodes) {
      if (seen.has(node.id)) {
        issues.push(
          issue('WF_SCHEMA_002_NODE_SCHEMA_INVALID', {
            scope: 'node',
            title: 'Duplicate node id',
            message: `Node id ${node.id} appears more than once.`,
            affected_node_id: node.id,
            blocks: [
              'save',
              'test_step',
              'test_flow',
              'compile',
              'publish',
              'run',
            ],
          }),
        );
      }
      seen.add(node.id);
    }
    return issues;
  }

  private detectDuplicateEdgeIds(context: ValidationContext) {
    const seen = new Set<string>();
    const issues: ValidationIssue[] = [];
    for (const edge of context.workflow.edges) {
      if (seen.has(edge.id)) {
        issues.push(
          issue('WF_SCHEMA_003_EDGE_SCHEMA_INVALID', {
            scope: 'edge',
            title: 'Duplicate edge id',
            message: `Edge id ${edge.id} appears more than once.`,
            affected_edge_id: edge.id,
            blocks: ['save', 'test_flow', 'compile', 'publish', 'run'],
          }),
        );
      }
      seen.add(edge.id);
    }
    return issues;
  }

  private buildResult(
    context: ValidationContext,
    inputIssues: readonly ValidationIssue[],
  ): CanvasValidationResult {
    const issues = dedupeIssues(inputIssues)
      .sort(compareIssues)
      .map((item) => ({
        ...item,
        validation_run_id: context.validationRunId,
        created_at: context.createdAt,
      }));
    const errors = issues.filter((item) => item.severity === 'error').length;
    const warnings = issues.filter(
      (item) => item.severity === 'warning',
    ).length;
    const policyBlocks = issues.filter(
      (item) => item.severity === 'policy_block',
    ).length;
    const capabilities = {
      can_save: !blocks(issues, 'save'),
      can_test: !blocks(issues, 'test_step') && !blocks(issues, 'test_flow'),
      can_compile: !blocks(issues, 'compile'),
      can_publish:
        errors === 0 && policyBlocks === 0 && !blocks(issues, 'publish'),
      can_run: !blocks(issues, 'run'),
      can_sync: !blocks(issues, 'sync'),
    };
    const summary = {
      errors,
      warnings,
      policy_blocks: policyBlocks,
      suggestions: issues.reduce(
        (count, item) => count + (item.suggested_fixes?.length ?? 0),
        0,
      ),
    };

    return {
      validation_run_id: context.validationRunId,
      workflow_hash: context.workflowHash,
      mode: context.mode,
      reason: context.reason,
      scope: context.scope,
      created_at: context.createdAt,
      status:
        errors > 0 || policyBlocks > 0
          ? 'invalid'
          : warnings > 0
            ? 'valid_with_warnings'
            : 'valid',
      errors_count: errors,
      warnings_count: warnings,
      policy_blocks_count: policyBlocks,
      summary,
      capabilities,
      issues,
      can_save: capabilities.can_save,
      can_test: capabilities.can_test,
      can_publish: capabilities.can_publish,
      can_compile: capabilities.can_compile,
      can_run: capabilities.can_run,
      can_sync: capabilities.can_sync,
    };
  }
}

function issue(code: string, input: IssueInput): ValidationIssue {
  const rule = findCanvasValidationRule(code);
  const severity = input.severity ?? rule?.severity ?? 'error';
  const category = input.category ?? categoryForCode(code);
  const blocks =
    input.blocks ??
    rule?.blocks ??
    defaultBlocksForSeverity(severity, category);
  const id = input.id ?? stableIssueId(code, input);
  const suggestedAction =
    input.suggested_action ??
    (input.suggested_fixes?.[0]?.operation_type &&
    input.suggested_fixes[0].operation_payload
      ? {
          label: input.suggested_fixes[0].label,
          operation_type: input.suggested_fixes[0].operation_type,
          operation_payload: input.suggested_fixes[0].operation_payload,
        }
      : null);

  return {
    ...input,
    id,
    code,
    severity,
    category,
    scope: normalizeIssueScope(input.scope),
    blocks,
    suggested_action: suggestedAction,
    suggested_fixes: input.suggested_fixes ?? [],
    evidence: input.evidence ?? null,
    developer_message: input.developer_message ?? null,
    affected_node_id: input.affected_node_id ?? null,
    affected_edge_id: input.affected_edge_id ?? null,
    affected_binding_id: input.affected_binding_id ?? null,
    affected_input_key: input.affected_input_key ?? null,
    field_path: input.field_path ?? null,
    suggested_fix: input.suggested_fix ?? null,
    suggested_transform: input.suggested_transform ?? null,
  };
}

function schemaIssues(
  validator: ValidateFunction,
  value: unknown,
  code: string,
  scope: ValidationIssue['scope'],
  node?: WorkflowNode,
  edge?: WorkflowEdge,
  pathPrefix?: string,
) {
  if (validator(value)) {
    return [];
  }
  return (validator.errors ?? []).slice(0, 8).map((error) => {
    const fieldPath = [pathPrefix, error.instancePath.replace(/^\//, '')]
      .filter(Boolean)
      .join('.');
    return issue(code, {
      scope,
      title: 'Canvas schema validation failed',
      message: formatAjvError(error),
      developer_message:
        `${error.instancePath || '/'} ${error.message ?? ''}`.trim(),
      affected_node_id: node?.id ?? null,
      affected_edge_id: edge?.id ?? null,
      field_path: fieldPath || null,
      evidence: {
        expected: error.schemaPath,
        actual: error.params,
        module_code: node?.module_code ?? node?.block_code ?? null,
      },
    });
  });
}

function semanticIssue(
  code: string,
  node: WorkflowNode,
  inputKey?: string,
): ValidationIssue {
  return issue(code, {
    scope: 'node',
    title: 'Legal module requirement is missing',
    message: findCanvasValidationRule(code)?.message ?? code,
    affected_node_id: node.id,
    affected_input_key: inputKey ?? null,
    field_path: inputKey ? `nodes.${node.id}.inputs.${inputKey}` : null,
    evidence: { module_code: node.module_code ?? node.block_code },
  });
}

function runtimeIssue(code: string, node: WorkflowNode): ValidationIssue {
  return issue(code, {
    scope: 'runtime',
    title: 'Runtime validation failed',
    message: findCanvasValidationRule(code)?.message ?? code,
    affected_node_id: node.id,
    evidence: {
      module_code: node.module_code ?? node.block_code,
      actual: node.runtime_mapping,
    },
  });
}

function hashWorkflowForValidation(workflow: LexFrameWorkflowV2) {
  const input = canonicalWorkflowHashInput(workflow);
  return createHash('sha256')
    .update(
      stableStringify({
        ...input,
        validation_state: undefined,
        runtime_projection: undefined,
      }),
    )
    .digest('hex');
}

function hasHandle(
  node: WorkflowNode,
  code: string,
  direction: 'input' | 'output',
) {
  return node.handles.some(
    (handle) =>
      handle.direction === direction &&
      (handle.code === code || handleAlias(handle.code) === handleAlias(code)),
  );
}

function disconnectedControlNodes(workflow: LexFrameWorkflowV2) {
  const trigger = workflow.nodes.find((node) => node.type === 'trigger');
  if (!trigger) {
    return workflow.nodes.filter((node) => !isUiOnlyNode(node));
  }

  const reachable = new Set<string>([trigger.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of workflow.edges) {
      if (
        edgeType(edge) !== 'annotation_link' &&
        edgeType(edge) !== 'data_flow' &&
        edge.type !== 'invalid' &&
        reachable.has(edge.source_node_id) &&
        !reachable.has(edge.target_node_id)
      ) {
        reachable.add(edge.target_node_id);
        changed = true;
      }
    }
  }

  return workflow.nodes.filter(
    (node) => !isUiOnlyNode(node) && !reachable.has(node.id),
  );
}

function hasControlPath(
  workflow: LexFrameWorkflowV2,
  sourceNodeId: string,
  targetNodeId: string,
) {
  if (sourceNodeId === targetNodeId) {
    return false;
  }
  const adjacency = runtimeAdjacency(workflow);
  const visited = new Set<string>();
  const queue = [...(adjacency.get(sourceNodeId) ?? [])];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (nodeId === targetNodeId) {
      return true;
    }
    if (visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);
    queue.push(...(adjacency.get(nodeId) ?? []));
  }
  return false;
}

function hasUnsupportedCycle(workflow: LexFrameWorkflowV2) {
  const adjacency = runtimeAdjacency(workflow, { skipLoopEdges: true });
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(nodeId: string): boolean {
    if (visiting.has(nodeId)) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }
    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      if (visit(next)) {
        return true;
      }
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  return workflow.nodes.some((node) => visit(node.id));
}

function runtimeAdjacency(
  workflow: LexFrameWorkflowV2,
  options: { readonly skipLoopEdges?: boolean } = {},
) {
  const adjacency = new Map<string, string[]>();
  for (const edge of workflow.edges) {
    const type = edgeType(edge);
    if (
      type === 'annotation_link' ||
      type === 'data_flow' ||
      edge.type === 'invalid' ||
      (options.skipLoopEdges && type === 'loop_flow')
    ) {
      continue;
    }
    adjacency.set(edge.source_node_id, [
      ...(adjacency.get(edge.source_node_id) ?? []),
      edge.target_node_id,
    ]);
  }
  return adjacency;
}

function incomingRuntimeEdges(workflow: LexFrameWorkflowV2, nodeId: string) {
  return workflow.edges.filter(
    (edge) =>
      edge.target_node_id === nodeId &&
      edgeType(edge) !== 'annotation_link' &&
      edgeType(edge) !== 'data_flow' &&
      edge.type !== 'invalid',
  );
}

function outgoingRuntimeEdges(workflow: LexFrameWorkflowV2, nodeId: string) {
  return workflow.edges.filter(
    (edge) =>
      edge.source_node_id === nodeId &&
      edgeType(edge) !== 'annotation_link' &&
      edgeType(edge) !== 'data_flow' &&
      edge.type !== 'invalid',
  );
}

function edgeType(edge: WorkflowEdge) {
  return toCanonicalEdgeType(edge.edge_type ?? edge.type);
}

function handleAlias(code: string) {
  switch (code) {
    case 'in:control':
      return 'main_input';
    case 'out:success':
      return 'main_output';
    case 'out:error':
      return 'error_output';
    case 'out:true':
      return 'true_branch';
    case 'out:false':
      return 'false_branch';
    case 'out:approved':
      return 'approved';
    case 'out:rejected':
      return 'rejected';
    case 'out:item':
      return 'loop_item';
    case 'out:done':
      return 'after_loop';
    default:
      return code;
  }
}

function hasApprovalBefore(workflow: LexFrameWorkflowV2, targetNodeId: string) {
  const reverseEdges = new Map<string, string[]>();
  for (const edge of workflow.edges) {
    if (edgeType(edge) === 'annotation_link' || edge.type === 'invalid') {
      continue;
    }
    reverseEdges.set(edge.target_node_id, [
      ...(reverseEdges.get(edge.target_node_id) ?? []),
      edge.source_node_id,
    ]);
  }

  const visited = new Set<string>();
  const queue = [...(reverseEdges.get(targetNodeId) ?? [])];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);
    const node = workflow.nodes.find((item) => item.id === nodeId);
    if (node?.type === 'approval') {
      return true;
    }
    queue.push(...(reverseEdges.get(nodeId) ?? []));
  }
  return false;
}

function hasConfiguredInput(node: WorkflowNode, keys: readonly string[]) {
  return keys.some((key) => {
    if (hasConfiguredValue(node, [key])) {
      return true;
    }
    return (node.input_bindings ?? []).some((binding) => {
      const normalized = normalizeBinding(binding);
      return normalized && bindingTargetInputKey(normalized) === key;
    });
  });
}

function hasConfiguredValue(node: WorkflowNode, keys: readonly string[]) {
  return keys.some((key) => {
    if (Object.prototype.hasOwnProperty.call(node.config, key)) {
      const value = node.config[key];
      return value !== null && value !== undefined && value !== '';
    }
    return false;
  });
}

function hasConfiguredOutputConsumer(
  workflow: LexFrameWorkflowV2,
  sourceNodeId: string,
) {
  return workflow.nodes.some((node) =>
    (node.input_bindings ?? []).some((binding) => {
      const normalized = normalizeBinding(binding);
      return (
        normalized?.source.type === 'step_output' &&
        normalized.source.node_id === sourceNodeId
      );
    }),
  );
}

function hasConnectionBinding(node: WorkflowNode) {
  if (
    hasConfiguredValue(node, [
      'connection_id',
      'connectionId',
      'connection_code',
      'connectionCode',
      'connection_type',
      'connectionType',
    ])
  ) {
    return true;
  }
  return (node.input_bindings ?? []).some((binding) => {
    const normalized = normalizeBinding(binding);
    return normalized?.source.type === 'connection';
  });
}

function scanForbiddenValues(value: unknown) {
  const findings: {
    readonly code: string;
    readonly title: string;
    readonly message: string;
    readonly path: string;
    readonly redactedValue: string;
  }[] = [];

  function visit(current: unknown, path: string) {
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}.${index}`));
      return;
    }
    if (isRecord(current)) {
      for (const [key, child] of Object.entries(current)) {
        visit(child, path ? `${path}.${key}` : key);
      }
      return;
    }
    if (typeof current !== 'string') {
      return;
    }

    const pathText = path.toLowerCase();
    const valueText = current.toLowerCase();
    if (/service[_-]?role|supabase_service_role/.test(pathText + valueText)) {
      findings.push({
        code: 'WF_POLICY_006_DIRECT_SUPABASE_SERVICE_ROLE_FORBIDDEN',
        title: 'Supabase service role is forbidden',
        message: 'Canvas config cannot contain service role credentials.',
        path,
        redactedValue: redact(current),
      });
      return;
    }
    if (
      /signed[_-]?url|x-amz-signature|x-goog-signature|[?&]sig=/.test(
        pathText + valueText,
      )
    ) {
      findings.push({
        code: 'WF_POLICY_010_SIGNED_URL_IN_CONFIG_FORBIDDEN',
        title: 'Signed URL is forbidden',
        message: 'Canvas config cannot persist signed URLs.',
        path,
        redactedValue: redact(current),
      });
      return;
    }
    if (/secret|token|api[_-]?key|password|private[_-]?key/.test(pathText)) {
      findings.push({
        code: 'WF_POLICY_005_SECRET_VALUE_IN_CONFIG',
        title: 'Secret value is forbidden',
        message:
          'Store secrets as backend references, not literal config values.',
        path,
        redactedValue: redact(current),
      });
      return;
    }
    if (/^https?:\/\//i.test(current) && !isAllowedHttpUrl(current)) {
      findings.push({
        code: 'WF_POLICY_007_UNKNOWN_HTTP_DOMAIN',
        title: 'Unknown HTTP domain',
        message:
          'HTTP targets must use an allowed domain or reviewed connector.',
        path,
        redactedValue: redact(current),
      });
    }
  }

  visit(value, '');
  return findings;
}

function isAllowedHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.hostname === 'localhost' ||
      url.hostname.endsWith('.lexframe.local') ||
      url.hostname.endsWith('.activepieces.com')
    );
  } catch {
    return false;
  }
}

function looksLikeCodeStep(node: WorkflowNode) {
  const code = `${node.block_code} ${node.module_code ?? ''}`.toLowerCase();
  return /\b(code|javascript|python|script|http_request)\b/.test(code);
}

function insertApprovalBeforeFix(targetNodeId: string): SuggestedFix {
  return {
    id: `insert_approval_before_${targetNodeId}`,
    type: 'insert_node_before',
    label: 'Add approval before external action',
    description: 'Insert a human approval gate before this delivery step.',
    operation_type: 'ADD_NODE_FROM_MODULE',
    operation_payload: {
      module_code: 'human_approval',
      insert: {
        position: 'approval_after',
        target_node_id: targetNodeId,
      },
      initial_config: {
        reason: 'Approve external delivery before sending.',
      },
      auto_bind_inputs: true,
    },
    sensitive: true,
    requires_confirmation: true,
  };
}

function addFallbackBranchFix(nodeId: string): SuggestedFix {
  return {
    id: `add_fallback_branch_${nodeId}`,
    type: 'add_fallback_branch',
    label: 'Add fallback branch',
    operation_type: 'UPDATE_CONDITION',
    operation_payload: {
      node_id: nodeId,
      add_fallback: true,
    },
  };
}

function bindInputFix(nodeId: string, inputKey: string): SuggestedFix {
  return {
    id: `bind_${nodeId}_${inputKey}`,
    type: 'bind_input',
    label: 'Choose data source',
    operation_type: 'UPSERT_INPUT_BINDING',
    operation_payload: {
      node_id: nodeId,
      input_key: inputKey,
      open_data_picker: true,
    },
  };
}

function removeSecretFix(nodeId: string, path: string): SuggestedFix {
  return {
    id: `remove_secret_${nodeId}_${path.replace(/\W+/g, '_')}`,
    type: 'remove_secret',
    label: 'Remove unsafe value',
    operation_type: 'UPDATE_NODE_CONFIG',
    operation_payload: {
      node_id: nodeId,
      unset_path: path,
    },
    sensitive: true,
    destructive: true,
    requires_confirmation: true,
  };
}

function defaultBlocksForSeverity(
  severity: ValidationIssue['severity'],
  category: CanvasValidationIssueCategory,
): readonly CanvasValidationBlockTarget[] {
  if (severity === 'warning' || severity === 'info') {
    return [];
  }
  if (category === 'security') {
    return [
      'save',
      'test_step',
      'test_flow',
      'compile',
      'publish',
      'run',
      'sync',
    ];
  }
  if (category === 'policy') {
    return ['publish', 'run', 'sync'];
  }
  if (category === 'runtime') {
    return ['test_step', 'test_flow', 'compile', 'publish', 'run', 'sync'];
  }
  return ['test_step', 'test_flow', 'compile', 'publish', 'run'];
}

function blocks(
  issues: readonly ValidationIssue[],
  target: CanvasValidationBlockTarget,
) {
  return issues.some((issue) => issue.blocks?.includes(target));
}

function categoryForCode(code: string): CanvasValidationIssueCategory {
  if (code.startsWith('WF_STRUCTURE_')) {
    return 'structure';
  }
  if (code.startsWith('WF_SCHEMA_')) {
    return 'schema';
  }
  if (code.startsWith('WF_TYPE_')) {
    return 'type_compatibility';
  }
  if (code.startsWith('WF_LEGAL_')) {
    return 'semantic';
  }
  if (code.startsWith('WF_POLICY_')) {
    return code.includes('SECRET') ||
      code.includes('SERVICE_ROLE') ||
      code.includes('SIGNED_URL') ||
      code.includes('HTTP') ||
      code.includes('WORKSPACE') ||
      code.includes('DOCUMENT_ACCESS')
      ? 'security'
      : 'policy';
  }
  if (code.startsWith('WF_RUNTIME_')) {
    return 'runtime';
  }
  if (code.startsWith('WF_UX_')) {
    return 'ux';
  }
  return 'schema';
}

function normalizeIssueScope(scope: ValidationIssue['scope']) {
  return scope;
}

function stableIssueId(code: string, input: IssueInput) {
  return [
    code,
    input.affected_binding_id,
    input.affected_node_id,
    input.affected_edge_id,
    input.affected_input_key,
    input.field_path,
    'workflow',
  ]
    .filter(Boolean)
    .join(':');
}

function dedupeIssues(issues: readonly ValidationIssue[]) {
  const byId = new Map<string, ValidationIssue>();
  for (const item of issues) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

function compareIssues(left: ValidationIssue, right: ValidationIssue) {
  const severity = severityRank(left.severity) - severityRank(right.severity);
  if (severity !== 0) {
    return severity;
  }
  return [
    left.category ?? '',
    left.code,
    left.affected_node_id ?? '',
    left.affected_edge_id ?? '',
    left.affected_input_key ?? '',
  ]
    .join('|')
    .localeCompare(
      [
        right.category ?? '',
        right.code,
        right.affected_node_id ?? '',
        right.affected_edge_id ?? '',
        right.affected_input_key ?? '',
      ].join('|'),
    );
}

function severityRank(severity: ValidationIssue['severity']) {
  switch (severity) {
    case 'policy_block':
      return 0;
    case 'error':
      return 1;
    case 'warning':
      return 2;
    default:
      return 3;
  }
}

function formatAjvError(error: ErrorObject) {
  const path = error.instancePath || 'workflow';
  return `${path} ${error.message ?? 'is invalid'}`.trim();
}

function isUiOnlyNode(node: WorkflowNode) {
  return node.type === 'note' || node.type === 'group';
}

function redact(value: string) {
  if (value.length <= 8) {
    return '[redacted]';
  }
  return `${value.slice(0, 3)}...[redacted]...${value.slice(-3)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
