import type {
  CanvasOperation,
  CanvasOperationPreviewResponse,
  CanvasOperationRejectReason,
  CanvasOperationRequest,
  CanvasOperationResponse,
  CanvasOperationResult,
  CanvasModuleCard,
  CanvasValidationSummary,
  ModuleAvailabilityStatus,
  LexFrameWorkflowV2,
  StepInputBinding,
  WorkflowEdge,
  WorkflowDataField,
  WorkflowNode,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  findCanvasBlockDefinition,
  validateCanvasConnection,
  type CanvasBlockDefinition,
  type CanvasHandleCode as DslCanvasHandleCode,
  type CanvasEdgeType,
} from '@lexframe/workflow-dsl';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { requireWorkspaceId } from './canvas-access';
import {
  canonicalizeEdge,
  canonicalizeNode,
  canonicalizeWorkflowV2,
} from './canvas-canonical';
import { applyGuidedLayout, getDefaultHandles } from './canvas-model';
import {
  bindingId,
  bindingTargetInputKey,
  bindingTargetNodeId,
  handlesWithDataPorts,
  normalizeBinding,
  normalizeDataField,
  stableBindingId,
} from './canvas-io-utils';
import { CanvasDraftService } from './canvas-draft.service';
import { CanvasLockService } from './canvas-lock.service';
import { CanvasValidationService } from './canvas-validation.service';
import { CanvasAuthorizationService } from './canvas-authorization.service';
import { CanvasAutoBindingService } from './canvas-auto-binding.service';
import { CanvasModuleAvailabilityService } from './canvas-module-availability.service';
import {
  CanvasInsertRequest,
  CanvasModuleCompatibilityService,
} from './canvas-module-compatibility.service';
import { CanvasModuleCatalogService } from './canvas-module-catalog.service';
import { CanvasNodeFactory } from './canvas-node-factory.service';
import { TelemetryService } from '../telemetry/telemetry.service';

interface CanvasDbClient {
  query<T = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

interface OperationRecordInput {
  readonly access: AccessContext;
  readonly actor: AuthenticatedActor;
  readonly automationId: string;
  readonly draftId: string;
  readonly operation: CanvasOperation;
  readonly operationId: string;
  readonly beforeHash: string | null;
  readonly afterHash: string | null;
  readonly beforeRevisionCounter: number | null;
  readonly afterRevisionCounter: number | null;
  readonly expectedRevision: number | null;
  readonly resultingRevision: number | null;
  readonly validation: CanvasValidationSummary;
  readonly validationResultId: string | null;
  readonly inverseOperation: CanvasOperation | Record<string, unknown> | null;
  readonly rejected: boolean;
  readonly rejectedReason: CanvasOperationRejectReason | null;
}

@Injectable()
export class CanvasOperationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly draftService: CanvasDraftService,
    private readonly validationService: CanvasValidationService,
    private readonly lockService: CanvasLockService,
    private readonly auditService: AuditService,
    private readonly moduleAvailabilityService: CanvasModuleAvailabilityService,
    private readonly moduleCompatibilityService: CanvasModuleCompatibilityService,
    private readonly moduleCatalogService: CanvasModuleCatalogService,
    private readonly nodeFactory: CanvasNodeFactory,
    private readonly autoBindingService: CanvasAutoBindingService,
    private readonly telemetryService: TelemetryService,
    private readonly authorizationService: CanvasAuthorizationService,
  ) {}

  async applyOperations(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    input: CanvasOperationRequest,
    meta: {
      readonly requestId: string | null;
      readonly traceId: string | null;
    },
  ): Promise<CanvasOperationResponse> {
    const operations = input.operations as readonly CanvasOperation[];
    if (operations.length === 0) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'At least one Canvas operation is required.',
      );
    }

    if (!access.permissions.includes('canvas.edit')) {
      throw new AppHttpException(
        'PERMISSION_DENIED',
        403,
        'Canvas edit permission is required.',
      );
    }

    const ensuredDraft = await this.draftService.getDraftForMutation(
      actor,
      access,
      automationId,
    );
    const draftId = input.draft_id ?? ensuredDraft.id;
    await this.lockService.assertLockHeld(access, actor, automationId, draftId);

    const auditEvents: {
      readonly action: string;
      readonly operationType: CanvasOperation['operation_type'];
      readonly operationId: string;
      readonly validationStatus: string;
    }[] = [];
    const failedModuleEvents: {
      readonly operation: CanvasOperation;
      readonly rejectedReason: CanvasOperationRejectReason;
    }[] = [];
    const bindingEvents: {
      readonly operation: CanvasOperation;
      readonly operationId: string;
      readonly workflow: LexFrameWorkflowV2;
    }[] = [];
    const moduleResults: {
      readonly operation: CanvasOperation;
      readonly result: CanvasOperationResult;
    }[] = [];

    const response = await this.databaseService.transaction(async (client) => {
      const draft = await this.draftService.getDraftForUpdate(
        client,
        access,
        automationId,
        draftId,
      );
      if (!draft) {
        throw new AppHttpException(
          'CANVAS_OPERATION_INVALID',
          404,
          'Canvas draft was not found.',
        );
      }

      let workflow = canonicalizeWorkflowV2(draft.workflow);
      let beforeHash = this.draftService.hashWorkflow(workflow);
      let revisionCounter = draft.revision_counter;
      const expectedRevision =
        input.expected_revision ?? operations[0]?.base_revision_counter ?? null;
      const baseHash =
        input.base_hash ?? operations[0]?.base_workflow_hash ?? null;

      if (expectedRevision !== null && expectedRevision !== revisionCounter) {
        throw new AppHttpException(
          'CANVAS_REVISION_CONFLICT',
          409,
          'Canvas draft revision has changed.',
          {
            current_revision: revisionCounter,
            current_hash: beforeHash,
            resolution: { type: 'reload_required', can_rebase: false },
          },
        );
      }

      if (baseHash && baseHash !== beforeHash) {
        throw new AppHttpException(
          'CANVAS_REVISION_CONFLICT',
          409,
          'Canvas draft hash has changed.',
          {
            current_revision: revisionCounter,
            current_hash: beforeHash,
            resolution: { type: 'reload_required', can_rebase: false },
          },
        );
      }

      const operationResults: CanvasOperationResult[] = [];
      const appliedOperations: string[] = [];
      const operationRecords: OperationRecordInput[] = [];

      for (const [operationIndex, operation] of operations.entries()) {
        const duplicate = await this.findExistingOperation(
          client,
          draft.id,
          operation,
        );
        if (duplicate) {
          appliedOperations.push(operation.client_operation_id);
          continue;
        }

        const operationId = randomUUID();
        const beforeRevisionCounter = revisionCounter;
        const rejectedReason = await this.getEarlyRejectReason(
          actor,
          access,
          automationId,
          operation,
          beforeHash,
          revisionCounter,
          operationIndex === 0 && !input.expected_revision && !input.base_hash,
        );

        if (rejectedReason) {
          const validation = this.validationService.fastValidate(workflow);
          const validationResultId = await this.persistValidationResult(
            client,
            {
              access,
              actor,
              automationId,
              draftId: draft.id,
              revision: revisionCounter,
              validation,
              validationLevel: 'fast',
            },
          );
          await this.insertOperationRecord(client, {
            access,
            actor,
            automationId,
            draftId: draft.id,
            operation,
            operationId,
            beforeHash,
            afterHash: beforeHash,
            beforeRevisionCounter,
            afterRevisionCounter: beforeRevisionCounter,
            expectedRevision: expectedRevision ?? beforeRevisionCounter,
            resultingRevision: beforeRevisionCounter,
            validation,
            validationResultId,
            inverseOperation: null,
            rejected: true,
            rejectedReason,
          });
          failedModuleEvents.push({ operation, rejectedReason });
          return this.buildOperationResponse({
            draftId: draft.id,
            workflow,
            validation,
            accepted: false,
            operationId,
            rejectedReason,
            revisionCounter,
            appliedOperations,
          });
        }

        const inverseOperation = this.createInverseOperation(
          workflow,
          operation,
        );
        const result = await this.applySingleOperation(
          workflow,
          operation,
          access,
        );
        if (result.rejectedReason) {
          const validation = this.validationService.fastValidate(workflow);
          const validationResultId = await this.persistValidationResult(
            client,
            {
              access,
              actor,
              automationId,
              draftId: draft.id,
              revision: revisionCounter,
              validation,
              validationLevel: 'fast',
            },
          );
          await this.insertOperationRecord(client, {
            access,
            actor,
            automationId,
            draftId: draft.id,
            operation,
            operationId,
            beforeHash,
            afterHash: beforeHash,
            beforeRevisionCounter,
            afterRevisionCounter: beforeRevisionCounter,
            expectedRevision: expectedRevision ?? beforeRevisionCounter,
            resultingRevision: beforeRevisionCounter,
            validation,
            validationResultId,
            inverseOperation,
            rejected: true,
            rejectedReason: result.rejectedReason,
          });
          failedModuleEvents.push({
            operation,
            rejectedReason: result.rejectedReason,
          });
          return this.buildOperationResponse({
            draftId: draft.id,
            workflow,
            validation,
            accepted: false,
            operationId,
            rejectedReason: result.rejectedReason,
            revisionCounter,
            appliedOperations,
          });
        }

        revisionCounter += 1;
        workflow = canonicalizeWorkflowV2({
          ...result.workflow,
          revision_counter: revisionCounter,
        });
        const validation = this.validationService.fastValidate(workflow);
        workflow = this.draftService.withValidation(workflow, validation);
        const afterHash = this.draftService.hashWorkflow(workflow);

        operationRecords.push({
          access,
          actor,
          automationId,
          draftId: draft.id,
          operation,
          operationId,
          beforeHash,
          afterHash,
          beforeRevisionCounter,
          afterRevisionCounter: revisionCounter,
          expectedRevision: expectedRevision ?? beforeRevisionCounter,
          resultingRevision: revisionCounter,
          validation,
          validationResultId: null,
          inverseOperation,
          rejected: false,
          rejectedReason: null,
        });
        appliedOperations.push(operation.client_operation_id);
        if (result.operationResult) {
          operationResults.push(result.operationResult);
          moduleResults.push({ operation, result: result.operationResult });
        }
        bindingEvents.push({ operation, operationId, workflow });
        auditEvents.push({
          action: auditActionForOperation(operation.operation_type),
          operationType: operation.operation_type,
          operationId,
          validationStatus: validation.status,
        });
        beforeHash = afterHash;
      }

      const validation = this.validationService.fastValidate(workflow);
      workflow = this.draftService.withValidation(workflow, validation);
      const hash = this.draftService.hashWorkflow(workflow);
      const validationResultId = await this.persistValidationResult(client, {
        access,
        actor,
        automationId,
        draftId: draft.id,
        revision: revisionCounter,
        validation,
        validationLevel: 'fast',
      });
      const normalizedCanvas = this.draftService.buildCanvasReadModel(
        workflow,
        validation,
      );

      await client.query(
        `
          update app.automation_canvas_drafts
          set workflow = $4::jsonb,
              workflow_hash = $5,
              validation_summary = $6::jsonb,
              runtime_projection = $7::jsonb,
              normalized_canvas = $8::jsonb,
              revision_counter = $9,
              runtime_projection_status = $10,
              activepieces_sync_status = case
                when activepieces_sync_status = 'synced' then 'sync_required'
                else activepieces_sync_status
              end,
              status = $11,
              updated_by_user_id = $12,
              updated_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
            and installed_automation_id = $3
        `,
        [
          draft.id,
          requireWorkspaceId(access),
          automationId,
          JSON.stringify(workflow),
          hash,
          JSON.stringify(validation),
          JSON.stringify(workflow.runtime_projection),
          JSON.stringify(normalizedCanvas),
          revisionCounter,
          workflow.runtime_projection.status,
          validation.status === 'invalid'
            ? 'invalid'
            : validation.can_publish
              ? 'ready_to_publish'
              : 'valid',
          actor.id,
        ],
      );

      for (const record of operationRecords) {
        await this.insertOperationRecord(client, {
          ...record,
          validation,
          validationResultId,
        });
      }

      return this.buildOperationResponse({
        draftId: draft.id,
        workflow,
        validation,
        accepted: true,
        operationId: null,
        rejectedReason: null,
        revisionCounter,
        operationResults,
        appliedOperations,
      });
    });

    for (const event of failedModuleEvents) {
      await this.recordModuleAddFailedEvent({
        access,
        actor,
        automationId,
        operation: event.operation,
        rejectedReason: event.rejectedReason,
        traceId: meta.traceId,
      });
    }
    for (const event of bindingEvents) {
      await this.recordBindingEventIfNeeded({
        access,
        actor,
        automationId,
        draftId: draftId,
        operation: event.operation,
        operationId: event.operationId,
        workflow: event.workflow,
      });
    }
    for (const event of moduleResults) {
      await this.recordRecentModuleIfNeeded(access, actor, event.result);
      await this.recordModuleAddTelemetry({
        access,
        actor,
        automationId,
        operation: event.operation,
        result: event.result,
        traceId: meta.traceId,
      });
    }
    for (const event of auditEvents) {
      await this.auditService.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        workspaceId: access.activeWorkspace?.id ?? null,
        action: event.action,
        entityType: 'installed_automation',
        entityId: automationId,
        result: 'success',
        requestId: meta.requestId ?? null,
        traceId: meta.traceId ?? null,
        metadata: {
          operationType: event.operationType,
          operationId: event.operationId,
          validationStatus: event.validationStatus,
        },
      });
    }

    return response;
  }

  private async findExistingOperation(
    client: CanvasDbClient,
    draftId: string,
    operation: CanvasOperation,
  ) {
    const result = await client.query<{ readonly id: string }>(
      `
        select id
        from app.automation_canvas_operations
        where draft_version_id = $1
          and (
            client_operation_id = $2
            or ($3::text is not null and idempotency_key = $3)
          )
        limit 1
      `,
      [
        draftId,
        operation.client_operation_id,
        operation.idempotency_key ?? null,
      ],
    );
    return result.rows[0] ?? null;
  }

  private async persistValidationResult(
    client: CanvasDbClient,
    input: {
      readonly access: AccessContext;
      readonly actor: AuthenticatedActor;
      readonly automationId: string;
      readonly draftId: string;
      readonly revision: number;
      readonly validation: CanvasValidationSummary;
      readonly validationLevel:
        | 'fast'
        | 'full'
        | 'publish_gate'
        | 'runtime_gate';
    },
  ) {
    const id = randomUUID();
    await client.query(
      `
        insert into app.automation_canvas_validation_results (
          id,
          workspace_id,
          installed_automation_id,
          draft_version_id,
          revision,
          validation_level,
          status,
          errors,
          warnings,
          policy_blocks,
          summary,
          can_save,
          can_test,
          can_publish,
          can_compile,
          can_run,
          created_by_user_id
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14, $15, $16, $17)
      `,
      [
        id,
        requireWorkspaceId(input.access),
        input.automationId,
        input.draftId,
        input.revision,
        input.validationLevel,
        input.validation.status,
        JSON.stringify(
          input.validation.issues.filter((issue) => issue.severity === 'error'),
        ),
        JSON.stringify(
          input.validation.issues.filter(
            (issue) => issue.severity === 'warning',
          ),
        ),
        JSON.stringify(
          input.validation.issues.filter(
            (issue) => issue.severity === 'policy_block',
          ),
        ),
        JSON.stringify(input.validation),
        input.validation.can_save,
        input.validation.can_test,
        input.validation.can_publish,
        input.validation.can_compile,
        input.validation.can_run,
        input.actor.id,
      ],
    );
    return id;
  }

  async previewOperations(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    input: CanvasOperationRequest,
  ): Promise<
    CanvasOperationPreviewResponse & {
      readonly draft_id: string;
      readonly revision_counter: number;
    }
  > {
    if (
      !access.permissions.includes('canvas.view_validation') &&
      !access.permissions.includes('canvas.edit')
    ) {
      throw new AppHttpException(
        'PERMISSION_DENIED',
        403,
        'Canvas validation view or edit permission is required.',
      );
    }

    const draft = await this.draftService.ensureDraft(
      actor,
      access,
      automationId,
    );
    let workflow = draft.workflow;
    const beforeValidation = this.validationService.fullValidate(workflow);
    const operations = input.operations as readonly CanvasOperation[];

    for (const operation of operations) {
      const result = await this.applySingleOperation(
        workflow,
        operation,
        access,
      );
      if (result.rejectedReason) {
        const validation =
          this.validationService.operationPreviewValidate(workflow);
        return {
          draft_id: draft.id,
          revision_counter: draft.revision_counter,
          would_succeed: false,
          validation,
          validation_delta: validationDelta(
            beforeValidation.issues,
            validation.issues,
          ),
          preview_workflow_hash: this.draftService.hashWorkflow(workflow),
        };
      }
      workflow = canonicalizeWorkflowV2(result.workflow);
    }

    const validation =
      this.validationService.operationPreviewValidate(workflow);
    return {
      draft_id: draft.id,
      revision_counter: draft.revision_counter,
      would_succeed: validation.can_save,
      validation,
      validation_delta: validationDelta(
        beforeValidation.issues,
        validation.issues,
      ),
      preview_workflow_hash: this.draftService.hashWorkflow(workflow),
    };
  }

  private buildOperationResponse(input: {
    readonly draftId: string;
    readonly workflow: LexFrameWorkflowV2;
    readonly validation: CanvasValidationSummary;
    readonly accepted: boolean;
    readonly operationId: string | null;
    readonly rejectedReason: CanvasOperationRejectReason | null;
    readonly revisionCounter: number;
    readonly operationResults?: readonly CanvasOperationResult[];
    readonly appliedOperations?: readonly string[];
  }): CanvasOperationResponse {
    const hash = this.draftService.hashWorkflow(input.workflow);
    return {
      accepted: input.accepted,
      operation_id: input.operationId,
      draft_id: input.draftId,
      revision: input.revisionCounter,
      draft_hash: hash,
      workflow: input.workflow,
      canvas: this.draftService.buildCanvasReadModel(
        input.workflow,
        input.validation,
      ),
      validation: input.validation,
      rejected_reason: input.rejectedReason,
      new_workflow_hash: hash,
      revision_counter: input.revisionCounter,
      applied_operations: input.appliedOperations ?? [],
      operation_results: input.operationResults ?? [],
    };
  }

  private createInverseOperation(
    workflow: LexFrameWorkflowV2,
    operation: CanvasOperation,
  ): CanvasOperation | Record<string, unknown> | null {
    const payload = operation.operation_payload;
    const nodeId =
      stringValue(payload.node_id) ??
      (isRecord(payload.node) ? stringValue(payload.node.id) : null);
    const edgeId =
      stringValue(payload.edge_id) ??
      (isRecord(payload.edge) ? stringValue(payload.edge.id) : null);

    if (operation.operation_type === 'ADD_NODE_FROM_MODULE') {
      return null;
    }
    if (operation.operation_type === 'ADD_NODE' && nodeId) {
      return inverseOperation(operation, 'DELETE_NODE', { node_id: nodeId });
    }
    if (operation.operation_type === 'DELETE_NODE' && nodeId) {
      const node = workflow.nodes.find((item) => item.id === nodeId);
      const edges = workflow.edges.filter(
        (edge) =>
          edge.source_node_id === nodeId || edge.target_node_id === nodeId,
      );
      return {
        operations: [
          node ? inverseOperation(operation, 'ADD_NODE', { node }) : null,
          ...edges.map((edge) =>
            inverseOperation(operation, 'ADD_EDGE', { edge }),
          ),
        ].filter(Boolean),
      };
    }
    if (operation.operation_type === 'MOVE_NODE' && nodeId) {
      const node = workflow.nodes.find((item) => item.id === nodeId);
      if (node) {
        return inverseOperation(operation, 'MOVE_NODE', {
          node_id: nodeId,
          x: node.layout.x,
          y: node.layout.y,
        });
      }
    }
    if (operation.operation_type === 'ADD_EDGE' && edgeId) {
      return inverseOperation(operation, 'DELETE_EDGE', { edge_id: edgeId });
    }
    if (operation.operation_type === 'DELETE_EDGE' && edgeId) {
      const edge = workflow.edges.find((item) => item.id === edgeId);
      return edge ? inverseOperation(operation, 'ADD_EDGE', { edge }) : null;
    }
    if (operation.operation_type === 'UPSERT_INPUT_BINDING') {
      const binding = normalizeBinding(payload.binding ?? payload);
      const targetNodeId = binding ? bindingTargetNodeId(binding) : null;
      const inputKey = binding ? bindingTargetInputKey(binding) : null;
      const node = targetNodeId
        ? workflow.nodes.find((item) => item.id === targetNodeId)
        : null;
      const previous = node?.input_bindings?.find(
        (item) => bindingTargetInputKey(item) === inputKey,
      );
      return previous
        ? inverseOperation(operation, 'UPSERT_INPUT_BINDING', {
            binding: previous,
          })
        : inverseOperation(operation, 'DELETE_INPUT_BINDING', {
            node_id: targetNodeId,
            input_key: inputKey,
          });
    }
    return null;
  }

  private async getEarlyRejectReason(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    operation: CanvasOperation,
    currentHash: string,
    currentRevisionCounter: number,
    enforceStaleGuard: boolean,
  ): Promise<CanvasOperationRejectReason | null> {
    if (
      enforceStaleGuard &&
      operation.base_workflow_hash &&
      operation.base_workflow_hash !== currentHash
    ) {
      return 'WORKFLOW_HASH_MISMATCH';
    }

    if (
      enforceStaleGuard &&
      operation.base_revision_counter !== undefined &&
      operation.base_revision_counter !== null &&
      operation.base_revision_counter !== currentRevisionCounter
    ) {
      return 'WORKFLOW_HASH_MISMATCH';
    }

    if (await this.lockService.isLockedByOther(access, actor, automationId)) {
      return 'DRAFT_LOCKED';
    }

    const decision = await this.authorizationService.authorizeOperation({
      actor,
      access,
      automationId,
      operation,
    });
    if (!decision.allowed) {
      try {
        await this.authorizationService.assertAllowed({
          actor,
          access,
          automationId,
          decision,
          metadata: {
            clientOperationId: operation.client_operation_id,
            operationType: operation.operation_type,
          },
        });
      } catch {
        // Rejected Canvas operations are persisted as operation results instead
        // of aborting the whole batch.
      }
      return decision.reason_code === 'POLICY_BLOCKED' ||
        decision.reason_code === 'POLICY_OVERRIDE_REQUIRED'
        ? 'POLICY_BLOCKED'
        : 'PERMISSION_DENIED';
    }

    if (operation.operation_type === 'UPSERT_INPUT_BINDING') {
      const binding = normalizeBinding(
        operation.operation_payload.binding ?? operation.operation_payload,
      );
      if (
        binding?.source.type === 'expression' &&
        !access.permissions.includes('canvas.debug')
      ) {
        return 'PERMISSION_DENIED';
      }
    }

    if (
      operation.operation_type === 'RUNTIME_IMPORT_AS_DRAFT' &&
      !access.permissions.includes('canvas.import_runtime')
    ) {
      return 'PERMISSION_DENIED';
    }

    return null;
  }

  private async applySingleOperation(
    workflow: LexFrameWorkflowV2,
    operation: CanvasOperation,
    access: AccessContext,
  ): Promise<
    | {
        readonly workflow: LexFrameWorkflowV2;
        readonly rejectedReason?: null;
        readonly operationResult?: CanvasOperationResult;
      }
    | {
        readonly workflow: LexFrameWorkflowV2;
        readonly rejectedReason: CanvasOperationRejectReason;
      }
  > {
    const payload = operation.operation_payload;

    if (operation.operation_type === 'ADD_NODE_FROM_MODULE') {
      return this.applyAddNodeFromModule(workflow, operation, access);
    }

    if (operation.operation_type === 'SNAPSHOT_RESTORE') {
      const restoredWorkflow = isRecord(payload.workflow)
        ? (payload.workflow as unknown as LexFrameWorkflowV2)
        : null;
      if (!restoredWorkflow) {
        return { workflow, rejectedReason: 'INVALID_NODE_TYPE' };
      }
      return {
        workflow: {
          ...canonicalizeWorkflowV2(restoredWorkflow),
          draft_version_id: workflow.draft_version_id,
          automation_id: workflow.automation_id,
          workspace_id: workflow.workspace_id,
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'RUNTIME_IMPORT_AS_DRAFT') {
      return { workflow, rejectedReason: 'RUNTIME_CONFLICT' };
    }

    if (operation.operation_type === 'ADD_NODE') {
      const node = normalizeWorkflowNode(payload.node);
      if (!node) {
        return { workflow, rejectedReason: 'INVALID_NODE_TYPE' };
      }
      if (workflow.nodes.some((item) => item.id === node.id)) {
        return { workflow, rejectedReason: 'INVALID_NODE_TYPE' };
      }
      return {
        workflow: {
          ...workflow,
          nodes: [...workflow.nodes, node],
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'DUPLICATE_NODE') {
      const sourceNodeId = stringValue(payload.node_id);
      const sourceNode = sourceNodeId
        ? workflow.nodes.find((node) => node.id === sourceNodeId)
        : null;
      if (!sourceNode) {
        return { workflow, rejectedReason: 'INVALID_NODE_TYPE' };
      }
      const duplicateId =
        stringValue(payload.new_node_id) ??
        `${sourceNode.id}_copy_${Date.now()}`;
      const offset = numberValue(payload.offset) ?? 56;
      const duplicate = canonicalizeNode({
        ...sourceNode,
        id: duplicateId,
        display_name:
          stringValue(payload.display_name) ??
          `${sourceNode.display_name} copy`,
        layout: {
          ...sourceNode.layout,
          x: sourceNode.layout.x + offset,
          y: sourceNode.layout.y + offset,
        },
        canvas: sourceNode.canvas
          ? {
              ...sourceNode.canvas,
              x: sourceNode.canvas.x + offset,
              y: sourceNode.canvas.y + offset,
            }
          : undefined,
      });
      return {
        workflow: {
          ...workflow,
          nodes: [...workflow.nodes, duplicate],
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'UPDATE_NODE') {
      const nodeId = stringValue(payload.node_id);
      const patch = isRecord(payload.patch) ? payload.patch : {};
      if (!nodeId) {
        return { workflow, rejectedReason: 'INVALID_NODE_TYPE' };
      }
      const node = workflow.nodes.find((item) => item.id === nodeId);
      if (
        node?.type === 'approval' &&
        deliveryWouldLoseApproval(workflow, nodeId)
      ) {
        return { workflow, rejectedReason: 'POLICY_BLOCKED' };
      }
      return {
        workflow: {
          ...workflow,
          nodes: workflow.nodes.map((node) =>
            node.id === nodeId
              ? ({ ...node, ...patch, id: node.id } as WorkflowNode)
              : node,
          ),
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'UPDATE_NODE_CONFIG') {
      const nodeId = stringValue(payload.node_id);
      const config = isRecord(payload.config) ? payload.config : {};
      if (!nodeId) {
        return { workflow, rejectedReason: 'INVALID_NODE_TYPE' };
      }
      return {
        workflow: {
          ...workflow,
          nodes: workflow.nodes.map((node) =>
            node.id === nodeId
              ? { ...node, config: { ...node.config, ...config } }
              : node,
          ),
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'MOVE_NODE') {
      const nodeId = stringValue(payload.node_id);
      const x = numberValue(payload.x);
      const y = numberValue(payload.y);
      if (!nodeId || x === null || y === null) {
        return { workflow, rejectedReason: 'INVALID_NODE_TYPE' };
      }
      return {
        workflow: {
          ...workflow,
          nodes: workflow.nodes.map((node) =>
            node.id === nodeId
              ? { ...node, layout: { ...node.layout, x, y } }
              : node,
          ),
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'DELETE_NODE') {
      const nodeId = stringValue(payload.node_id);
      if (!nodeId) {
        return { workflow, rejectedReason: 'INVALID_NODE_TYPE' };
      }
      return {
        workflow: {
          ...workflow,
          nodes: workflow.nodes.filter((node) => node.id !== nodeId),
          edges: workflow.edges.filter(
            (edge) =>
              edge.source_node_id !== nodeId && edge.target_node_id !== nodeId,
          ),
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'ADD_EDGE') {
      const edge = normalizeWorkflowEdge(payload.edge);
      if (!edge) {
        return { workflow, rejectedReason: 'INVALID_EDGE_TYPE' };
      }
      const reject = validateNewEdge(workflow, edge);
      if (reject) {
        return { workflow, rejectedReason: reject };
      }
      return {
        workflow: {
          ...workflow,
          edges: [...workflow.edges, edge],
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'DELETE_EDGE') {
      const edgeId = stringValue(payload.edge_id);
      if (!edgeId) {
        return { workflow, rejectedReason: 'INVALID_EDGE_TYPE' };
      }
      return {
        workflow: {
          ...workflow,
          edges: workflow.edges.filter((edge) => edge.id !== edgeId),
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'UPDATE_EDGE') {
      const edgeId = stringValue(payload.edge_id);
      const patch = isRecord(payload.patch) ? payload.patch : {};
      if (!edgeId) {
        return { workflow, rejectedReason: 'INVALID_EDGE_TYPE' };
      }
      return {
        workflow: {
          ...workflow,
          edges: workflow.edges.map((edge) =>
            edge.id === edgeId
              ? ({ ...edge, ...patch, id: edge.id } as WorkflowEdge)
              : edge,
          ),
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'UPDATE_CONDITION') {
      const nodeId = stringValue(payload.node_id);
      const edgeId = stringValue(payload.edge_id);
      const condition =
        typeof payload.condition === 'string' || isRecord(payload.condition)
          ? (payload.condition as WorkflowEdge['condition'])
          : null;
      if (!nodeId && !edgeId) {
        return { workflow, rejectedReason: 'INVALID_NODE_TYPE' };
      }
      return {
        workflow: {
          ...workflow,
          nodes: workflow.nodes.map((node) =>
            node.id === nodeId
              ? { ...node, config: { ...node.config, condition } }
              : node,
          ),
          edges: workflow.edges.map((edge) =>
            edge.id === edgeId ? { ...edge, condition } : edge,
          ),
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'UPDATE_WORKFLOW_POLICY') {
      const patch = isRecord(payload.policy) ? payload.policy : payload;
      return {
        workflow: {
          ...workflow,
          policies: {
            ...workflow.policies,
            ...patch,
          } as LexFrameWorkflowV2['policies'],
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'UPDATE_NODE_POLICY') {
      const nodeId = stringValue(payload.node_id);
      const patch = isRecord(payload.policy) ? payload.policy : {};
      if (!nodeId) {
        return { workflow, rejectedReason: 'INVALID_NODE_TYPE' };
      }
      return {
        workflow: {
          ...workflow,
          nodes: workflow.nodes.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  policy: { ...node.policy, ...patch },
                  policies: { ...(node.policies ?? node.policy), ...patch },
                }
              : node,
          ),
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'UPDATE_LAYOUT') {
      if (payload.auto_arrange === true) {
        return { workflow: applyGuidedLayout(workflow) };
      }

      const positions = Array.isArray(payload.nodes) ? payload.nodes : [];
      return {
        workflow: {
          ...workflow,
          nodes: workflow.nodes.map((node) => {
            const next = positions.find(
              (item) => isRecord(item) && item.id === node.id,
            );
            if (!isRecord(next)) {
              return node;
            }
            const x = numberValue(next.x);
            const y = numberValue(next.y);
            return x === null || y === null
              ? node
              : { ...node, layout: { ...node.layout, x, y } };
          }),
          layout: {
            ...workflow.layout,
            updated_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'UPSERT_WORKFLOW_INPUT') {
      const field = normalizeDataField(
        payload.input ?? payload.field ?? payload,
      );
      if (!field) {
        return { workflow, rejectedReason: 'INVALID_WORKFLOW_IO' };
      }
      return {
        workflow: {
          ...workflow,
          inputs: upsertByKey(workflow.inputs, field),
          workflow_inputs: upsertByKey(
            workflow.workflow_inputs ?? workflow.inputs,
            field,
          ),
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'DELETE_WORKFLOW_INPUT') {
      const key =
        stringValue(payload.key) ??
        stringValue(payload.input_key) ??
        stringValue(payload.inputKey);
      if (!key) {
        return { workflow, rejectedReason: 'INVALID_WORKFLOW_IO' };
      }
      return {
        workflow: {
          ...workflow,
          inputs: workflow.inputs.filter((input) => input.key !== key),
          workflow_inputs: (workflow.workflow_inputs ?? workflow.inputs).filter(
            (input) => input.key !== key,
          ),
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'UPSERT_WORKFLOW_OUTPUT') {
      const field = normalizeDataField(
        payload.output ?? payload.field ?? payload,
      );
      if (!field) {
        return { workflow, rejectedReason: 'INVALID_WORKFLOW_IO' };
      }
      return {
        workflow: {
          ...workflow,
          outputs: upsertByKey(workflow.outputs, field),
          workflow_outputs: upsertByKey(
            workflow.workflow_outputs ?? workflow.outputs,
            field,
          ),
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'DELETE_WORKFLOW_OUTPUT') {
      const key =
        stringValue(payload.key) ??
        stringValue(payload.output_key) ??
        stringValue(payload.outputKey);
      if (!key) {
        return { workflow, rejectedReason: 'INVALID_WORKFLOW_IO' };
      }
      return {
        workflow: {
          ...workflow,
          outputs: workflow.outputs.filter((output) => output.key !== key),
          workflow_outputs: (
            workflow.workflow_outputs ?? workflow.outputs
          ).filter((output) => output.key !== key),
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'UPSERT_INPUT_BINDING') {
      const binding = normalizeBinding(payload.binding ?? payload);
      if (
        !binding ||
        !bindingTargetNodeId(binding) ||
        !bindingTargetInputKey(binding)
      ) {
        return { workflow, rejectedReason: 'INVALID_BINDING' };
      }
      if (!bindingTargetExists(workflow, binding)) {
        return { workflow, rejectedReason: 'INVALID_BINDING' };
      }
      return {
        workflow: {
          ...workflow,
          nodes: workflow.nodes.map((node) =>
            node.id === bindingTargetNodeId(binding)
              ? upsertNodeBinding(node, binding)
              : node,
          ),
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'DELETE_INPUT_BINDING') {
      const nodeId =
        stringValue(payload.node_id) ??
        stringValue(payload.target_node_id) ??
        (isRecord(payload.target) ? stringValue(payload.target.node_id) : null);
      const inputKey =
        stringValue(payload.input_key) ??
        stringValue(payload.target_input_key) ??
        (isRecord(payload.target)
          ? stringValue(payload.target.input_key)
          : null);
      const id = stringValue(payload.binding_id) ?? stringValue(payload.id);
      if (!nodeId && !id) {
        return { workflow, rejectedReason: 'INVALID_BINDING' };
      }
      return {
        workflow: {
          ...workflow,
          nodes: workflow.nodes.map((node) =>
            removeNodeBinding(node, { nodeId, inputKey, id }),
          ),
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'PIN_SAMPLE_DATA') {
      const nodeId = stringValue(payload.node_id);
      const pinnedOutputId =
        stringValue(payload.sample_data_id) ??
        stringValue(payload.pinned_sample_data_id);
      if (!nodeId) {
        return { workflow, rejectedReason: 'INVALID_NODE_TYPE' };
      }
      return {
        workflow: {
          ...workflow,
          nodes: workflow.nodes.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  test_state: {
                    ...(node.test_state ?? { sample_data_status: 'missing' }),
                    sample_data_status: 'pinned',
                    pinned_output_id: pinnedOutputId ?? null,
                  },
                }
              : node,
          ),
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (operation.operation_type === 'UNPIN_SAMPLE_DATA') {
      const nodeId = stringValue(payload.node_id);
      if (!nodeId) {
        return { workflow, rejectedReason: 'INVALID_NODE_TYPE' };
      }
      return {
        workflow: {
          ...workflow,
          nodes: workflow.nodes.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  test_state: {
                    ...(node.test_state ?? { sample_data_status: 'missing' }),
                    sample_data_status: 'available',
                    pinned_output_id: null,
                  },
                }
              : node,
          ),
          updated_at: new Date().toISOString(),
        },
      };
    }

    return { workflow, rejectedReason: 'INVALID_NODE_TYPE' };
  }

  private async applyAddNodeFromModule(
    workflow: LexFrameWorkflowV2,
    operation: CanvasOperation,
    access: AccessContext,
  ): Promise<
    | {
        readonly workflow: LexFrameWorkflowV2;
        readonly rejectedReason?: null;
        readonly operationResult: CanvasOperationResult;
      }
    | {
        readonly workflow: LexFrameWorkflowV2;
        readonly rejectedReason: CanvasOperationRejectReason;
      }
  > {
    const payload = operation.operation_payload;
    const moduleCode =
      stringValue(payload.module_code) ??
      stringValue(payload.moduleCode) ??
      stringValue(payload.block_code) ??
      stringValue(payload.blockCode);
    if (!moduleCode) {
      return { workflow, rejectedReason: 'INVALID_NODE_TYPE' };
    }

    const staticBlock = findCanvasBlockDefinition(moduleCode);
    const dynamicCard = staticBlock
      ? null
      : await this.moduleCatalogService.getActivepiecesModuleCard(moduleCode);
    const genericActivepiecesBlock = dynamicCard
      ? findCanvasBlockDefinition('activepieces_action')
      : null;
    const block = staticBlock
      ? staticBlock
      : dynamicCard && genericActivepiecesBlock
        ? buildDynamicActivepiecesBlock(genericActivepiecesBlock, dynamicCard)
        : null;
    if (!block) {
      return { workflow, rejectedReason: 'INVALID_NODE_TYPE' };
    }

    const insert = parseInsertRequest(payload.insert);
    const availability = dynamicCard
      ? {
          availability: dynamicCard.availability,
          requirements: dynamicCard.requirements,
        }
      : this.moduleAvailabilityService.evaluate({
          block,
          access,
          hasApprovalPath: hasApprovalBefore(
            workflow,
            insert.source_node_id ?? '',
          ),
        });
    if (isBlockingAvailability(availability.availability.status)) {
      return { workflow, rejectedReason: 'POLICY_BLOCKED' };
    }

    const compatibility = this.moduleCompatibilityService.check({
      access,
      workflow,
      block,
      insert,
    });
    if (!compatibility.allowed) {
      return { workflow, rejectedReason: 'POLICY_BLOCKED' };
    }

    const factoryResult = this.nodeFactory.createFromModule({
      workflow,
      block,
      insert,
      initialConfig: isRecord(payload.initial_config)
        ? payload.initial_config
        : isRecord(payload.initialConfig)
          ? payload.initialConfig
          : undefined,
      moduleVersion:
        stringValue(payload.module_version) ??
        stringValue(payload.moduleVersion),
    });
    const createdNode = dynamicCard
      ? withDynamicActivepiecesNode(factoryResult.node, dynamicCard)
      : factoryResult.node;
    const deletedEdges = workflow.edges.filter((edge) =>
      factoryResult.deletedEdgeIds.includes(edge.id),
    );
    let nextWorkflow = canonicalizeWorkflowV2({
      ...workflow,
      nodes: [...workflow.nodes, createdNode],
      edges: [
        ...workflow.edges.filter(
          (edge) => !factoryResult.deletedEdgeIds.includes(edge.id),
        ),
        ...factoryResult.edges,
      ],
      updated_at: new Date().toISOString(),
    });
    const addedNode = nextWorkflow.nodes.find(
      (node) => node.id === createdNode.id,
    );
    const autoBinding = addedNode
      ? this.autoBindingService.bind({
          workflow: nextWorkflow,
          node: addedNode,
          apply:
            payload.auto_bind_inputs !== false &&
            payload.autoBindInputs !== false,
        })
      : { bindings: [], suggestions: [] };

    if (autoBinding.bindings.length > 0 && addedNode) {
      nextWorkflow = canonicalizeWorkflowV2({
        ...nextWorkflow,
        nodes: nextWorkflow.nodes.map((node) =>
          node.id === addedNode.id
            ? {
                ...node,
                input_bindings: [
                  ...(node.input_bindings ?? []),
                  ...autoBinding.bindings,
                ],
              }
            : node,
        ),
      });
    }

    const undoOperations: CanvasOperation[] = [
      {
        client_operation_id: `${operation.client_operation_id}:undo_delete_node`,
        operation_type: 'DELETE_NODE',
        operation_payload: { node_id: createdNode.id },
      },
      ...deletedEdges.map((edge, index) => ({
        client_operation_id: `${operation.client_operation_id}:undo_edge_${index}`,
        operation_type: 'ADD_EDGE' as const,
        operation_payload: { edge },
      })),
    ];

    return {
      workflow: nextWorkflow,
      operationResult: {
        operation_type: 'ADD_NODE_FROM_MODULE',
        module_code: dynamicCard?.module_code ?? block.code,
        added_node_id: createdNode.id,
        created_edges: factoryResult.edges,
        created_bindings: autoBinding.bindings,
        binding_suggestions: autoBinding.suggestions,
        missing_requirements: availability.requirements.filter(
          (requirement) => requirement.status === 'missing',
        ),
        warnings: compatibility.warnings,
        undo_operations: undoOperations,
      },
    };
  }

  private async insertOperationRecord(
    client: CanvasDbClient,
    input: OperationRecordInput,
  ) {
    const workspaceId = requireWorkspaceId(input.access);
    await client.query(
      `
        insert into app.automation_canvas_operations (
          id,
          workspace_id,
          project_id,
          installed_automation_id,
          draft_version_id,
          actor_id,
          client_operation_id,
          operation_type,
          operation_payload,
          before_hash,
          after_hash,
          before_revision,
          after_revision,
          expected_revision,
          resulting_revision,
          inverse_operation_payload,
          idempotency_key,
          validation_result_id,
          validation_summary,
          rejected,
          rejected_reason
        )
        values ($1, $2, null, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17, $18::jsonb, $19, $20)
        on conflict (workspace_id, installed_automation_id, client_operation_id) do nothing
      `,
      [
        input.operationId,
        workspaceId,
        input.automationId,
        input.draftId,
        input.actor.id,
        input.operation.client_operation_id,
        input.operation.operation_type,
        JSON.stringify(
          redactOperationPayload(input.operation.operation_payload),
        ),
        input.beforeHash,
        input.afterHash,
        input.beforeRevisionCounter,
        input.afterRevisionCounter,
        input.expectedRevision,
        input.resultingRevision,
        JSON.stringify(input.inverseOperation),
        input.operation.idempotency_key ?? null,
        input.validationResultId,
        JSON.stringify(input.validation),
        input.rejected,
        input.rejectedReason,
      ],
    );
  }

  private async recordBindingEventIfNeeded(input: {
    readonly access: AccessContext;
    readonly actor: AuthenticatedActor;
    readonly automationId: string;
    readonly draftId: string;
    readonly operation: CanvasOperation;
    readonly operationId: string;
    readonly workflow: LexFrameWorkflowV2;
  }) {
    if (!input.operation.operation_type.includes('BINDING')) {
      return;
    }
    const workspaceId = requireWorkspaceId(input.access);
    const payload = input.operation.operation_payload;
    const binding = normalizeBinding(payload.binding ?? payload);
    const bindingIdentifier =
      stringValue(payload.binding_id) ??
      stringValue(payload.id) ??
      (binding ? bindingId(binding) : input.operationId);
    try {
      await this.databaseService.query(
        `
          insert into app.automation_canvas_binding_events (
            workspace_id,
            installed_automation_id,
            draft_version_id,
            operation_id,
            binding_id,
            event_type,
            actor_id,
            payload
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        `,
        [
          workspaceId,
          input.automationId,
          input.draftId,
          input.operationId,
          bindingIdentifier,
          input.operation.operation_type,
          input.actor.id,
          JSON.stringify(redactOperationPayload(payload)),
        ],
      );
    } catch {
      // Binding events are audit-adjacent. The accepted operation remains the source of truth.
    }
  }

  private async recordRecentModuleIfNeeded(
    access: AccessContext,
    actor: AuthenticatedActor,
    result: CanvasOperationResult,
  ) {
    if (
      result.operation_type !== 'ADD_NODE_FROM_MODULE' ||
      !result.added_node_id
    ) {
      return;
    }
    const moduleCode =
      result.module_code ??
      result.added_node_id.split('_').slice(0, -1).join('_');
    try {
      await this.databaseService.query(
        `
          insert into app.canvas_module_recent (
            workspace_id,
            actor_id,
            module_code,
            used_at
          )
          values ($1, $2, $3, timezone('utc', now()))
          on conflict (workspace_id, actor_id, module_code)
          do update set used_at = excluded.used_at
        `,
        [requireWorkspaceId(access), actor.id, moduleCode],
      );
    } catch {
      // Recent-module tracking must never make a Canvas operation fail.
    }
  }

  private async recordModuleAddTelemetry(input: {
    readonly access: AccessContext;
    readonly actor: AuthenticatedActor;
    readonly automationId: string;
    readonly operation: CanvasOperation;
    readonly result: CanvasOperationResult;
    readonly traceId: string | null;
  }) {
    if (
      input.result.operation_type !== 'ADD_NODE_FROM_MODULE' ||
      !input.result.added_node_id
    ) {
      return;
    }
    const moduleCode =
      input.result.module_code ?? moduleCodeFromOperation(input.operation);
    if (!moduleCode) {
      return;
    }
    const payload = input.operation.operation_payload;
    const addSource = isRecord(payload) ? stringValue(payload.source) : null;

    await this.enqueueCanvasProductEvent({
      access: input.access,
      actor: input.actor,
      automationId: input.automationId,
      eventName: 'canvas_module_add_completed',
      moduleCode,
      traceId: input.traceId,
      idempotencyKey: `${input.automationId}:${input.operation.client_operation_id}:module-add-completed`,
      properties: {
        automationId: input.automationId,
        moduleCode,
        addedNodeId: input.result.added_node_id,
        source: addSource,
        createdEdgesCount: input.result.created_edges?.length ?? 0,
        createdBindingsCount: input.result.created_bindings?.length ?? 0,
        bindingSuggestionsCount: input.result.binding_suggestions?.length ?? 0,
        missingRequirementCodes: (input.result.missing_requirements ?? []).map(
          (requirement) => requirement.code,
        ),
        warningsCount: input.result.warnings?.length ?? 0,
      },
    });

    for (const binding of input.result.created_bindings ?? []) {
      const bindingIdValue = binding.id;
      if (!bindingIdValue) {
        continue;
      }
      await this.enqueueCanvasProductEvent({
        access: input.access,
        actor: input.actor,
        automationId: input.automationId,
        eventName: 'canvas_auto_binding_created',
        moduleCode,
        traceId: input.traceId,
        idempotencyKey: `${input.automationId}:${input.operation.client_operation_id}:auto-binding-created:${bindingIdValue}`,
        properties: {
          automationId: input.automationId,
          moduleCode,
          bindingId: bindingIdValue,
          targetNodeId: binding.target?.node_id ?? null,
          targetInputKey: binding.target?.input_key ?? null,
          sourceType: binding.source.type,
        },
      });
    }

    for (const binding of input.result.binding_suggestions ?? []) {
      const bindingIdValue = binding.id;
      if (!bindingIdValue) {
        continue;
      }
      await this.enqueueCanvasProductEvent({
        access: input.access,
        actor: input.actor,
        automationId: input.automationId,
        eventName: 'canvas_auto_binding_suggested',
        moduleCode,
        traceId: input.traceId,
        idempotencyKey: `${input.automationId}:${input.operation.client_operation_id}:auto-binding-suggested:${bindingIdValue}`,
        properties: {
          automationId: input.automationId,
          moduleCode,
          bindingId: bindingIdValue,
          targetNodeId: binding.target?.node_id ?? null,
          targetInputKey: binding.target?.input_key ?? null,
          sourceType: binding.source.type,
        },
      });
    }
  }

  private async recordModuleAddFailedEvent(input: {
    readonly access: AccessContext;
    readonly actor: AuthenticatedActor;
    readonly automationId: string;
    readonly operation: CanvasOperation;
    readonly rejectedReason: CanvasOperationRejectReason;
    readonly traceId: string | null;
  }) {
    if (input.operation.operation_type !== 'ADD_NODE_FROM_MODULE') {
      return;
    }
    const moduleCode = moduleCodeFromOperation(input.operation);
    if (!moduleCode) {
      return;
    }
    await this.enqueueCanvasProductEvent({
      access: input.access,
      actor: input.actor,
      automationId: input.automationId,
      eventName: 'canvas_module_add_failed',
      moduleCode,
      traceId: input.traceId,
      idempotencyKey: `${input.automationId}:${input.operation.client_operation_id}:module-add-failed`,
      properties: {
        automationId: input.automationId,
        moduleCode,
        reasonCode: input.rejectedReason,
      },
    });
  }

  private async enqueueCanvasProductEvent(input: {
    readonly access: AccessContext;
    readonly actor: AuthenticatedActor;
    readonly automationId: string;
    readonly eventName: string;
    readonly moduleCode: string;
    readonly traceId: string | null;
    readonly idempotencyKey: string;
    readonly properties: Record<string, unknown>;
  }) {
    const workspaceId = input.access.activeWorkspace?.id;
    if (!workspaceId) {
      return;
    }
    try {
      await this.telemetryService.enqueueAuthoritativeEvent({
        actorUserId: input.actor.id,
        workspaceId,
        sessionId: null,
        traceId: input.traceId,
        eventName: input.eventName,
        source: 'backend',
        eventTime: new Date().toISOString(),
        resourceType: 'automation',
        resourceId: input.automationId,
        processInstanceId: null,
        runId: null,
        properties: input.properties,
        clientEventId: null,
        idempotencyKey: input.idempotencyKey,
      });
    } catch {
      // Product telemetry must not affect the accepted Canvas operation.
    }
  }
}

function moduleCodeFromOperation(operation: CanvasOperation) {
  if (operation.operation_type !== 'ADD_NODE_FROM_MODULE') {
    return null;
  }
  const payload = operation.operation_payload;
  if (!isRecord(payload)) {
    return null;
  }
  return (
    stringValue(payload.module_code) ??
    stringValue(payload.moduleCode) ??
    stringValue(payload.block_code) ??
    stringValue(payload.blockCode)
  );
}

function normalizeWorkflowNode(value: unknown): WorkflowNode | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.type !== 'string'
  ) {
    return null;
  }
  const type = value.type as WorkflowNode['type'];
  if (
    ![
      'trigger',
      'legalAction',
      'aiAction',
      'documentInput',
      'condition',
      'loop',
      'merge',
      'approval',
      'wait',
      'delivery',
      'storage',
      'subworkflow',
      'errorHandler',
      'end',
      'note',
      'group',
    ].includes(type)
  ) {
    return null;
  }
  const blockCode =
    stringValue(value.block_code) ??
    stringValue(value.blockCode) ??
    stringValue(value.module_code) ??
    stringValue(value.moduleCode) ??
    stringValue(value.trigger_kind) ??
    stringValue(value.triggerKind) ??
    value.id;
  const block = findCanvasBlockDefinition(blockCode);

  const inputs = Array.isArray(value.inputs)
    ? normalizeDataFields(value.inputs)
    : block
      ? normalizeDataFields(block.inputs)
      : [];
  const outputs = Array.isArray(value.outputs)
    ? normalizeDataFields(value.outputs)
    : block
      ? normalizeDataFields(block.outputs)
      : [];
  const handles = Array.isArray(value.handles)
    ? (value.handles as WorkflowNode['handles'])
    : block
      ? block.handles.map((handle) => ({
          code: handle.code,
          label: handle.label,
          direction: handle.direction,
          kind: handle.kind,
          edge_types: handle.edgeTypes,
          data_type: handle.dataType ?? null,
          data_field_key: handle.dataFieldKey ?? null,
        }))
      : getDefaultHandles(type);

  return canonicalizeNode({
    id: value.id,
    type,
    node_type: type,
    block_code: blockCode,
    display_name:
      stringValue(value.display_name) ??
      stringValue(value.displayName) ??
      'Новый блок',
    description: stringValue(value.description),
    module_code:
      stringValue(value.module_code) ?? stringValue(value.moduleCode),
    trigger_kind:
      stringValue(value.trigger_kind) ?? stringValue(value.triggerKind),
    module_version:
      stringValue(value.module_version) ?? stringValue(value.moduleVersion),
    module_schema_hash:
      stringValue(value.module_schema_hash) ??
      stringValue(value.moduleSchemaHash),
    dynamic_outputs_status:
      value.dynamic_outputs_status === 'static' ||
      value.dynamic_outputs_status === 'resolved' ||
      value.dynamic_outputs_status === 'stale' ||
      value.dynamic_outputs_status === 'unresolved'
        ? value.dynamic_outputs_status
        : block
          ? 'static'
          : 'unresolved',
    handles: handlesWithDataPorts(handles, inputs, outputs),
    inputs,
    outputs,
    bindings: isRecord(value.bindings) ? value.bindings : {},
    input_bindings: Array.isArray(value.input_bindings)
      ? value.input_bindings
          .map((binding) => normalizeBinding(binding))
          .filter((binding): binding is StepInputBinding => binding !== null)
      : [],
    config: isRecord(value.config) ? value.config : {},
    policy: isRecord(value.policy) ? value.policy : {},
    policies: isRecord(value.policies)
      ? value.policies
      : isRecord(value.policy)
        ? value.policy
        : {},
    runtime_mapping: isRecord(value.runtime_mapping)
      ? value.runtime_mapping
      : {},
    layout: isRecord(value.layout)
      ? {
          x: numberValue(value.layout.x) ?? 160,
          y: numberValue(value.layout.y) ?? 160,
          width: numberValue(value.layout.width) ?? 288,
          height: numberValue(value.layout.height) ?? 104,
        }
      : { x: 160, y: 160, width: 288, height: 104 },
    test_state: isRecord(value.test_state)
      ? (value.test_state as unknown as WorkflowNode['test_state'])
      : { sample_data_status: 'missing' },
    disabled: typeof value.disabled === 'boolean' ? value.disabled : undefined,
  });
}

function parseInsertRequest(value: unknown): CanvasInsertRequest {
  if (!isRecord(value)) {
    return { position: 'workflow_end' };
  }
  const mode =
    stringValue(value.mode) ??
    stringValue(value.position) ??
    stringValue(value.insert_position);
  return {
    position: normalizeInsertPosition(mode),
    source_node_id:
      stringValue(value.source_node_id) ?? stringValue(value.sourceNodeId),
    target_node_id:
      stringValue(value.target_node_id) ?? stringValue(value.targetNodeId),
    source_handle: (stringValue(value.source_handle) ??
      stringValue(value.sourceHandle)) as CanvasInsertRequest['source_handle'],
    target_handle: (stringValue(value.target_handle) ??
      stringValue(value.targetHandle)) as CanvasInsertRequest['target_handle'],
  };
}

function normalizeInsertPosition(
  value: string | null,
): CanvasInsertRequest['position'] {
  switch (value) {
    case 'workflow_start':
    case 'after_node':
    case 'before_node':
    case 'branch_true':
    case 'branch_false':
    case 'router_branch':
    case 'loop_body':
    case 'approval_after':
    case 'error_handler':
    case 'workflow_end':
      return value;
    default:
      return 'workflow_end';
  }
}

function isBlockingAvailability(status: ModuleAvailabilityStatus) {
  return [
    'blocked_by_role',
    'blocked_by_plan',
    'blocked_by_data_policy',
    'blocked_by_runtime',
    'deprecated',
    'retired',
    'incompatible_with_canvas_context',
  ].includes(status);
}

function buildDynamicActivepiecesBlock(
  genericBlock: CanvasBlockDefinition,
  card: CanvasModuleCard,
): CanvasBlockDefinition {
  const mapping = card.technical?.runtime_mapping ?? {};
  const nodeType = card.insertion.default_node_type;
  const kind = nodeType === 'trigger' ? 'trigger' : 'legal_action';
  const category = nodeType === 'trigger' ? 'start_trigger' : 'legal_action';

  return {
    ...genericBlock,
    kind,
    nodeType,
    category,
    displayName: card.display_name,
    shortDescription: card.short_description,
    longDescription: card.long_description ?? undefined,
    moduleCode: card.module_code,
    enabled: true,
    disabledReason: null,
    policies: {
      ...genericBlock.policies,
      riskLevel: card.risk_level,
      dataClassification: canvasDataClassification(card.data_classification),
      requiresApproval: card.flags.requires_approval,
      isExternalAction: card.flags.external_action,
      canUseAi: card.flags.uses_ai,
      canUseDocuments: card.flags.requires_documents,
      canRunInDryRun: card.flags.supports_dry_run,
      canBePublishedAsTemplate: false,
      requiredPermissions: [],
    },
    runtime: {
      provider: 'activepieces',
      activepiecesPiece:
        mapping.activepieces_piece ??
        card.runtime.required_pieces[0]?.piece_name ??
        undefined,
      activepiecesAction:
        mapping.activepieces_action ??
        card.runtime.required_pieces[0]?.action ??
        undefined,
      supportsStepTest:
        mapping.supports_step_test ?? card.flags.supports_dry_run,
      supportsPartialExecution: mapping.supports_partial_execution ?? false,
      supportsPinnedData: mapping.supports_pinned_data ?? false,
      notes: mapping.warnings ?? [],
    },
    uiSchema: {
      ...genericBlock.uiSchema,
      paletteCategory: card.category_label,
      icon: card.icon,
      card: {
        needs: card.input_summary.map((item) => item.label),
        creates: card.output_summary.map((item) => item.label),
        badges: [
          card.source_label ?? 'Activepieces',
          card.availability.status,
          card.risk_level,
        ],
      },
      hints: [
        card.availability.human_reason ?? '',
        card.long_description ?? '',
      ].filter(Boolean),
    },
  };
}

function withDynamicActivepiecesNode(
  node: WorkflowNode,
  card: CanvasModuleCard,
): WorkflowNode {
  const mapping = card.technical?.runtime_mapping ?? {};
  const runtimeMapping = {
    ...node.runtime_mapping,
    module_code: card.module_code,
    provider: 'activepieces' as const,
    activepieces_piece:
      mapping.activepieces_piece ??
      card.runtime.required_pieces[0]?.piece_name ??
      null,
    activepieces_action:
      mapping.activepieces_action ??
      card.runtime.required_pieces[0]?.action ??
      null,
    internal_route: null,
    can_compile:
      mapping.can_compile ?? !isBlockingAvailability(card.availability.status),
    supports_step_test:
      mapping.supports_step_test ?? card.flags.supports_dry_run,
    supports_partial_execution: mapping.supports_partial_execution ?? false,
    supports_pinned_data: mapping.supports_pinned_data ?? false,
    warnings: [
      ...(mapping.warnings ?? []),
      card.availability.human_reason ?? '',
    ].filter(Boolean),
  };

  return canonicalizeNode({
    ...node,
    display_name: card.display_name,
    description: card.short_description,
    module_code: card.module_code,
    module_version: card.module_version,
    module_ref: {
      module_code: card.module_code,
      module_version: card.module_version,
      status:
        card.availability.status === 'deprecated' ||
        card.availability.status === 'retired'
          ? card.availability.status
          : 'draft',
    },
    policy: {
      ...node.policy,
      approval_required: card.flags.requires_approval,
      external_action: card.flags.external_action,
      ai_action: card.flags.uses_ai,
      data_classification: card.data_classification,
      risk_level: card.risk_level,
      can_use_documents: card.flags.requires_documents,
      can_run_in_dry_run: card.flags.supports_dry_run,
      can_be_published_as_template: false,
      required_permissions: [],
    },
    runtime_mapping: runtimeMapping,
    lifecycle: {
      status:
        card.availability.status === 'missing_connection'
          ? 'needs_input'
          : 'draft',
    },
    disabled: isBlockingAvailability(card.availability.status),
  });
}

function canvasDataClassification(
  value: CanvasModuleCard['data_classification'],
): CanvasBlockDefinition['policies']['dataClassification'] {
  switch (value) {
    case 'public':
    case 'workspace_internal':
    case 'confidential':
    case 'personal_data':
    case 'legal_secret':
    case 'client_material':
    case 'secret':
    case 'runtime_only':
    case 'internal':
      return value;
    default:
      return 'internal';
  }
}

function normalizeDataFields(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((field) => normalizeDataField(field))
    .filter((field): field is WorkflowDataField => field !== null);
}

function upsertByKey<T extends { readonly key: string }>(
  items: readonly T[],
  item: T,
) {
  const existing = items.some((candidate) => candidate.key === item.key);
  if (!existing) {
    return [...items, item];
  }
  return items.map((candidate) =>
    candidate.key === item.key ? item : candidate,
  );
}

function bindingTargetExists(
  workflow: LexFrameWorkflowV2,
  binding: StepInputBinding,
) {
  const nodeId = bindingTargetNodeId(binding);
  const inputKey = bindingTargetInputKey(binding);
  if (!nodeId || !inputKey) {
    return false;
  }
  const targetNode = workflow.nodes.find((node) => node.id === nodeId);
  return targetNode?.inputs.some((input) => input.key === inputKey) === true;
}

function upsertNodeBinding(node: WorkflowNode, binding: StepInputBinding) {
  const nodeId = bindingTargetNodeId(binding);
  const inputKey = bindingTargetInputKey(binding);
  if (node.id !== nodeId || !inputKey) {
    return node;
  }
  const nextBinding: StepInputBinding = {
    ...binding,
    id: binding.id ?? stableBindingId(node.id, inputKey, binding.source),
    target: {
      node_id: node.id,
      input_key: inputKey,
    },
    targetNodeId: node.id,
    targetInputKey: inputKey,
  };
  const bindings = node.input_bindings ?? [];
  const replaced = bindings.some(
    (candidate) =>
      bindingId(candidate) === bindingId(nextBinding) ||
      bindingTargetInputKey(candidate) === inputKey,
  );
  return {
    ...node,
    input_bindings: replaced
      ? bindings.map((candidate) =>
          bindingId(candidate) === bindingId(nextBinding) ||
          bindingTargetInputKey(candidate) === inputKey
            ? nextBinding
            : candidate,
        )
      : [...bindings, nextBinding],
  };
}

function removeNodeBinding(
  node: WorkflowNode,
  input: {
    readonly nodeId: string | null;
    readonly inputKey: string | null;
    readonly id: string | null;
  },
) {
  if (input.nodeId && node.id !== input.nodeId) {
    return node;
  }
  const bindings = node.input_bindings ?? [];
  return {
    ...node,
    input_bindings: bindings.filter((binding) => {
      if (input.id && bindingId(binding) === input.id) {
        return false;
      }
      if (input.inputKey && bindingTargetInputKey(binding) === input.inputKey) {
        return false;
      }
      return true;
    }),
  };
}

function redactOperationPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactOperationPayload);
  }
  if (!isRecord(value)) {
    return value;
  }
  const redacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (
      [
        'value',
        'secret_ref',
        'secretRef',
        'preview_payload',
        'redacted_payload',
        'raw_payload',
        'signed_url',
        'signedUrl',
        'document_text',
        'documentText',
      ].includes(key)
    ) {
      redacted[key] = '[redacted]';
      continue;
    }
    redacted[key] = redactOperationPayload(child);
  }
  return redacted;
}

function normalizeWorkflowEdge(value: unknown): WorkflowEdge | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.source_node_id !== 'string' ||
    typeof value.target_node_id !== 'string'
  ) {
    return null;
  }

  const edgeType = stringValue(value.edge_type) ?? stringValue(value.type);

  return canonicalizeEdge({
    id: value.id,
    type: [
      'control',
      'data',
      'invalid',
      'error',
      'approval',
      'loop',
      'annotation',
      'control_flow',
      'data_flow',
      'approval_flow',
      'error_flow',
      'loop_flow',
      'annotation_link',
    ].includes(String(edgeType))
      ? (edgeType as WorkflowEdge['type'])
      : 'control',
    source_node_id: value.source_node_id,
    source_handle:
      (stringValue(value.source_handle) as WorkflowEdge['source_handle']) ??
      (stringValue(value.source_port_id) as WorkflowEdge['source_handle']) ??
      'main_output',
    source_port_id:
      (stringValue(value.source_port_id) as WorkflowEdge['source_port_id']) ??
      (stringValue(value.source_handle) as WorkflowEdge['source_port_id']) ??
      'main_output',
    target_node_id: value.target_node_id,
    target_handle:
      (stringValue(value.target_handle) as WorkflowEdge['target_handle']) ??
      (stringValue(value.target_port_id) as WorkflowEdge['target_handle']) ??
      'main_input',
    target_port_id:
      (stringValue(value.target_port_id) as WorkflowEdge['target_port_id']) ??
      (stringValue(value.target_handle) as WorkflowEdge['target_port_id']) ??
      'main_input',
    label: stringValue(value.label),
    condition: isRecord(value.condition)
      ? (value.condition as WorkflowEdge['condition'])
      : stringValue(value.condition),
    invalid_reason: stringValue(value.invalid_reason),
    data_mapping: Array.isArray(value.data_mapping)
      ? (value.data_mapping as WorkflowEdge['data_mapping'])
      : undefined,
    data_mappings: Array.isArray(value.data_mappings)
      ? (value.data_mappings as WorkflowEdge['data_mappings'])
      : undefined,
    validation_state:
      value.validation_state === 'valid' ||
      value.validation_state === 'warning' ||
      value.validation_state === 'invalid'
        ? value.validation_state
        : undefined,
  });
}

function validateNewEdge(
  workflow: LexFrameWorkflowV2,
  edge: WorkflowEdge,
): CanvasOperationRejectReason | null {
  const source = workflow.nodes.find((node) => node.id === edge.source_node_id);
  const target = workflow.nodes.find((node) => node.id === edge.target_node_id);
  if (!source || !target || source.id === target.id) {
    return 'INVALID_CONNECTION';
  }
  if (
    !source.handles.some(
      (handle) =>
        handleMatches(handle.code, edge.source_handle) &&
        handle.direction === 'output',
    ) ||
    !target.handles.some(
      (handle) =>
        handleMatches(handle.code, edge.target_handle) &&
        handle.direction === 'input',
    )
  ) {
    return 'INVALID_CONNECTION';
  }
  if (createsCycle(workflow, edge)) {
    return 'INVALID_CONNECTION';
  }
  const sourceBlock = findCanvasBlockDefinition(
    source.block_code ?? source.module_code ?? source.trigger_kind ?? source.id,
  );
  const targetBlock = findCanvasBlockDefinition(
    target.block_code ?? target.module_code ?? target.trigger_kind ?? target.id,
  );
  if (sourceBlock && targetBlock) {
    const result = validateCanvasConnection({
      sourceBlock,
      sourceHandle: toDslHandleCode(edge.source_handle) as DslCanvasHandleCode,
      targetBlock,
      targetHandle: toDslHandleCode(edge.target_handle) as DslCanvasHandleCode,
      edgeType: toDslEdgeType(edge.edge_type ?? edge.type),
      hasApprovalPath: hasApprovalBefore(workflow, target.id),
    });
    if (!result.allowed) {
      return 'INVALID_CONNECTION';
    }
  }
  return null;
}

function handleMatches(left: string, right: string) {
  return left === right || toDslHandleCode(left) === toDslHandleCode(right);
}

function toDslHandleCode(code: string) {
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

function toDslEdgeType(type: WorkflowEdge['type']): CanvasEdgeType {
  switch (type) {
    case 'data':
      return 'data_flow';
    case 'approval':
      return 'approval_flow';
    case 'error':
      return 'error_flow';
    case 'loop':
      return 'loop_flow';
    case 'annotation':
      return 'annotation_link';
    case 'data_flow':
    case 'approval_flow':
    case 'error_flow':
    case 'loop_flow':
    case 'annotation_link':
    case 'invalid':
      return type;
    default:
      return 'control_flow';
  }
}

function hasApprovalBefore(workflow: LexFrameWorkflowV2, targetNodeId: string) {
  const reverseEdges = new Map<string, readonly string[]>();
  for (const edge of workflow.edges) {
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

function deliveryWouldLoseApproval(
  workflow: LexFrameWorkflowV2,
  approvalNodeId: string,
) {
  const remainingWorkflow: LexFrameWorkflowV2 = {
    ...workflow,
    nodes: workflow.nodes.filter((node) => node.id !== approvalNodeId),
    edges: workflow.edges.filter(
      (edge) =>
        edge.source_node_id !== approvalNodeId &&
        edge.target_node_id !== approvalNodeId,
    ),
  };
  return remainingWorkflow.nodes.some(
    (node) =>
      node.type === 'delivery' &&
      !hasApprovalBefore(remainingWorkflow, node.id),
  );
}

function createsCycle(workflow: LexFrameWorkflowV2, edge: WorkflowEdge) {
  const adjacency = new Map<string, string[]>();
  for (const item of [...workflow.edges, edge]) {
    adjacency.set(item.source_node_id, [
      ...(adjacency.get(item.source_node_id) ?? []),
      item.target_node_id,
    ]);
  }

  const visited = new Set<string>();
  const stack = new Set<string>();

  function visit(nodeId: string): boolean {
    if (stack.has(nodeId)) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }
    visited.add(nodeId);
    stack.add(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      if (visit(next)) {
        return true;
      }
    }
    stack.delete(nodeId);
    return false;
  }

  return workflow.nodes.some((node) => visit(node.id));
}

function inverseOperation(
  source: CanvasOperation,
  operationType: CanvasOperation['operation_type'],
  payload: Record<string, unknown>,
): CanvasOperation {
  return {
    client_operation_id: `${source.client_operation_id}:inverse:${operationType}`,
    operation_type: operationType,
    operation_payload: payload,
  };
}

function auditActionForOperation(
  operationType: CanvasOperation['operation_type'],
) {
  if (operationType.includes('NODE')) {
    if (operationType.startsWith('ADD')) {
      return 'canvas.node.added';
    }
    if (operationType.startsWith('DELETE')) {
      return 'canvas.node.deleted';
    }
    return 'canvas.node.updated';
  }
  if (operationType.includes('EDGE')) {
    return operationType.startsWith('DELETE')
      ? 'canvas.edge.deleted'
      : 'canvas.edge.added';
  }
  return 'canvas.draft.saved';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validationDelta<TIssue extends { readonly id: string }>(
  before: readonly TIssue[],
  after: readonly TIssue[],
) {
  const beforeIds = new Set(before.map((issue) => issue.id));
  const afterIds = new Set(after.map((issue) => issue.id));
  return {
    resolved_issues: before.filter((issue) => !afterIds.has(issue.id)),
    new_issues: after.filter((issue) => !beforeIds.has(issue.id)),
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
