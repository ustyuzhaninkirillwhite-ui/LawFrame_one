import type {
  CanvasValidationResult,
  CompileIssue,
  CompileReport,
  CompileRequest,
  CompileResponse,
  CompileStatus,
  CompileWarning,
  CanvasReadModel,
  CanvasValidationSummary,
  LexFrameWorkflowV2,
  RuntimeGraph,
  RuntimeBindingDto,
  RuntimeDriftResponse,
  RuntimeImportApplyRequest,
  RuntimeImportApplyResponse,
  RuntimeImportPreviewRequest,
  RuntimeImportPreviewResponse,
  RuntimeImportRejectRequest,
  RuntimeImportRejectResponse,
  RuntimeOverwriteRequest,
  RuntimeOverwriteResponse,
  RuntimePullRequest,
  RuntimePullResponse,
  RuntimeSnapshotResponse,
  RuntimeSyncStatusResponse,
  RuntimeSyncRequest,
  PermissionCode,
  WorkflowDiffItem,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { CanvasValidationService } from '../canvas/canvas-validation.service';
import { canonicalizeWorkflowV2 } from '../canvas/canvas-canonical';
import { DatabaseService } from '../database/database.service';
import { ActivepiecesFlowParser } from './activepieces-flow-parser.service';
import { ActivepiecesOperationsBuilder } from './activepieces-operations-builder.service';
import { ActivepiecesProjectionBuilder } from './activepieces-projection-builder.service';
import { ActivepiecesReverseMapperService } from './activepieces-reverse-mapper.service';
import { ActivepiecesSyncService } from './activepieces-sync.service';
import { CompileReportService } from './compile-report.service';
import { ConnectionRequirementResolver } from './connection-requirement-resolver.service';
import { RuntimeBindingService } from './runtime-binding.service';
import { RuntimeDiffService } from './runtime-diff.service';
import { RuntimeIRBuilder } from './runtime-ir-builder.service';
import { RuntimeSnapshotService } from './runtime-snapshot.service';
import { normalizeCompileSourceWorkflowV2 } from './workflow-source-normalizer';
import { WorkflowGraphValidator } from './workflow-graph-validator.service';
import { WorkflowNormalizerService } from './workflow-normalizer.service';
import { WorkflowPolicyValidator } from './workflow-policy-validator.service';
import { WorkflowSemanticDiffService } from './workflow-semantic-diff.service';
import {
  TARGET_RUNTIME,
  WORKFLOW_COMPILER_VERSION,
  type ActivepiecesFlowProjection,
  type ActivepiecesOperation,
  type CanvasDraftCompilerRow,
  type CompileArtifact,
  type InstalledAutomationCompilerRow,
  type RequestMeta,
  type RuntimeBindingRow,
} from './workflow-compiler.types';

@Injectable()
export class WorkflowCompilerService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly validationService: CanvasValidationService,
    private readonly normalizer: WorkflowNormalizerService,
    private readonly graphValidator: WorkflowGraphValidator,
    private readonly policyValidator: WorkflowPolicyValidator,
    private readonly connectionResolver: ConnectionRequirementResolver,
    private readonly runtimeIrBuilder: RuntimeIRBuilder,
    private readonly projectionBuilder: ActivepiecesProjectionBuilder,
    private readonly operationsBuilder: ActivepiecesOperationsBuilder,
    private readonly reportService: CompileReportService,
    private readonly syncService: ActivepiecesSyncService,
    private readonly bindingService: RuntimeBindingService,
    private readonly snapshotService: RuntimeSnapshotService,
    private readonly diffService: RuntimeDiffService,
    private readonly flowParser: ActivepiecesFlowParser,
    private readonly reverseMapper: ActivepiecesReverseMapperService,
    private readonly semanticDiff: WorkflowSemanticDiffService,
  ) {}

  async compilePreview(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    request: CompileRequest = {},
    meta: RequestMeta = { requestId: null, traceId: null },
  ): Promise<CompileResponse> {
    this.assertPermission(access, 'canvas.view_compile_preview');
    const artifact = await this.compileInternal({
      actor,
      access,
      automationId,
      mode: request.mode ?? 'preview',
      includeAdvancedReport: request.options?.include_advanced_report ?? true,
      meta,
    });
    return this.toCompileResponse(artifact);
  }

  async compile(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    request: CompileRequest = {},
    meta: RequestMeta = { requestId: null, traceId: null },
  ): Promise<CompileResponse> {
    this.assertPermission(access, 'canvas.compile');
    const artifact = await this.compileInternal({
      actor,
      access,
      automationId,
      mode: request.mode ?? 'dry_run_compile',
      includeAdvancedReport: request.options?.include_advanced_report ?? true,
      meta,
    });
    return this.toCompileResponse(artifact);
  }

  async syncRuntime(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    input: RuntimeSyncRequest,
    meta: RequestMeta = { requestId: null, traceId: null },
  ): Promise<CompileResponse> {
    this.assertSyncPermission(access);
    if (!input.compile_report_id) {
      throw new AppHttpException(
        'WORKFLOW_COMPILE_REPORT_NOT_FOUND',
        400,
        'compile_report_id is required for runtime sync.',
      );
    }

    const workspaceId = requireWorkspaceId(access);
    const idempotent = await this.bindingService.findCompletedSyncEvent({
      workspaceId,
      automationId,
      idempotencyKey: input.idempotency_key,
    });
    if (idempotent) {
      const idempotentReport = await this.reportService.getReport(
        workspaceId,
        automationId,
        input.compile_report_id,
      );
      const idempotentBinding = await this.bindingService.getBinding(
        workspaceId,
        automationId,
      );
      if (
        idempotentBinding?.external_project_id &&
        idempotentBinding.external_flow_id
      ) {
        try {
          const readBack =
            await this.snapshotService.pullActivepiecesFlowSnapshot({
              projectId: idempotentBinding.external_project_id,
              flowId: idempotentBinding.external_flow_id,
            });
          const flowVersionId =
            readBack.flowVersionId ??
            idempotentBinding.activepieces_flow_version_id ??
            null;
          if (flowVersionId) {
            return this.responseFromReport(idempotentReport, {
              status: 'runtime_synced',
              runtimeHash:
                readBack.snapshotHash ?? idempotent.after_runtime_hash,
              binding: idempotentBinding,
              projectId: idempotentBinding.external_project_id,
              flowId: idempotentBinding.external_flow_id,
              flowVersionId,
            });
          }
        } catch (error) {
          await this.bindingService.recordSyncEvent({
            workspaceId,
            automationId,
            runtimeBindingId: idempotentBinding.id,
            eventType: 'runtime_sync',
            status: 'failed',
            compileReportId: idempotentReport.id,
            sourceWorkflowHash: idempotentReport.source_workflow_hash,
            idempotencyKey: input.idempotency_key ?? null,
            actorId: actor.id,
            traceId: meta.traceId,
            errorCode: 'activepieces_idempotency_readback_failed',
            errorMessage:
              error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const { draft, automation, sourceHash } = await this.loadCompileSource(
      actor,
      access,
      automationId,
    );
    const report = await this.reportService.getReport(
      workspaceId,
      automationId,
      input.compile_report_id,
    );

    if (report.source_workflow_hash !== sourceHash) {
      throw new AppHttpException(
        'WORKFLOW_COMPILE_REPORT_STALE',
        409,
        'Compile report source hash does not match the current Canvas workflow.',
        {
          reportHash: report.source_workflow_hash,
          currentHash: sourceHash,
        },
      );
    }
    if (report.blocking_issues.length > 0) {
      throw new AppHttpException(
        'WORKFLOW_COMPILER_BLOCKED',
        409,
        'Runtime sync is blocked by compile report issues.',
        {
          blockingIssues: report.blocking_issues,
        },
      );
    }

    const missingConnections = report.required_connections.filter(
      (connection) => connection.required && connection.status !== 'available',
    );
    if (missingConnections.length > 0) {
      throw new AppHttpException(
        'WORKFLOW_COMPILER_BLOCKED',
        409,
        'Runtime sync is blocked by missing connections.',
        { missingConnections },
      );
    }

    await this.bindingService.recordSyncEvent({
      workspaceId,
      automationId,
      eventType: 'runtime_sync',
      status: 'requested',
      compileReportId: report.id,
      sourceWorkflowHash: sourceHash,
      idempotencyKey: input.idempotency_key ?? null,
      actorId: actor.id,
      traceId: meta.traceId,
    });

    const existingBinding = await this.bindingService.getBinding(
      workspaceId,
      automationId,
    );
    const projection =
      report.activepieces_projection as ActivepiecesFlowProjection;
    try {
      const project = await this.syncService.ensureProjectBinding({
        workspaceId,
        actor,
        displayName: `${automation.title} runtime`,
      });
      const activepiecesProjectId =
        project.activepieces_project_id ?? project.external_project_id;
      const flow = await this.syncService.ensureFlow({
        projectId: activepiecesProjectId,
        workspaceId,
        automationId,
        displayName: automation.title,
        existingFlowId:
          existingBinding?.external_flow_id ?? automation.runtime_flow_id,
      });

      const beforeSnapshot =
        existingBinding?.external_project_id &&
        existingBinding.external_flow_id &&
        isActivepiecesRuntimeId(existingBinding.external_flow_id)
          ? await this.snapshotService.pullActivepiecesFlowSnapshot({
              projectId: existingBinding.external_project_id,
              flowId: existingBinding.external_flow_id,
            })
          : null;
      const drift = this.diffService.detect({
        binding: existingBinding,
        currentRuntimeHash: beforeSnapshot?.snapshotHash ?? null,
        currentSourceWorkflowHash: sourceHash,
        snapshot: beforeSnapshot?.normalizedSnapshot ?? null,
      });
      if (
        drift.status !== 'synced' &&
        drift.status !== 'importable' &&
        input.overwrite_runtime_changes !== true
      ) {
        await this.bindingService.recordSyncEvent({
          workspaceId,
          automationId,
          runtimeBindingId: existingBinding?.id ?? null,
          eventType: 'runtime_sync',
          status: 'blocked',
          compileReportId: report.id,
          beforeRuntimeHash: beforeSnapshot?.snapshotHash ?? null,
          sourceWorkflowHash: sourceHash,
          idempotencyKey: input.idempotency_key ?? null,
          errorCode: 'runtime_conflict',
          errorMessage: 'Runtime drift must be reviewed before overwrite.',
          actorId: actor.id,
          traceId: meta.traceId,
        });
        return this.responseFromReport(report, {
          status: 'runtime_conflict',
          runtimeHash: beforeSnapshot?.snapshotHash ?? null,
          binding: existingBinding,
          extraIssues: drift.issues,
        });
      }

      const operationResult = await this.syncService.applyOperations({
        projectId: activepiecesProjectId,
        flowId: flow.flowId,
        operations:
          report.generated_operations as readonly ActivepiecesOperation[],
        publishAfterSync: input.publish_after_sync === true,
      });
      const afterSnapshot =
        await this.snapshotService.pullActivepiecesFlowSnapshot({
          projectId: activepiecesProjectId,
          flowId: flow.flowId,
        });
      const flowVersionId =
        afterSnapshot.flowVersionId ??
        operationResult.flowVersionId ??
        flow.flowVersionId ??
        null;
      if (!flowVersionId) {
        throw new Error(
          `Activepieces flow ${flow.flowId} did not return a readable flow version after sync.`,
        );
      }
      const projectionHash = hashFromReport(report);
      const runtimeProjectionId = report.automation_version_id
        ? await this.findRuntimeProjectionId(
            workspaceId,
            automationId,
            report.automation_version_id,
            projectionHash,
          )
        : null;
      const binding = await this.bindingService.persistSyncSuccess({
        workspaceId,
        automationId,
        sourceTemplateVersionId: draft.source_template_version_id,
        automationVersionId: report.automation_version_id ?? null,
        runtimeProjectionId,
        projectId: activepiecesProjectId,
        flowId: flow.flowId,
        flowVersionId,
        sourceWorkflowHash: sourceHash,
        runtimeHash: afterSnapshot.snapshotHash,
        compileReportId: report.id,
        projectionHash,
        projection,
        snapshot: afterSnapshot.snapshot,
        normalizedSnapshot: afterSnapshot.normalizedSnapshot,
        stepMappings: buildStepMappingsFromReport(report),
        actorId: actor.id,
        idempotencyKey: input.idempotency_key ?? null,
        traceId: meta.traceId,
      });

      await this.audit(
        'workflow.runtime_sync.completed',
        actor,
        access,
        automationId,
        meta,
        {
          reportId: report.id,
          sourceWorkflowHash: sourceHash,
          runtimeHash: afterSnapshot.snapshotHash,
          runtimeProjectId: activepiecesProjectId,
          runtimeFlowId: flow.flowId,
          runtimeFlowVersionId: flowVersionId,
        },
      );

      return this.responseFromReport(report, {
        status: 'runtime_synced',
        runtimeHash: afterSnapshot.snapshotHash,
        binding,
        projectId: activepiecesProjectId,
        flowId: flow.flowId,
        flowVersionId,
      });
    } catch (error) {
      await this.bindingService.recordSyncEvent({
        workspaceId,
        automationId,
        runtimeBindingId: existingBinding?.id ?? null,
        eventType: 'runtime_sync',
        status: 'failed',
        compileReportId: report.id,
        sourceWorkflowHash: sourceHash,
        idempotencyKey: input.idempotency_key ?? null,
        errorCode: 'activepieces_sync_failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        actorId: actor.id,
        traceId: meta.traceId,
      });
      throw new AppHttpException(
        'ACTIVEPIECES_SYNC_FAILED',
        502,
        'Activepieces runtime sync failed. No LexFrame sync success is recorded without a verified Activepieces project, flow and flow version.',
        {
          reason: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  async getRuntimeBinding(
    access: AccessContext,
    automationId: string,
  ): Promise<RuntimeBindingDto | null> {
    const binding = await this.bindingService.getBinding(
      requireWorkspaceId(access),
      automationId,
    );
    return this.bindingService.toDto(binding);
  }

  async listCompileReports(
    access: AccessContext,
    automationId: string,
  ): Promise<readonly CompileReport[]> {
    return this.reportService.listReports(
      requireWorkspaceId(access),
      automationId,
    );
  }

  async getCompileReport(
    access: AccessContext,
    automationId: string,
    reportId: string,
  ): Promise<CompileReport> {
    return this.reportService.getReport(
      requireWorkspaceId(access),
      automationId,
      reportId,
    );
  }

  async checkDrift(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    meta: RequestMeta = { requestId: null, traceId: null },
  ): Promise<RuntimeDriftResponse> {
    const workspaceId = requireWorkspaceId(access);
    const { sourceHash } = await this.loadCompileSource(
      actor,
      access,
      automationId,
    );
    const binding = await this.bindingService.getBinding(
      workspaceId,
      automationId,
    );
    const snapshot = binding?.external_flow_id
      ? await this.snapshotService.pullActivepiecesFlowSnapshot({
          projectId: requireRuntimeProjectId(binding),
          flowId: binding.external_flow_id,
        })
      : null;
    const drift = this.diffService.detect({
      binding,
      currentRuntimeHash: snapshot?.snapshotHash ?? null,
      currentSourceWorkflowHash: sourceHash,
      snapshot: snapshot?.normalizedSnapshot ?? null,
    });

    await this.audit(
      'workflow.runtime_drift.checked',
      actor,
      access,
      automationId,
      meta,
      {
        status: drift.status,
        runtimeHash: snapshot?.snapshotHash ?? null,
      },
    );

    return {
      status: drift.status,
      runtime_binding: this.bindingService.toDto(binding),
      current_runtime_hash: snapshot?.snapshotHash ?? null,
      last_synced_hash: binding?.last_synced_hash ?? null,
      issues: drift.issues,
    };
  }

  async pullSnapshot(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
  ): Promise<RuntimeSnapshotResponse> {
    const workspaceId = requireWorkspaceId(access);
    const binding = await this.bindingService.getBinding(
      workspaceId,
      automationId,
    );
    if (!binding?.external_flow_id) {
      return {
        runtime_binding: this.bindingService.toDto(binding),
        snapshot_hash: null,
        snapshot: null,
      };
    }

    const snapshot = await this.snapshotService.pullActivepiecesFlowSnapshot({
      projectId: requireRuntimeProjectId(binding),
      flowId: binding.external_flow_id,
    });
    await this.bindingService.saveManualSnapshot({
      workspaceId,
      binding,
      flowVersionId: snapshot.flowVersionId,
      snapshot: snapshot.snapshot,
      normalizedSnapshot: snapshot.normalizedSnapshot,
      snapshotHash: snapshot.snapshotHash,
      actorId: actor.id,
    });
    const refreshed = await this.bindingService.getBinding(
      workspaceId,
      automationId,
    );

    return {
      runtime_binding: this.bindingService.toDto(refreshed ?? binding),
      snapshot_hash: snapshot.snapshotHash,
      snapshot: snapshot.normalizedSnapshot,
    };
  }

  async getRuntimeSyncStatus(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    meta: RequestMeta = { requestId: null, traceId: null },
  ): Promise<RuntimeSyncStatusResponse> {
    this.assertRuntimePermission(access, 'canvas.runtime.view');
    const workspaceId = requireWorkspaceId(access);
    const { sourceHash } = await this.loadCompileSource(
      actor,
      access,
      automationId,
    );
    const binding = await this.bindingService.getBinding(
      workspaceId,
      automationId,
    );
    const status = runtimeStatusFromBinding(binding, sourceHash);

    await this.audit(
      'workflow.runtime_sync_status.viewed',
      actor,
      access,
      automationId,
      meta,
      {
        status: status.syncStatus,
        runtimeHash: binding?.runtime_hash ?? null,
        sourceWorkflowHash: sourceHash,
      },
    );

    return {
      automation_id: automationId,
      runtime_binding_id: binding?.id ?? null,
      activepieces_project_id: binding?.external_project_id ?? null,
      activepieces_flow_id: binding?.external_flow_id ?? null,
      sync_status: status.syncStatus,
      last_synced_at: binding?.last_synced_at ?? null,
      last_synced_snapshot_hash: binding?.last_synced_hash ?? null,
      current_runtime_snapshot_hash: binding?.runtime_hash ?? null,
      canonical_workflow_hash: sourceHash,
      runtime_changed: status.runtimeChanged,
      canonical_changed: status.canonicalChanged,
      can_import:
        status.runtimeChanged &&
        this.hasRuntimePermission(access, 'canvas.runtime.import_preview'),
      can_overwrite_runtime: this.hasRuntimePermission(
        access,
        'canvas.runtime.overwrite',
      ),
      warnings: status.warnings,
    };
  }

  async pullRuntime(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    request: RuntimePullRequest = {},
    meta: RequestMeta = { requestId: null, traceId: null },
  ): Promise<RuntimePullResponse> {
    this.assertRuntimePermission(access, 'canvas.runtime.pull');
    const workspaceId = requireWorkspaceId(access);
    const { sourceHash } = await this.loadCompileSource(
      actor,
      access,
      automationId,
    );
    const binding = await this.bindingService.getBinding(
      workspaceId,
      automationId,
    );
    if (!binding?.external_flow_id) {
      await this.audit(
        'workflow.runtime_pull.unavailable',
        actor,
        access,
        automationId,
        meta,
        {
          status: 'runtime_unavailable',
        },
      );
      return {
        status: 'runtime_unavailable',
        snapshot_id: null,
        snapshot_hash: null,
        changed_since_last_sync: false,
        runtime_changed: false,
        canonical_changed: Boolean(sourceHash),
        issues: [
          {
            code: 'RUNTIME_SYNC_FLOW_UNAVAILABLE',
            message: 'Activepieces flow is not bound to this automation.',
            severity: 'error',
          },
        ],
      };
    }

    const snapshot = await this.snapshotService.pullActivepiecesFlowSnapshot({
      projectId: requireRuntimeProjectId(binding),
      flowId: binding.external_flow_id,
    });
    const snapshotId = await this.bindingService.saveManualSnapshot({
      workspaceId,
      binding,
      flowVersionId: snapshot.flowVersionId,
      snapshot: snapshot.snapshot,
      normalizedSnapshot: snapshot.normalizedSnapshot,
      snapshotHash: snapshot.snapshotHash,
      actorId: actor.id,
      source: request.source ?? 'manual_pull',
    });
    const drift = this.diffService.detect({
      binding,
      currentRuntimeHash: snapshot.snapshotHash,
      currentSourceWorkflowHash: sourceHash,
      snapshot: snapshot.normalizedSnapshot,
    });
    const status = normalizeRuntimeDriftStatus(drift.status);
    await this.updateRuntimeBindingStatus({
      workspaceId,
      bindingId: binding.id,
      status,
      runtimeHash: snapshot.snapshotHash,
      sourceWorkflowHash: sourceHash,
      flowVersionId: snapshot.flowVersionId,
    });
    let conflictId: string | null = null;
    if (status === 'conflict') {
      conflictId = await this.createRuntimeConflict({
        workspaceId,
        automationId,
        bindingId: binding.id,
        snapshotId,
        conflictType: 'both_sides_changed',
        status: 'open',
        issues: drift.issues,
        actorId: actor.id,
      });
    }

    await this.audit(
      'workflow.runtime_pull.completed',
      actor,
      access,
      automationId,
      meta,
      {
        status,
        snapshotId,
        snapshotHash: snapshot.snapshotHash,
        source: request.source ?? 'manual_pull',
        issueCount: drift.issues.length,
        conflictId,
      },
    );

    const runtimeChanged = Boolean(
      binding.last_synced_hash &&
      snapshot.snapshotHash !== binding.last_synced_hash,
    );
    const canonicalChanged = Boolean(
      binding.source_workflow_hash &&
      sourceHash &&
      sourceHash !== binding.source_workflow_hash,
    );
    return {
      status,
      snapshot_id: snapshotId,
      snapshot_hash: snapshot.snapshotHash,
      changed_since_last_sync: runtimeChanged,
      runtime_changed: runtimeChanged,
      canonical_changed: canonicalChanged,
      issues: drift.issues,
    };
  }

  async previewRuntimeImport(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    request: RuntimeImportPreviewRequest,
    meta: RequestMeta = { requestId: null, traceId: null },
  ): Promise<RuntimeImportPreviewResponse> {
    this.assertRuntimePermission(access, 'canvas.runtime.import_preview');
    const workspaceId = requireWorkspaceId(access);
    if (!request.snapshot_id) {
      throw new AppHttpException(
        'RUNTIME_IMPORT_SNAPSHOT_REQUIRED',
        400,
        'snapshot_id is required for runtime import preview.',
      );
    }
    const [{ workflow, sourceHash, draft }, snapshot] = await Promise.all([
      this.loadCompileSource(actor, access, automationId),
      this.loadRuntimeSnapshot(workspaceId, automationId, request.snapshot_id),
    ]);
    const runtimeGraph = this.flowParser.parse({
      snapshot: snapshot.normalized_snapshot_json,
      flowId: snapshot.activepieces_flow_id,
      flowVersionId: snapshot.activepieces_flow_version_id,
      projectId: snapshot.external_project_id,
    });
    const reverse = this.reverseMapper.map({
      workflow,
      runtimeGraph,
      context: { permissions: access.permissions },
    });
    const validation = this.validationService.runtimeGateValidate(
      reverse.workflow,
    );
    const candidateWorkflow = this.withValidationState(
      reverse.workflow,
      validation,
    );
    const diff = this.semanticDiff.diff({
      before: workflow,
      after: candidateWorkflow,
      reverseMapping: reverse,
    });
    const importability = importabilityWithValidation(
      reverse.importability,
      validation,
      diff,
    );
    const canCreateCandidate =
      canCreateImportCandidate(importability) &&
      (importability !== 'requires_review' ||
        this.canResolveRuntimeReview(access));
    const previewIds = await this.persistImportPreview({
      workspaceId,
      automationId,
      actorId: actor.id,
      bindingId: snapshot.runtime_binding_id,
      snapshotId: snapshot.id,
      baseDraftId: draft.id,
      baseWorkflowHash: sourceHash,
      candidateWorkflow: canCreateCandidate ? candidateWorkflow : null,
      validation,
      importability,
      diff,
      runtimeGraph,
      status: canCreateCandidate ? 'preview_ready' : 'blocked_by_policy',
      issues: reverse.issues,
    });
    await this.updateRuntimeBindingStatus({
      workspaceId,
      bindingId: snapshot.runtime_binding_id,
      status: statusFromImportability(importability),
      runtimeHash: snapshot.snapshot_hash,
      sourceWorkflowHash: sourceHash,
      flowVersionId: snapshot.activepieces_flow_version_id,
    });

    await this.audit(
      'workflow.runtime_import.previewed',
      actor,
      access,
      automationId,
      meta,
      {
        importability,
        candidateId: previewIds.candidateId,
        diffId: previewIds.diffId,
        conflictId: previewIds.conflictId,
        diffCount: diff.length,
        policyBlocks: diff.filter((item) => item.severity === 'policy_block')
          .length,
      },
    );

    return {
      status: canCreateCandidate ? 'import_preview_ready' : 'import_blocked',
      importability,
      draft_candidate_id: previewIds.candidateId,
      import_diff_id: previewIds.diffId,
      conflict_id: previewIds.conflictId,
      runtime_graph: runtimeGraph,
      diff,
      validation,
      unknown_nodes: reverse.unknownNodes,
      requires_review: diff.filter(
        (item) =>
          item.severity === 'requires_review' || item.severity === 'conflict',
      ),
      policy_blocks: diff.filter((item) => item.severity === 'policy_block'),
    };
  }

  async applyRuntimeImport(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    request: RuntimeImportApplyRequest,
    meta: RequestMeta = { requestId: null, traceId: null },
  ): Promise<RuntimeImportApplyResponse> {
    this.assertRuntimePermission(access, 'canvas.runtime.import_apply');
    const workspaceId = requireWorkspaceId(access);
    const candidate = await this.loadImportCandidate(
      workspaceId,
      automationId,
      request.draft_candidate_id,
    );
    if (
      candidate.importability === 'requires_review' &&
      !this.canResolveRuntimeReview(access)
    ) {
      throw new AppHttpException(
        'RUNTIME_IMPORT_REVIEW_REQUIRED',
        403,
        'Runtime import candidate requires owner/admin review.',
      );
    }
    const workflow = normalizeCompileSourceWorkflowV2(
      candidate.candidate_workflow,
      {
        workspaceId,
        automationId,
        draftId: candidate.id,
        title: 'Runtime import candidate',
      },
    );
    const draft = await this.createRuntimeImportDraft({
      workspaceId,
      automationId,
      actorId: actor.id,
      workflow,
      snapshotHash: candidate.snapshot_hash,
      comment: request.comment ?? null,
    });
    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.automation_import_candidates
          set status = 'applied',
              applied_by = $4,
              applied_at = timezone('utc', now()),
              updated_at = timezone('utc', now())
          where workspace_id = $1
            and automation_id = $2
            and id = $3
        `,
        [workspaceId, automationId, candidate.id, actor.id],
      );
      await client.query(
        `
          update app.automation_runtime_bindings
          set status = 'sync_required',
              source_workflow_hash = $4,
              updated_at = timezone('utc', now())
          where workspace_id = $1
            and installed_automation_id = $2
            and id = $3
        `,
        [
          workspaceId,
          automationId,
          candidate.runtime_binding_id,
          draft.workflowHash,
        ],
      );
    });

    await this.audit(
      'workflow.runtime_import.applied',
      actor,
      access,
      automationId,
      meta,
      {
        candidateId: candidate.id,
        draftId: draft.draftId,
        workflowHash: draft.workflowHash,
        snapshotHash: candidate.snapshot_hash,
      },
    );

    return {
      status: 'draft_created',
      automation_id: automationId,
      draft_version_id: draft.draftId,
      sync_status: 'sync_required',
      import_report_id: candidate.diff_report_id,
    };
  }

  async rejectRuntimeImport(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    request: RuntimeImportRejectRequest,
    meta: RequestMeta = { requestId: null, traceId: null },
  ): Promise<RuntimeImportRejectResponse> {
    this.assertRuntimePermission(access, 'canvas.runtime.reject_import');
    const workspaceId = requireWorkspaceId(access);
    if (!request.draft_candidate_id && !request.snapshot_id) {
      throw new AppHttpException(
        'RUNTIME_IMPORT_REJECT_TARGET_REQUIRED',
        400,
        'draft_candidate_id or snapshot_id is required.',
      );
    }
    const result = await this.databaseService.query<{
      runtime_binding_id: string;
    }>(
      `
        update app.automation_import_candidates
        set status = 'rejected',
            rejected_by = $4,
            rejected_at = timezone('utc', now()),
            rejection_reason = $5,
            updated_at = timezone('utc', now())
        where workspace_id = $1
          and automation_id = $2
          and (
            ($3::uuid is not null and id = $3::uuid)
            or ($6::uuid is not null and snapshot_id = $6::uuid)
          )
          and status in ('preview_ready', 'blocked_by_policy')
        returning runtime_binding_id
      `,
      [
        workspaceId,
        automationId,
        request.draft_candidate_id ?? null,
        actor.id,
        request.reason ?? null,
        request.snapshot_id ?? null,
      ],
    );
    const bindingId = result.rows[0]?.runtime_binding_id;
    if (bindingId) {
      await this.updateRuntimeBindingStatus({
        workspaceId,
        bindingId,
        status: 'runtime_modified',
        runtimeHash: null,
        sourceWorkflowHash: null,
        flowVersionId: null,
      });
    }
    await this.audit(
      'workflow.runtime_import.rejected',
      actor,
      access,
      automationId,
      meta,
      {
        candidateId: request.draft_candidate_id ?? null,
        snapshotId: request.snapshot_id ?? null,
      },
    );
    return {
      status: 'rejected',
      sync_status: 'runtime_modified',
      next_actions: [
        'Review the Activepieces builder changes.',
        'Run import preview again or overwrite runtime from Canvas.',
      ],
    };
  }

  async overwriteRuntime(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    request: RuntimeOverwriteRequest,
    meta: RequestMeta = { requestId: null, traceId: null },
  ): Promise<RuntimeOverwriteResponse> {
    this.assertRuntimePermission(access, 'canvas.runtime.overwrite');
    if (request.confirm_discard_runtime_changes !== true) {
      throw new AppHttpException(
        'RUNTIME_OVERWRITE_CONFIRMATION_REQUIRED',
        400,
        'confirm_discard_runtime_changes must be true.',
      );
    }
    const workspaceId = requireWorkspaceId(access);
    const binding = await this.bindingService.getBinding(
      workspaceId,
      automationId,
    );
    let beforeSnapshotId: string | null = null;
    if (binding?.external_flow_id) {
      const snapshot = await this.snapshotService.pullActivepiecesFlowSnapshot({
        projectId: requireRuntimeProjectId(binding),
        flowId: binding.external_flow_id,
      });
      beforeSnapshotId = await this.bindingService.saveManualSnapshot({
        workspaceId,
        binding,
        flowVersionId: snapshot.flowVersionId,
        snapshot: snapshot.snapshot,
        normalizedSnapshot: snapshot.normalizedSnapshot,
        snapshotHash: snapshot.snapshotHash,
        actorId: actor.id,
        source: 'pre_overwrite',
      });
    }

    const report = await this.compile(
      actor,
      access,
      automationId,
      {
        mode: 'dry_run_compile',
        options: { include_advanced_report: true },
      },
      meta,
    );
    if (!report.compile_report_id) {
      throw new AppHttpException(
        'RUNTIME_OVERWRITE_COMPILE_REQUIRED',
        409,
        'Runtime overwrite requires a successful compile report.',
      );
    }
    const sync = await this.syncRuntime(
      actor,
      access,
      automationId,
      {
        compile_report_id: report.compile_report_id,
        overwrite_runtime_changes: true,
      },
      meta,
    );
    const flowId = sync.activepieces_projection?.flow_id ?? null;
    if (!flowId) {
      throw new AppHttpException(
        'RUNTIME_OVERWRITE_FLOW_UNAVAILABLE',
        409,
        'Runtime overwrite did not return an Activepieces flow id.',
      );
    }
    const latest = await this.findLatestSnapshot(
      workspaceId,
      automationId,
      sync.runtime_hash ?? null,
    );

    await this.audit(
      'workflow.runtime_overwrite.completed',
      actor,
      access,
      automationId,
      meta,
      {
        beforeSnapshotId,
        afterSnapshotId: latest?.id ?? null,
        runtimeHash: sync.runtime_hash,
        flowId,
      },
    );

    return {
      status: 'runtime_overwritten',
      activepieces_flow_id: flowId,
      new_sync_hash: sync.runtime_hash ?? sync.source_workflow_hash,
      new_snapshot_id: latest?.id ?? null,
    };
  }

  private async compileInternal(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly mode: CompileRequest['mode'];
    readonly includeAdvancedReport: boolean;
    readonly meta: RequestMeta;
  }): Promise<CompileArtifact> {
    const started = Date.now();
    await this.audit(
      input.mode === 'preview'
        ? 'workflow.compile_preview.requested'
        : 'workflow.compile.requested',
      input.actor,
      input.access,
      input.automationId,
      input.meta,
      { mode: input.mode ?? 'preview' },
    );

    const { draft, automation, workflow, sourceHash } =
      await this.loadCompileSource(
        input.actor,
        input.access,
        input.automationId,
      );
    const normalizedWorkflow = this.normalizer.normalize(workflow);
    const validation =
      this.validationService.runtimeGateValidate(normalizedWorkflow);
    const graph = this.graphValidator.validate(normalizedWorkflow);
    const connectionRequirements = await this.connectionResolver.resolve(
      normalizedWorkflow.workspace_id,
      normalizedWorkflow,
    );
    const runtimeIr = this.runtimeIrBuilder.build({
      workflow: normalizedWorkflow,
      sourceHash,
      mode: input.mode ?? 'preview',
      generatedAt: new Date().toISOString(),
      topologicalOrder: graph.topologicalOrder,
      connectionRequirements,
    });
    const projectionResult = this.projectionBuilder.build({
      workflow: normalizedWorkflow,
      runtimeIr,
      projectId: automation.runtime_project_id,
      flowId: automation.runtime_flow_id,
    });
    const policy = await this.policyValidator.validate({
      workflow: normalizedWorkflow,
      topologicalOrder: graph.topologicalOrder,
      requiredPieces: projectionResult.requiredPieces,
      requiredConnections: connectionRequirements,
    });
    const operations = this.operationsBuilder.buildImportPreview({
      flowId: automation.runtime_flow_id,
      projection: projectionResult.projection,
      projectionHash: projectionResult.projectionHash,
    });
    const warnings = [
      ...validationWarnings(validation),
      ...graph.warnings,
      ...policy.warnings,
    ];
    const blockingIssues = [
      ...validationBlockingIssues(validation),
      ...graph.issues,
      ...policy.issues,
    ];
    const status = compileStatus(validation, blockingIssues, warnings);
    const report = await this.reportService.persistReport({
      workspaceId: normalizedWorkflow.workspace_id,
      automationId: input.automationId,
      automationVersionId: draft.current_version_id,
      draftVersionId: draft.id,
      compileMode: input.mode ?? 'preview',
      sourceWorkflowHash: sourceHash,
      status,
      validationResult: validation,
      runtimeIr,
      activepiecesProjection: projectionResult.projection,
      generatedOperations: operations,
      requiredPieces: policy.requiredPieces,
      requiredConnections: connectionRequirements,
      warnings,
      blockingIssues,
      actorId: input.actor.id,
    });
    const projectionSummary = {
      ...projectionResult.summary,
      required_pieces: policy.requiredPieces,
    };

    await this.audit(
      input.mode === 'preview'
        ? 'workflow.compile_preview.completed'
        : 'workflow.compile.completed',
      input.actor,
      input.access,
      input.automationId,
      input.meta,
      {
        reportId: report.id,
        status,
        sourceWorkflowHash: sourceHash,
        durationMs: Date.now() - started,
      },
    );

    return {
      report,
      status,
      runtimeIr,
      projection: projectionResult.projection,
      operations,
      projectionSummary,
      requiredPieces: policy.requiredPieces,
      requiredConnections: connectionRequirements,
      warnings,
      blockingIssues,
      sourceWorkflowHash: sourceHash,
      projectionHash: projectionResult.projectionHash,
      stepMappings: projectionResult.stepMappings,
    };
  }

  private async loadCompileSource(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
  ): Promise<{
    readonly draft: CanvasDraftCompilerRow;
    readonly automation: InstalledAutomationCompilerRow;
    readonly workflow: LexFrameWorkflowV2;
    readonly sourceHash: string;
  }> {
    const workspaceId = requireWorkspaceId(access);
    const automation =
      await this.databaseService.one<InstalledAutomationCompilerRow>(
        `
        select
          id,
          workspace_id,
          source_template_version_id,
          title,
          version,
          runtime_project_id,
          runtime_flow_id,
          sync_hash
        from app.installed_automations
        where workspace_id = $1
          and id = $2
          and deleted_at is null
        limit 1
      `,
        [workspaceId, automationId],
      );
    if (!automation) {
      throw new AppHttpException(
        'AUTOMATION_NOT_FOUND',
        404,
        'Installed automation was not found.',
      );
    }

    const draft = await this.databaseService.one<CanvasDraftCompilerRow>(
      `
        select
          id,
          workspace_id,
          installed_automation_id,
          source_template_version_id,
          current_version_id,
          workflow,
          revision_counter,
          status
        from app.automation_canvas_drafts
        where workspace_id = $1
          and installed_automation_id = $2
          and archived_at is null
        limit 1
      `,
      [workspaceId, automationId],
    );
    const sourceDraft =
      draft ??
      ({
        id: null,
        workspace_id: workspaceId,
        installed_automation_id: automationId,
        source_template_version_id: automation.source_template_version_id,
        current_version_id: null,
        workflow: await this.loadInstalledWorkflow(workspaceId, automationId),
        revision_counter: 0,
        status: 'installed',
      } satisfies CanvasDraftCompilerRow);
    const workflow = normalizeCompileSourceWorkflowV2(sourceDraft.workflow, {
      workspaceId,
      automationId,
      draftId:
        sourceDraft.id ??
        automation.source_template_version_id ??
        `installed:${automationId}`,
      title: automation.title,
    });
    const normalized = this.normalizer.normalize({
      ...workflow,
      workspace_id: workspaceId,
      automation_id: automationId,
    });
    const sourceHash = this.normalizer.computeSourceWorkflowHash(normalized);

    return {
      draft: sourceDraft,
      automation,
      workflow: normalized,
      sourceHash,
    };
  }

  private async loadInstalledWorkflow(
    workspaceId: string,
    automationId: string,
  ) {
    const row = await this.databaseService.one<{ readonly workflow: unknown }>(
      `
        select workflow
        from app.installed_automations
        where workspace_id = $1
          and id = $2
          and deleted_at is null
        limit 1
      `,
      [workspaceId, automationId],
    );
    return row?.workflow ?? null;
  }

  private async findRuntimeProjectionId(
    workspaceId: string,
    automationId: string,
    automationVersionId: string,
    projectionHash: string,
  ): Promise<string | null> {
    const row = await this.databaseService.one<{ readonly id: string }>(
      `
        select id
        from app.automation_runtime_projections
        where workspace_id = $1
          and automation_id = $2
          and automation_version_id = $3
          and projection_hash = $4
        limit 1
      `,
      [workspaceId, automationId, automationVersionId, projectionHash],
    );
    return row?.id ?? null;
  }

  private toCompileResponse(artifact: CompileArtifact): CompileResponse {
    return {
      status: artifact.status,
      compile_report_id: artifact.report.id,
      source_workflow_hash: artifact.sourceWorkflowHash,
      runtime_hash: null,
      summary: {
        generated_steps:
          artifact.runtimeIr.steps.length +
          (artifact.runtimeIr.trigger ? 1 : 0),
        required_pieces: artifact.requiredPieces.length,
        required_connections: artifact.requiredConnections.length,
        approval_gates: artifact.runtimeIr.steps.filter(
          (step) => step.source_node_type === 'approval',
        ).length,
        external_actions: artifact.runtimeIr.steps.filter(
          (step) => step.policy.external_action,
        ).length,
        blocked_issues: artifact.blockingIssues.length,
        warnings: artifact.warnings.length,
      },
      activepieces_projection: artifact.projectionSummary,
      validation: artifact.report.validation_result,
      warnings: artifact.warnings,
      blocking_issues: artifact.blockingIssues,
      preview: {
        flow: artifact.projection,
        operations: artifact.operations,
        runtime_ir: artifact.runtimeIr,
      },
      can_sync: canSync(artifact.status),
      can_dry_run: artifact.report.validation_result.can_compile,
      can_publish:
        artifact.report.validation_result.can_publish &&
        canSync(artifact.status),
    };
  }

  private responseFromReport(
    report: CompileReport,
    input: {
      readonly status: CompileStatus;
      readonly runtimeHash: string | null;
      readonly binding: RuntimeBindingRow | null;
      readonly projectId?: string | null;
      readonly flowId?: string | null;
      readonly flowVersionId?: string | null;
      readonly extraIssues?: readonly CompileIssue[];
    },
  ): CompileResponse {
    const issues = [...report.blocking_issues, ...(input.extraIssues ?? [])];
    return {
      status: input.status,
      compile_report_id: report.id,
      source_workflow_hash: report.source_workflow_hash,
      runtime_hash: input.runtimeHash,
      summary: {
        generated_steps:
          report.runtime_ir.steps.length + (report.runtime_ir.trigger ? 1 : 0),
        required_pieces: report.required_pieces.length,
        required_connections: report.required_connections.length,
        approval_gates: report.runtime_ir.steps.filter(
          (step) => step.source_node_type === 'approval',
        ).length,
        external_actions: report.runtime_ir.steps.filter(
          (step) => step.policy.external_action,
        ).length,
        blocked_issues: issues.length,
        warnings: report.warnings.length,
      },
      activepieces_projection: {
        project_id:
          input.projectId ?? input.binding?.external_project_id ?? null,
        flow_id: input.flowId ?? input.binding?.external_flow_id ?? null,
        flow_version_id:
          input.flowVersionId ??
          input.binding?.activepieces_flow_version_id ??
          null,
        sync_hash: hashFromReport(report),
        generated_steps_count:
          report.runtime_ir.steps.length + (report.runtime_ir.trigger ? 1 : 0),
        required_pieces: report.required_pieces,
        required_connections: report.required_connections,
      },
      validation: report.validation_result,
      warnings: report.warnings,
      blocking_issues: issues,
      preview: {
        flow: report.activepieces_projection,
        operations: report.generated_operations,
        runtime_ir: report.runtime_ir,
      },
      can_sync: input.status !== 'runtime_conflict' && issues.length === 0,
      can_dry_run: report.validation_result.can_compile,
      can_publish: report.validation_result.can_publish && issues.length === 0,
    };
  }

  private async loadRuntimeSnapshot(
    workspaceId: string,
    automationId: string,
    snapshotId: string,
  ): Promise<{
    readonly id: string;
    readonly runtime_binding_id: string;
    readonly activepieces_flow_id: string | null;
    readonly activepieces_flow_version_id: string | null;
    readonly snapshot_hash: string;
    readonly normalized_snapshot_json: unknown;
    readonly external_project_id: string | null;
  }> {
    const snapshot = await this.databaseService.one<{
      readonly id: string;
      readonly runtime_binding_id: string;
      readonly activepieces_flow_id: string | null;
      readonly activepieces_flow_version_id: string | null;
      readonly snapshot_hash: string;
      readonly normalized_snapshot_json: unknown;
      readonly external_project_id: string | null;
    }>(
      `
        select
          s.id,
          s.runtime_binding_id,
          s.activepieces_flow_id,
          s.activepieces_flow_version_id,
          s.snapshot_hash,
          s.normalized_snapshot_json,
          b.external_project_id
        from app.activepieces_flow_snapshots s
        join app.automation_runtime_bindings b
          on b.id = s.runtime_binding_id
         and b.workspace_id = s.workspace_id
        where s.workspace_id = $1
          and b.installed_automation_id = $2
          and s.id = $3
        limit 1
      `,
      [workspaceId, automationId, snapshotId],
    );
    if (!snapshot) {
      throw new AppHttpException(
        'RUNTIME_IMPORT_SNAPSHOT_NOT_FOUND',
        404,
        'Runtime snapshot was not found for this automation.',
      );
    }
    return snapshot;
  }

  private async persistImportPreview(input: {
    readonly workspaceId: string;
    readonly automationId: string;
    readonly actorId: string;
    readonly bindingId: string;
    readonly snapshotId: string;
    readonly baseDraftId: string | null;
    readonly baseWorkflowHash: string;
    readonly candidateWorkflow: LexFrameWorkflowV2 | null;
    readonly validation: CanvasValidationSummary;
    readonly importability: RuntimeImportPreviewResponse['importability'];
    readonly diff: readonly WorkflowDiffItem[];
    readonly runtimeGraph: RuntimeGraph;
    readonly status: 'preview_ready' | 'blocked_by_policy';
    readonly issues: readonly CompileIssue[];
  }): Promise<{
    readonly candidateId: string | null;
    readonly diffId: string;
    readonly conflictId: string | null;
  }> {
    return this.databaseService.transaction(async (client) => {
      let candidateId: string | null = null;
      const candidateHash = input.candidateWorkflow
        ? this.normalizer.computeSourceWorkflowHash(input.candidateWorkflow)
        : null;
      if (input.candidateWorkflow) {
        candidateId = randomUUID();
        await client.query(
          `
            insert into app.automation_import_candidates (
              id,
              workspace_id,
              automation_id,
              runtime_binding_id,
              snapshot_id,
              base_canvas_draft_id,
              base_workflow_hash,
              candidate_workflow,
              candidate_workflow_hash,
              validation_summary,
              importability,
              status,
              created_by
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11, $12, $13)
          `,
          [
            candidateId,
            input.workspaceId,
            input.automationId,
            input.bindingId,
            input.snapshotId,
            input.baseDraftId,
            input.baseWorkflowHash,
            JSON.stringify(input.candidateWorkflow),
            candidateHash,
            JSON.stringify(input.validation),
            input.importability,
            input.status,
            input.actorId,
          ],
        );
      }

      const diffId = randomUUID();
      await client.query(
        `
          insert into app.automation_import_diffs (
            id,
            workspace_id,
            automation_id,
            runtime_binding_id,
            snapshot_id,
            candidate_id,
            diff_items,
            technical_diff,
            importability,
            severity,
            summary,
            created_by
          )
          values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11::jsonb, $12)
        `,
        [
          diffId,
          input.workspaceId,
          input.automationId,
          input.bindingId,
          input.snapshotId,
          candidateId,
          JSON.stringify(input.diff),
          JSON.stringify({
            runtime_graph: input.runtimeGraph,
            candidate_workflow_hash: candidateHash,
          }),
          input.importability,
          diffSeverity(input.diff),
          JSON.stringify({
            diff_items: input.diff.length,
            policy_blocks: input.diff.filter(
              (item) => item.severity === 'policy_block',
            ).length,
            requires_review: input.diff.filter(
              (item) =>
                item.severity === 'requires_review' ||
                item.severity === 'conflict',
            ).length,
            validation_status: input.validation.status,
          }),
          input.actorId,
        ],
      );
      if (candidateId) {
        await client.query(
          `
            update app.automation_import_candidates
            set diff_report_id = $4,
                updated_at = timezone('utc', now())
            where workspace_id = $1
              and automation_id = $2
              and id = $3
          `,
          [input.workspaceId, input.automationId, candidateId, diffId],
        );
      }

      let conflictId: string | null = null;
      if (!candidateId) {
        conflictId = randomUUID();
        await client.query(
          `
            insert into app.runtime_sync_conflicts (
              id,
              workspace_id,
              automation_id,
              runtime_binding_id,
              snapshot_id,
              conflict_type,
              status,
              runtime_hash,
              canonical_workflow_hash,
              issue_summary,
              created_by
            )
            select
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              'open',
              s.snapshot_hash,
              $7,
              $8::jsonb,
              $9
            from app.activepieces_flow_snapshots s
            where s.id = $5
          `,
          [
            conflictId,
            input.workspaceId,
            input.automationId,
            input.bindingId,
            input.snapshotId,
            input.importability === 'unmappable'
              ? 'unmappable_runtime'
              : 'policy_block',
            input.baseWorkflowHash,
            JSON.stringify({
              importability: input.importability,
              issues: input.issues,
              diff_items: input.diff.length,
            }),
            input.actorId,
          ],
        );
      }

      return { candidateId, diffId, conflictId };
    });
  }

  private async loadImportCandidate(
    workspaceId: string,
    automationId: string,
    candidateId: string,
  ): Promise<{
    readonly id: string;
    readonly runtime_binding_id: string;
    readonly snapshot_id: string;
    readonly snapshot_hash: string;
    readonly candidate_workflow: unknown;
    readonly importability: RuntimeImportPreviewResponse['importability'];
    readonly diff_report_id: string | null;
  }> {
    const candidate = await this.databaseService.one<{
      readonly id: string;
      readonly runtime_binding_id: string;
      readonly snapshot_id: string;
      readonly snapshot_hash: string;
      readonly candidate_workflow: unknown;
      readonly importability: RuntimeImportPreviewResponse['importability'];
      readonly diff_report_id: string | null;
    }>(
      `
        select
          c.id,
          c.runtime_binding_id,
          c.snapshot_id,
          s.snapshot_hash,
          c.candidate_workflow,
          c.importability,
          c.diff_report_id
        from app.automation_import_candidates c
        join app.activepieces_flow_snapshots s
          on s.id = c.snapshot_id
         and s.workspace_id = c.workspace_id
        where c.workspace_id = $1
          and c.automation_id = $2
          and c.id = $3
          and c.status = 'preview_ready'
        limit 1
      `,
      [workspaceId, automationId, candidateId],
    );
    if (!candidate) {
      throw new AppHttpException(
        'RUNTIME_IMPORT_CANDIDATE_NOT_FOUND',
        404,
        'Runtime import candidate was not found or is no longer preview-ready.',
      );
    }
    return candidate;
  }

  private async createRuntimeImportDraft(input: {
    readonly workspaceId: string;
    readonly automationId: string;
    readonly actorId: string;
    readonly workflow: LexFrameWorkflowV2;
    readonly snapshotHash: string;
    readonly comment: string | null;
  }): Promise<{ readonly draftId: string; readonly workflowHash: string }> {
    const draftId = randomUUID();
    const now = new Date().toISOString();
    const workflow = canonicalizeWorkflowV2({
      ...input.workflow,
      draft_version_id: draftId,
      published_version_id: input.workflow.published_version_id ?? null,
      revision_counter: 0,
      metadata: {
        ...input.workflow.metadata,
        status: 'draft',
      },
      runtime_projection: {
        ...input.workflow.runtime_projection,
        status: 'sync_required',
        warnings: [
          ...(input.workflow.runtime_projection.warnings ?? []),
          'Imported from Activepieces runtime; compile and sync before publishing.',
        ],
      },
      updated_at: now,
    });
    const validation = this.validationService.validateWorkflow(workflow, {
      mode: 'full',
      reason: 'runtime_import_apply',
      scope: 'draft',
      includeRuntimeChecks: true,
    });
    const workflowWithValidation = this.withValidationState(
      workflow,
      validation,
    );
    const workflowHash = this.normalizer.computeSourceWorkflowHash(
      workflowWithValidation,
    );
    const canvas = this.buildCanvasReadModel(
      workflowWithValidation,
      validation,
    );

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.automation_canvas_drafts
          set status = 'archived',
              archived_at = timezone('utc', now()),
              updated_by_user_id = $3,
              updated_at = timezone('utc', now())
          where workspace_id = $1
            and installed_automation_id = $2
            and archived_at is null
        `,
        [input.workspaceId, input.automationId, input.actorId],
      );
      await client.query(
        `
          insert into app.automation_canvas_drafts (
            id,
            workspace_id,
            project_id,
            installed_automation_id,
            source_template_version_id,
            workflow,
            workflow_hash,
            validation_summary,
            runtime_projection,
            normalized_canvas,
            runtime_projection_status,
            activepieces_sync_status,
            revision_counter,
            status,
            created_by_user_id,
            updated_by_user_id
          )
          values ($1, $2, null, $3, null, $4::jsonb, $5, $6::jsonb, $7::jsonb, $8::jsonb, 'sync_required', 'not_synced', 0, 'editing', $9, $9)
        `,
        [
          draftId,
          input.workspaceId,
          input.automationId,
          JSON.stringify(workflowWithValidation),
          workflowHash,
          JSON.stringify(validation),
          JSON.stringify(workflowWithValidation.runtime_projection),
          JSON.stringify(canvas),
          input.actorId,
        ],
      );
      await client.query(
        `
          update app.installed_automations
          set workflow = $3::jsonb,
              workflow_state = 'draft',
              sync_state = 'pending',
              next_gate = $4,
              updated_at = timezone('utc', now())
          where workspace_id = $1
            and id = $2
        `,
        [
          input.workspaceId,
          input.automationId,
          JSON.stringify(workflowWithValidation),
          input.comment ??
            'Runtime changes imported into a new Canvas draft. Compile and sync before publishing.',
        ],
      );
    });

    return { draftId, workflowHash };
  }

  private async updateRuntimeBindingStatus(input: {
    readonly workspaceId: string;
    readonly bindingId: string;
    readonly status: RuntimeSyncStatusResponse['sync_status'];
    readonly runtimeHash: string | null;
    readonly sourceWorkflowHash: string | null;
    readonly flowVersionId: string | null;
  }) {
    await this.databaseService.query(
      `
        update app.automation_runtime_bindings
        set
          status = $3,
          runtime_hash = coalesce($4, runtime_hash),
          source_workflow_hash = coalesce($5, source_workflow_hash),
          activepieces_flow_version_id = coalesce($6, activepieces_flow_version_id),
          last_checked_at = timezone('utc', now()),
          runtime_modified_at = case
            when $3 in ('runtime_modified', 'importable', 'import_requires_review', 'import_blocked_by_policy', 'unknown_runtime_nodes', 'conflict') then timezone('utc', now())
            else runtime_modified_at
          end,
          updated_at = timezone('utc', now())
        where workspace_id = $1
          and id = $2
      `,
      [
        input.workspaceId,
        input.bindingId,
        input.status,
        input.runtimeHash,
        input.sourceWorkflowHash,
        input.flowVersionId,
      ],
    );
  }

  private async createRuntimeConflict(input: {
    readonly workspaceId: string;
    readonly automationId: string;
    readonly bindingId: string;
    readonly snapshotId: string | null;
    readonly conflictType: string;
    readonly status: string;
    readonly issues: readonly CompileIssue[];
    readonly actorId: string | null;
  }): Promise<string> {
    const conflictId = randomUUID();
    await this.databaseService.query(
      `
        insert into app.runtime_sync_conflicts (
          id,
          workspace_id,
          automation_id,
          runtime_binding_id,
          snapshot_id,
          conflict_type,
          status,
          issue_summary,
          created_by
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      `,
      [
        conflictId,
        input.workspaceId,
        input.automationId,
        input.bindingId,
        input.snapshotId,
        input.conflictType,
        input.status,
        JSON.stringify({ issues: input.issues }),
        input.actorId,
      ],
    );
    return conflictId;
  }

  private async findLatestSnapshot(
    workspaceId: string,
    automationId: string,
    runtimeHash: string | null,
  ): Promise<{ readonly id: string } | null> {
    return this.databaseService.one<{ readonly id: string }>(
      `
        select s.id
        from app.activepieces_flow_snapshots s
        join app.automation_runtime_bindings b
          on b.id = s.runtime_binding_id
         and b.workspace_id = s.workspace_id
        where s.workspace_id = $1
          and b.installed_automation_id = $2
          and ($3::text is null or s.snapshot_hash = $3)
        order by s.created_at desc
        limit 1
      `,
      [workspaceId, automationId, runtimeHash],
    );
  }

  private withValidationState(
    workflow: LexFrameWorkflowV2,
    validation: CanvasValidationSummary,
  ): LexFrameWorkflowV2 {
    const canonical = canonicalizeWorkflowV2(workflow);
    return {
      ...canonical,
      validation,
      validation_state: validation,
      runtime_projection: {
        ...canonical.runtime_projection,
        can_compile: validation.can_compile,
        can_run: validation.can_run,
      },
    };
  }

  private buildCanvasReadModel(
    workflow: LexFrameWorkflowV2,
    validation: CanvasValidationSummary,
  ): CanvasReadModel {
    const issueByNode = new Map(
      validation.issues
        .filter((issue) => issue.affected_node_id)
        .map((issue) => [issue.affected_node_id, issue.severity]),
    );
    return {
      nodes: workflow.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: {
          x: node.canvas?.x ?? node.layout.x,
          y: node.canvas?.y ?? node.layout.y,
        },
        data: {
          title: node.display_name,
          subtitle: node.description ?? node.module_code ?? node.block_code,
          badges: [],
          validation_state:
            issueByNode.get(node.id) === 'policy_block'
              ? 'invalid'
              : issueByNode.has(node.id)
                ? issueByNode.get(node.id) === 'warning'
                  ? 'warning'
                  : 'invalid'
                : 'valid',
          missing_inputs_count: 0,
        },
      })),
      edges: workflow.edges.map((edge) => ({
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        source_handle: edge.source_handle,
        target_handle: edge.target_handle,
        type: edge.type,
        label: edge.label ?? null,
        validation_state: edge.validation_state ?? 'valid',
      })),
      viewport: { x: 0, y: 0, zoom: 1 },
    };
  }

  private assertRuntimePermission(
    access: AccessContext,
    permission: RuntimePermissionCode,
  ) {
    if (this.hasRuntimePermission(access, permission)) {
      return;
    }
    throw new AppHttpException(
      'PERMISSION_DENIED',
      403,
      `${permission} permission is required for runtime reverse sync.`,
    );
  }

  private hasRuntimePermission(
    access: AccessContext,
    permission: RuntimePermissionCode,
  ) {
    const permissions = new Set(access.permissions);
    if (
      permissions.has(permission) ||
      permissions.has('canvas.import_runtime')
    ) {
      return true;
    }
    if (
      permission === 'canvas.runtime.view' &&
      (permissions.has('canvas.view') ||
        permissions.has('canvas.view_validation'))
    ) {
      return true;
    }
    if (
      permission === 'canvas.runtime.pull' &&
      (permissions.has('activepieces.sync_flow') ||
        permissions.has('automation.sync_runtime'))
    ) {
      return true;
    }
    if (
      permission === 'canvas.runtime.overwrite' &&
      (permissions.has('automation.sync_runtime') ||
        permissions.has('automation.publish') ||
        permissions.has('activepieces.sync_flow'))
    ) {
      return true;
    }
    return false;
  }

  private canResolveRuntimeReview(access: AccessContext) {
    const permissions = new Set(access.permissions);
    const roles = new Set(access.roles);
    return (
      permissions.has('canvas.runtime.resolve_conflict') ||
      roles.has('owner') ||
      roles.has('admin')
    );
  }

  private assertSyncPermission(access: AccessContext) {
    const permissions = new Set(access.permissions);
    if (permissions.has('canvas.sync_runtime')) {
      return;
    }
    throw new AppHttpException(
      'PERMISSION_DENIED',
      403,
      'Runtime sync requires canvas.sync_runtime permission.',
    );
  }

  private assertPermission(access: AccessContext, permission: PermissionCode) {
    if (access.permissions.includes(permission)) {
      return;
    }
    throw new AppHttpException(
      'PERMISSION_DENIED',
      403,
      `${permission} permission is required.`,
    );
  }

  private async audit(
    action: string,
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    meta: RequestMeta,
    metadata: Record<string, unknown>,
  ) {
    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action,
      entityType: 'installed_automation',
      entityId: automationId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      eventCategory: 'workflow_compiler',
      dataClass: 'internal',
      redactionApplied: true,
      metadata: {
        compilerVersion: WORKFLOW_COMPILER_VERSION,
        targetRuntime: TARGET_RUNTIME,
        ...metadata,
      },
    });
  }
}

function validationBlockingIssues(
  validation: CanvasValidationResult,
): readonly CompileIssue[] {
  return validation.issues
    .filter(
      (issue) =>
        issue.severity === 'error' ||
        issue.severity === 'policy_block' ||
        issue.blocks?.includes('compile') ||
        issue.blocks?.includes('sync'),
    )
    .map((issue) => ({
      code: issue.code,
      message: issue.message,
      severity: issue.severity === 'policy_block' ? 'policy_block' : 'error',
      node_id: issue.affected_node_id ?? null,
      details: {
        issue_id: issue.id,
        scope: issue.scope,
        blocks: issue.blocks ?? [],
      },
    }));
}

function validationWarnings(
  validation: CanvasValidationResult,
): readonly CompileWarning[] {
  return validation.issues
    .filter((issue) => issue.severity === 'warning')
    .map((issue) => ({
      code: issue.code,
      message: issue.message,
      node_id: issue.affected_node_id ?? null,
      details: {
        issue_id: issue.id,
        scope: issue.scope,
      },
    }));
}

function compileStatus(
  validation: CanvasValidationResult,
  blockingIssues: readonly CompileIssue[],
  warnings: readonly CompileWarning[],
): CompileStatus {
  if (!validation.can_compile) {
    return 'blocked_by_validation';
  }
  if (
    blockingIssues.some(
      (issue) => issue.code === 'WF_COMPILER_REQUIRED_CONNECTION_MISSING',
    )
  ) {
    return 'blocked_by_missing_connection';
  }
  if (blockingIssues.some((issue) => issue.severity === 'policy_block')) {
    return 'blocked_by_policy';
  }
  if (blockingIssues.length > 0) {
    return 'blocked_by_validation';
  }
  return warnings.length > 0 ? 'compiled_with_warnings' : 'compiled';
}

function canSync(status: CompileStatus) {
  return status === 'compiled' || status === 'compiled_with_warnings';
}

type RuntimePermissionCode =
  | 'canvas.runtime.view'
  | 'canvas.runtime.pull'
  | 'canvas.runtime.import_preview'
  | 'canvas.runtime.import_apply'
  | 'canvas.runtime.reject_import'
  | 'canvas.runtime.overwrite'
  | 'canvas.runtime.resolve_conflict';

function runtimeStatusFromBinding(
  binding: RuntimeBindingRow | null,
  sourceHash: string | null,
): {
  readonly syncStatus: RuntimeSyncStatusResponse['sync_status'];
  readonly runtimeChanged: boolean;
  readonly canonicalChanged: boolean;
  readonly warnings: readonly string[];
} {
  if (!binding || !binding.external_flow_id) {
    return {
      syncStatus: 'runtime_unavailable',
      runtimeChanged: false,
      canonicalChanged: Boolean(sourceHash),
      warnings: ['Activepieces flow is not bound to this automation.'],
    };
  }
  const runtimeChanged = Boolean(
    binding.runtime_hash &&
    binding.last_synced_hash &&
    binding.runtime_hash !== binding.last_synced_hash,
  );
  const canonicalChanged = Boolean(
    sourceHash &&
    binding.source_workflow_hash &&
    sourceHash !== binding.source_workflow_hash,
  );
  const syncStatus =
    runtimeChanged && canonicalChanged
      ? 'conflict'
      : normalizeBindingRuntimeStatus(binding.status);
  return {
    syncStatus,
    runtimeChanged,
    canonicalChanged,
    warnings:
      syncStatus === 'conflict'
        ? [
            'Canvas draft and Activepieces runtime both changed since last sync.',
          ]
        : runtimeChanged
          ? ['Activepieces runtime changed since last LexFrame sync.']
          : [],
  };
}

function normalizeBindingRuntimeStatus(
  status: string,
): RuntimeSyncStatusResponse['sync_status'] {
  switch (status) {
    case 'synced':
    case 'runtime_modified':
    case 'importable':
    case 'import_requires_review':
    case 'import_blocked_by_policy':
    case 'unknown_runtime_nodes':
    case 'runtime_unavailable':
    case 'conflict':
    case 'not_compiled':
    case 'compile_required':
    case 'compile_failed':
    case 'sync_required':
    case 'syncing':
    case 'blocked_by_policy':
    case 'deprecated_piece':
    case 'missing_connection':
      return status;
    case 'conflict_source_and_runtime_changed':
      return 'conflict';
    default:
      return 'compile_required';
  }
}

function normalizeRuntimeDriftStatus(
  status: RuntimeDriftResponse['status'],
): RuntimeSyncStatusResponse['sync_status'] {
  switch (status) {
    case 'conflict_source_and_runtime_changed':
      return 'conflict';
    case 'direct_ai_provider_added':
    case 'approval_removed':
    case 'forbidden_piece_added':
      return 'import_blocked_by_policy';
    case 'unknown_runtime_nodes':
      return 'unknown_runtime_nodes';
    case 'import_requires_review':
    case 'import_blocked_by_policy':
    case 'runtime_unavailable':
    case 'runtime_modified':
    case 'importable':
    case 'synced':
    case 'conflict':
      return status;
    default:
      return 'runtime_modified';
  }
}

function importabilityWithValidation(
  importability: RuntimeImportPreviewResponse['importability'],
  validation: CanvasValidationSummary,
  diff: readonly WorkflowDiffItem[],
): RuntimeImportPreviewResponse['importability'] {
  if (
    validation.policy_blocks_count > 0 ||
    diff.some((item) => item.severity === 'policy_block')
  ) {
    return 'blocked_by_policy';
  }
  if (importability === 'blocked_by_policy' || importability === 'unmappable') {
    return importability;
  }
  if (
    validation.errors_count > 0 ||
    diff.some(
      (item) =>
        item.severity === 'requires_review' || item.severity === 'conflict',
    )
  ) {
    return 'requires_review';
  }
  if (
    validation.warnings_count > 0 ||
    diff.some((item) => item.severity === 'warning')
  ) {
    return 'importable_with_warnings';
  }
  return importability;
}

function canCreateImportCandidate(
  importability: RuntimeImportPreviewResponse['importability'],
) {
  return (
    importability === 'fully_importable' ||
    importability === 'importable_with_warnings' ||
    importability === 'requires_review'
  );
}

function statusFromImportability(
  importability: RuntimeImportPreviewResponse['importability'],
): RuntimeSyncStatusResponse['sync_status'] {
  switch (importability) {
    case 'fully_importable':
    case 'importable_with_warnings':
      return 'importable';
    case 'requires_review':
      return 'import_requires_review';
    case 'blocked_by_policy':
      return 'import_blocked_by_policy';
    case 'unmappable':
      return 'unknown_runtime_nodes';
  }
}

function diffSeverity(
  diff: readonly WorkflowDiffItem[],
): WorkflowDiffItem['severity'] {
  if (diff.some((item) => item.severity === 'policy_block')) {
    return 'policy_block';
  }
  if (diff.some((item) => item.severity === 'conflict')) {
    return 'conflict';
  }
  if (diff.some((item) => item.severity === 'requires_review')) {
    return 'requires_review';
  }
  if (diff.some((item) => item.severity === 'warning')) {
    return 'warning';
  }
  return 'info';
}

function requireWorkspaceId(access: AccessContext) {
  const workspaceId = access.activeWorkspace?.id;
  if (!workspaceId) {
    throw new AppHttpException(
      'WORKSPACE_CONTEXT_REQUIRED',
      403,
      'Workspace context is required.',
    );
  }
  return workspaceId;
}

function requireRuntimeProjectId(binding: RuntimeBindingRow) {
  if (!binding.external_project_id) {
    throw new AppHttpException(
      'CANVAS_RUNTIME_BINDING_NOT_FOUND',
      409,
      'Activepieces project id is missing from the runtime binding.',
    );
  }
  return binding.external_project_id;
}

function isActivepiecesRuntimeId(value: string) {
  return /^[0-9a-zA-Z]{21}$/.test(value);
}

function hashFromReport(report: CompileReport) {
  const importOperation = report.generated_operations.find(
    (operation) => isRecord(operation) && operation.type === 'IMPORT_FLOW',
  );
  if (isRecord(importOperation) && isRecord(importOperation.metadata)) {
    const projectionHash = importOperation.metadata.projectionHash;
    if (typeof projectionHash === 'string') {
      return projectionHash;
    }
  }
  return report.source_workflow_hash;
}

function buildStepMappingsFromReport(report: CompileReport) {
  const projection = report.activepieces_projection;
  if (!isRecord(projection)) {
    return [];
  }
  const metadata = isRecord(projection.metadata) ? projection.metadata : {};
  if (
    Array.isArray(metadata.stepMappings) &&
    metadata.stepMappings.every(isRecord)
  ) {
    return metadata.stepMappings.map((mapping) => ({
      source_node_id: stringOr(mapping.source_node_id, 'unknown'),
      source_node_hash: stringOr(
        mapping.source_node_hash,
        stableHash(mapping.source_node_id ?? mapping.ir_step_id ?? 'unknown'),
      ),
      ir_step_id: stringOr(mapping.ir_step_id, stableHash(mapping)),
      activepieces_step_name: stringOr(
        mapping.activepieces_step_name,
        stringOr(mapping.ir_step_id, stableHash(mapping)),
      ),
      activepieces_step_display_name: stringOr(
        mapping.activepieces_step_display_name,
        'Runtime step',
      ),
      piece_name: nullableString(mapping.piece_name),
      piece_version: nullableString(mapping.piece_version),
      action_name: nullableString(mapping.action_name),
    }));
  }
  const actions = Array.isArray(projection.actions) ? projection.actions : [];
  const trigger = isRecord(projection.trigger) ? [projection.trigger] : [];
  return [...trigger, ...actions].filter(isRecord).map((step) => {
    const settings = isRecord(step.settings) ? step.settings : {};
    const metadata = isRecord(step.metadata) ? step.metadata : {};
    const sourceNodeId =
      typeof metadata.lexframeSourceNodeId === 'string'
        ? metadata.lexframeSourceNodeId
        : 'unknown';
    return {
      source_node_id: sourceNodeId,
      source_node_hash: randomUUID(),
      ir_step_id: typeof step.name === 'string' ? step.name : randomUUID(),
      activepieces_step_name:
        typeof step.name === 'string' ? step.name : randomUUID(),
      activepieces_step_display_name:
        typeof step.displayName === 'string'
          ? step.displayName
          : 'Runtime step',
      piece_name:
        typeof settings.pieceName === 'string' ? settings.pieceName : null,
      piece_version:
        typeof settings.pieceVersion === 'string'
          ? settings.pieceVersion
          : null,
      action_name:
        typeof settings.actionName === 'string'
          ? settings.actionName
          : typeof settings.triggerName === 'string'
            ? settings.triggerName
            : null,
    };
  });
}

function stableHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
