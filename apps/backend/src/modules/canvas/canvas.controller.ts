import type {
  CanvasCompatibilityCheckRequest,
  CanvasDraftRequest,
  CanvasOperationPreviewResponse,
  CanvasOperation,
  CanvasOperationRequest,
  CanvasStepConfigValidationRequest,
  CanvasStepConfigValidationResponse,
  CanvasTestInputMode,
  CanvasTestMode,
  CanvasTestRunPolicy,
  CanvasTestRunRedaction,
  CanvasTestRunRequest,
  StepInputBinding as ContractStepInputBinding,
  CanvasValidateRequest,
  CanvasPublishRequest,
  CanvasRollbackRequest,
  CanvasSnapshotRequest,
  CanvasAuditExportResponse,
  CanvasAuditHashChainStatusResponse,
  CanvasAuditListResponse,
  CanvasPolicyOverrideDecisionRequest,
  CanvasPolicyOverrideRequest,
  CanvasSecurityCheckRequest,
  CanvasSecurityContext,
  CanvasSecurityPolicy,
  CompileRequest,
  CompileReportsResponse,
  CompileResponse,
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
  StepTestRequest,
} from '@lexframe/contracts';
import type {
  CanvasEdgeType,
  CanvasHandleCode,
  StepInputBinding,
} from '@lexframe/workflow-dsl';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { requestMeta } from '../../common/http/request-parsing';
import { CanvasBlockRegistryService } from './canvas-block-registry.service';
import { CanvasBlockRuntimeMappingService } from './canvas-block-runtime-mapping.service';
import { CanvasBlockValidationService } from './canvas-block-validation.service';
import { CanvasAuditService } from './canvas-audit.service';
import { CanvasAuthorizationService } from './canvas-authorization.service';
import { CanvasConnectionPolicyService } from './canvas-connection-policy.service';
import { CanvasDraftService } from './canvas-draft.service';
import { CanvasIoService } from './canvas-io.service';
import { CanvasLockService } from './canvas-lock.service';
import { CanvasModuleCatalogService } from './canvas-module-catalog.service';
import { CanvasModuleCompatibilityService } from './canvas-module-compatibility.service';
import { CanvasOperationService } from './canvas-operation.service';
import { CanvasPresentationService } from './canvas-presentation.service';
import { CanvasPublishingService } from './canvas-publishing.service';
import { CanvasSecurityPolicyService } from './canvas-security-policy.service';
import { CanvasSecurityReviewService } from './canvas-security-review.service';
import { CanvasSnapshotService } from './canvas-snapshot.service';
import { CanvasStepInspectorService } from './canvas-step-inspector.service';
import { CanvasSupportBundleService } from './canvas-support-bundle.service';
import { CanvasTestArtifactService } from './canvas-test-artifact.service';
import { CanvasTestRunService } from './canvas-test-run.service';
import { CanvasValidationPersistenceService } from './canvas-validation-persistence.service';
import { CanvasValidationService } from './canvas-validation.service';
import { CanvasVersioningService } from './canvas-versioning.service';
import { ConnectionRequirementsService } from './connection-requirements.service';
import { WorkflowCompilerService } from '../workflow-compiler/workflow-compiler.service';

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class CanvasController {
  constructor(
    private readonly blockRegistryService: CanvasBlockRegistryService,
    private readonly blockValidationService: CanvasBlockValidationService,
    private readonly connectionPolicyService: CanvasConnectionPolicyService,
    private readonly blockRuntimeMappingService: CanvasBlockRuntimeMappingService,
    private readonly draftService: CanvasDraftService,
    private readonly operationService: CanvasOperationService,
    private readonly ioService: CanvasIoService,
    private readonly lockService: CanvasLockService,
    private readonly validationService: CanvasValidationService,
    private readonly workflowCompilerService: WorkflowCompilerService,
    private readonly stepInspectorService: CanvasStepInspectorService,
    private readonly moduleCatalogService: CanvasModuleCatalogService,
    private readonly moduleCompatibilityService: CanvasModuleCompatibilityService,
    private readonly presentationService: CanvasPresentationService,
    private readonly connectionRequirementsService: ConnectionRequirementsService,
    private readonly snapshotService: CanvasSnapshotService,
    private readonly publishingService: CanvasPublishingService,
    private readonly validationPersistenceService: CanvasValidationPersistenceService,
    private readonly testRunService: CanvasTestRunService,
    private readonly testArtifactService: CanvasTestArtifactService,
    private readonly supportBundleService: CanvasSupportBundleService,
    private readonly versioningService: CanvasVersioningService,
    private readonly authorizationService: CanvasAuthorizationService,
    private readonly securityPolicyService: CanvasSecurityPolicyService,
    private readonly canvasAuditService: CanvasAuditService,
    private readonly securityReviewService: CanvasSecurityReviewService,
  ) {}

  @Get('canvas/block-types')
  @RequiredPermissions('canvas.view')
  listCanvasBlockTypes(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.blockRegistryService.listBlockTypes(context.access);
  }

  @Get('canvas/block-types/:code')
  @RequiredPermissions('canvas.view')
  getCanvasBlockType(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('code') code: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.blockRegistryService.getBlockType(code, context.access);
  }

  @Get('canvas/block-types/:code/schema')
  @RequiredPermissions('canvas.view')
  getCanvasBlockSchema(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('code') code: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.blockRegistryService.getBlockSchema(code, context.access);
  }

  @Get('canvas/modules')
  @RequiredPermissions('canvas.view')
  async listCanvasModuleCatalog(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Query('automation_id') automationId: string | undefined,
    @Query('draft_version_id') draftVersionId: string | undefined,
    @Query('context_node_id') contextNodeId: string | undefined,
    @Query('insert_position') insertPosition: string | undefined,
    @Query('mode') mode: string | undefined,
    @Query('q') query: string | undefined,
    @Query('source') source: string | undefined,
    @Query('status') status: string | undefined,
    @Query('runtime') runtime: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('cursor') cursor: string | undefined,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const draft = automationId
      ? await this.draftService.ensureDraft(
          context.actor,
          context.access,
          automationId,
        )
      : null;

    return this.moduleCatalogService.getCatalog({
      actor: context.actor,
      access: context.access,
      automationId,
      draftVersionId: draftVersionId ?? draft?.workflow.draft_version_id,
      workflow: draft?.workflow ?? null,
      contextNodeId,
      insertPosition: parseInsertPositionQuery(insertPosition),
      mode,
      query,
      source,
      status,
      runtime,
      limit: parsePositiveInteger(limit),
      cursor,
    });
  }

  @Get('canvas/modules/recommendations')
  @RequiredPermissions('canvas.view')
  async listCanvasModuleRecommendations(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Query('automation_id') automationId: string | undefined,
    @Query('context_node_id') contextNodeId: string | undefined,
  ) {
    if (!context?.actor || !context.access || !automationId) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'automation_id is required.',
      );
    }
    const draft = await this.draftService.ensureDraft(
      context.actor,
      context.access,
      automationId,
    );
    const catalog = await this.moduleCatalogService.getCatalog({
      actor: context.actor,
      access: context.access,
      automationId,
      workflow: draft.workflow,
      contextNodeId,
      mode: 'recommended',
    });
    return { recommended: catalog.recommended };
  }

  @Get('canvas/modules/:moduleCode')
  @RequiredPermissions('canvas.view')
  async getCanvasModuleDetail(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('moduleCode') moduleCode: string,
    @Query('automation_id') automationId: string | undefined,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const draft = automationId
      ? await this.draftService.ensureDraft(
          context.actor,
          context.access,
          automationId,
        )
      : null;
    return this.moduleCatalogService.getDetail({
      access: context.access,
      moduleCode,
      workflow: draft?.workflow ?? null,
    });
  }

  @Post('canvas/modules/:moduleCode/compatibility-check')
  @HttpCode(200)
  @RequiredPermissions('canvas.view')
  async checkCanvasModuleCompatibility(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('moduleCode') moduleCode: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const input = parseCompatibilityRequest(body);
    if (!input.automation_id) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'automation_id is required.',
      );
    }
    const draft = await this.draftService.ensureDraft(
      context.actor,
      context.access,
      input.automation_id,
    );
    const block = this.blockRegistryService.getBlockType(
      moduleCode,
      context.access,
    );
    return this.moduleCompatibilityService.check({
      access: context.access,
      workflow: draft.workflow,
      block,
      insert: {
        position: input.insert.position,
        source_node_id: input.insert.source_node_id,
        target_node_id: input.insert.target_node_id,
        source_handle: input.insert.source_handle,
        target_handle: input.insert.target_handle,
      },
    });
  }

  @Post('canvas/validate-block')
  @HttpCode(200)
  @RequiredPermissions('canvas.view')
  validateCanvasBlock(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const input = parseValidateBlockRequest(body);

    return this.blockValidationService.validateBlock({
      access: context.access,
      ...input,
    });
  }

  @Post('canvas/validate-connection')
  @HttpCode(200)
  @RequiredPermissions('canvas.view')
  validateCanvasConnection(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const input = parseValidateConnectionRequest(body);

    return this.connectionPolicyService.validateConnection({
      access: context.access,
      ...input,
    });
  }

  @Post('canvas/preview-block')
  @HttpCode(200)
  @RequiredPermissions('canvas.view')
  previewCanvasBlock(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.blockRuntimeMappingService.previewBlock({
      access: context.access,
      blockCode: parseBlockCodeRequest(body),
    });
  }

  @Post('canvas/test-block')
  @HttpCode(200)
  @RequiredPermissions('canvas.view')
  testCanvasBlock(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.blockRuntimeMappingService.testBlock({
      access: context.access,
      blockCode: parseBlockCodeRequest(body),
    });
  }

  @Get('automations/:automationId/canvas')
  @RequiredPermissions('canvas.view')
  getCanvasDraft(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.draftService.getDraftResponse(
      context.actor,
      context.access,
      automationId,
    );
  }

  @Get('automations/:automationId/canvas/security/context')
  @RequiredPermissions('canvas.view')
  getCanvasSecurityContext(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
  ): Promise<CanvasSecurityContext> {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.authorizationService.buildContext({
      actor: context.actor,
      access: context.access,
      automationId,
    });
  }

  @Get('automations/:automationId/canvas/security/policies')
  @RequiredPermissions('canvas.view')
  listCanvasSecurityPolicies(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
  ): Promise<readonly CanvasSecurityPolicy[]> {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.securityPolicyService.listPolicies(
      context.access,
      automationId,
    );
  }

  @Post('automations/:automationId/canvas/security/check-action')
  @HttpCode(200)
  @RequiredPermissions('canvas.view')
  checkCanvasSecurityAction(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.authorizationService.checkAction({
      actor: context.actor,
      access: context.access,
      automationId,
      request: parseCanvasSecurityCheckRequest(body),
    });
  }

  @Post('automations/:automationId/canvas/security/request-override')
  @HttpCode(200)
  @RequiredPermissions('canvas.policy_override')
  requestCanvasPolicyOverride(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.securityReviewService.requestOverride({
      actor: context.actor,
      access: context.access,
      automationId,
      request: parseCanvasPolicyOverrideRequest(body),
    });
  }

  @Post('automations/:automationId/canvas/security/approve-override')
  @HttpCode(200)
  @RequiredPermissions('canvas.security_review')
  approveCanvasPolicyOverride(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.securityReviewService.approveOverride({
      actor: context.actor,
      access: context.access,
      automationId,
      request: parseCanvasPolicyOverrideDecisionRequest(body),
    });
  }

  @Post('automations/:automationId/canvas/security/reject-override')
  @HttpCode(200)
  @RequiredPermissions('canvas.security_review')
  rejectCanvasPolicyOverride(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.securityReviewService.rejectOverride({
      actor: context.actor,
      access: context.access,
      automationId,
      request: parseCanvasPolicyOverrideDecisionRequest(body),
    });
  }

  @Get('automations/:automationId/canvas/audit')
  @RequiredPermissions('canvas.audit_read')
  async listCanvasAuditEvents(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
  ): Promise<CanvasAuditListResponse> {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return {
      events: await this.canvasAuditService.list(context.access, automationId, {
        from: optionalString(from),
        to: optionalString(to),
      }),
    };
  }

  @Get('automations/:automationId/canvas/audit/:eventId')
  @RequiredPermissions('canvas.audit_read')
  getCanvasAuditEvent(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('eventId') eventId: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.canvasAuditService.get(context.access, automationId, eventId);
  }

  @Post('automations/:automationId/canvas/audit/export')
  @HttpCode(200)
  @RequiredPermissions('canvas.audit_export')
  async exportCanvasAuditEvents(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ): Promise<CanvasAuditExportResponse> {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const decision = await this.authorizationService.authorizeEndpoint({
      actor: context.actor,
      access: context.access,
      automationId,
      endpoint: 'audit-export',
    });
    await this.authorizationService.assertAllowed({
      actor: context.actor,
      access: context.access,
      automationId,
      decision,
      ...requestMeta(request),
    });
    return this.canvasAuditService.export(
      context.access,
      automationId,
      parseCanvasAuditExportRequest(body),
    );
  }

  @Get('automations/:automationId/canvas/audit/hash-chain/status')
  @RequiredPermissions('canvas.audit_read')
  hashCanvasAuditChainStatus(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
  ): Promise<CanvasAuditHashChainStatusResponse> {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.canvasAuditService.hashChainStatus(
      context.access,
      automationId,
    );
  }

  @Get('automations/:automationId/canvas/presentation')
  @RequiredPermissions('canvas.view')
  getCanvasPresentation(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Query('mode') mode: string | undefined,
    @Query('locale') locale: string | undefined,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.presentationService.getPresentation({
      actor: context.actor,
      access: context.access,
      automationId,
      requestedMode: mode,
      locale,
    });
  }

  @Get('automations/:automationId/canvas/suggestions')
  @RequiredPermissions('canvas.view')
  getCanvasSuggestions(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Query('contextNodeId') contextNodeId: string | undefined,
    @Query('locale') locale: string | undefined,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.presentationService.getSuggestions({
      actor: context.actor,
      access: context.access,
      automationId,
      contextNodeId,
      locale,
    });
  }

  @Post('automations/:automationId/canvas/suggestions/:suggestionId/apply')
  @HttpCode(200)
  @RequiredPermissions('canvas.edit')
  async applyCanvasSuggestion(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('suggestionId') suggestionId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    const input = parseCanvasSuggestionApplyRequest(body);
    const suggestions = await this.presentationService.getSuggestions({
      actor: context.actor,
      access: context.access,
      automationId,
      contextNodeId: input.context_node_id,
      includeOperations: true,
    });
    const suggestion = suggestions.find((item) => item.id === suggestionId);
    if (!suggestion) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        404,
        'Canvas suggestion was not found.',
      );
    }
    if (suggestion.validation_issue_id) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        409,
        'Validation suggestions must be applied through validation issue fixes.',
        { validation_issue_id: suggestion.validation_issue_id },
      );
    }
    if (!suggestion.proposed_operation) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        422,
        'Canvas suggestion has no operation to apply.',
      );
    }
    if (suggestion.requires_confirmation && input.confirmed_by_user !== true) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        409,
        'Canvas suggestion requires user confirmation.',
        { suggestion_id: suggestion.id },
      );
    }

    const state = await this.draftService.getDraftResponse(
      context.actor,
      context.access,
      automationId,
    );
    const response = await this.operationService.applyOperations(
      context.actor,
      context.access,
      automationId,
      {
        draft_id: state.draft_id,
        expected_revision: state.revision,
        base_hash: state.draft_hash,
        client_batch_id: `no_code_suggestion_${suggestion.id}`,
        operations: [
          {
            ...suggestion.proposed_operation,
            client_operation_id: `${suggestion.proposed_operation.client_operation_id}_${Date.now()}`,
            base_workflow_hash: state.workflow_hash,
            base_revision_counter: state.revision_counter,
          },
        ],
      },
      requestMeta(request),
    );

    return { ...response, suggestion };
  }

  @Get('automations/:automationId/canvas/version-state')
  @RequiredPermissions('canvas.view')
  getCanvasVersionState(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.versioningService.getVersionState(
      context.actor,
      context.access,
      automationId,
    );
  }

  @Post('automations/:automationId/canvas/drafts')
  @HttpCode(200)
  @RequiredPermissions('canvas.edit')
  openCanvasDraft(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.draftService.createOrOpenDraft(
      context.actor,
      context.access,
      automationId,
      parseCanvasDraftRequest(body),
    );
  }

  @Post('automations/:automationId/canvas/operations')
  @HttpCode(200)
  @RequiredPermissions('canvas.view')
  applyCanvasOperations(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.operationService.applyOperations(
      context.actor,
      context.access,
      automationId,
      parseCanvasOperationRequest(body),
      requestMeta(request),
    );
  }

  @Get('automations/:automationId/canvas/versions')
  @RequiredPermissions('canvas.view')
  listCanvasVersions(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Query('status') status: string | undefined,
    @Query('include_checkpoints') includeCheckpoints: string | undefined,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.versioningService.listVersions(context.access, automationId, {
      status: optionalString(status),
      include_checkpoints: parseBooleanQuery(includeCheckpoints),
      cursor: optionalString(cursor),
      limit: optionalNumber(limit),
    });
  }

  @Get('automations/:automationId/canvas/versions/compare')
  @RequiredPermissions('canvas.view')
  compareCanvasVersions(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Query('from') fromVersionId: string | undefined,
    @Query('to') toVersionId: string | undefined,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.versioningService.compareVersions(
      context.actor,
      context.access,
      automationId,
      expectString(fromVersionId, 'from'),
      expectString(toVersionId, 'to'),
    );
  }

  @Get(
    'automations/:automationId/canvas/versions/:versionId/runtime-projection',
  )
  @RequiredPermissions('canvas.view')
  getCanvasRuntimeProjection(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('versionId') versionId: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.versioningService.getRuntimeProjection(
      context.actor,
      context.access,
      automationId,
      versionId,
    );
  }

  @Get('automations/:automationId/canvas/versions/:versionId/export')
  @RequiredPermissions('canvas.view')
  exportCanvasVersion(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('versionId') versionId: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.versioningService.exportVersion(
      context.actor,
      context.access,
      automationId,
      versionId,
    );
  }

  @Post('automations/:automationId/canvas/versions/:versionId/restore-as-draft')
  @HttpCode(200)
  @RequiredPermissions('canvas.version.restore_as_draft')
  restoreCanvasVersionAsDraft(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('versionId') versionId: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.publishingService.restoreVersionAsDraft(
      context.actor,
      context.access,
      automationId,
      versionId,
    );
  }

  @Post('automations/:automationId/canvas/validate')
  @HttpCode(200)
  @RequiredPermissions('canvas.view_validation')
  async validateCanvasDraft(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    const draft = await this.draftService.ensureDraft(
      context.actor,
      context.access,
      automationId,
    );

    const input = parseCanvasValidateRequest(body);
    const mode = input.mode ?? input.validation_level ?? 'full';
    const validation = this.validationService.validateWorkflow(draft.workflow, {
      mode,
      reason: input.reason ?? 'manual_validate',
      scope: input.scope ?? 'draft',
      includeRuntimeChecks: input.include_runtime_checks,
    });

    await this.validationPersistenceService.persistRun({
      actor: context.actor,
      access: context.access,
      automationId,
      draftId: draft.id,
      revision: draft.revision_counter,
      result: validation,
      source: 'validate_endpoint',
    });

    return validation;
  }

  @Post('automations/:automationId/canvas/test-runs/validate')
  @HttpCode(200)
  @RequiredPermissions('canvas.test.validate')
  async createCanvasValidationTestRun(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.testRunService.start(
      context.actor,
      context.access,
      automationId,
      parseCanvasTestRunRequest(body, 'validation_only'),
    );
  }

  @Post('automations/:automationId/canvas/test-runs/test-step')
  @HttpCode(200)
  @RequiredPermissions('canvas.test.step')
  async createCanvasStepTestRun(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.testRunService.start(
      context.actor,
      context.access,
      automationId,
      parseCanvasTestRunRequest(body, 'test_selected_step'),
    );
  }

  @Post('automations/:automationId/canvas/test-runs/test-until-step')
  @HttpCode(200)
  @RequiredPermissions('canvas.test.step')
  async createCanvasUntilStepTestRun(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.testRunService.start(
      context.actor,
      context.access,
      automationId,
      parseCanvasTestRunRequest(body, 'test_until_selected_step'),
    );
  }

  @Post('automations/:automationId/canvas/test-runs/test-branch')
  @HttpCode(200)
  @RequiredPermissions('canvas.test.branch')
  async createCanvasBranchTestRun(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.testRunService.start(
      context.actor,
      context.access,
      automationId,
      parseCanvasTestRunRequest(body, 'test_branch'),
    );
  }

  @Post('automations/:automationId/canvas/test-runs/test-loop')
  @HttpCode(200)
  @RequiredPermissions('canvas.test.loop')
  async createCanvasLoopTestRun(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.testRunService.start(
      context.actor,
      context.access,
      automationId,
      parseCanvasTestRunRequest(body, 'test_loop_sample'),
    );
  }

  @Post('automations/:automationId/canvas/test-runs/dry-run')
  @HttpCode(200)
  @RequiredPermissions('canvas.test.dry_run')
  async createCanvasDryRun(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.testRunService.start(
      context.actor,
      context.access,
      automationId,
      parseCanvasTestRunRequest(body, 'dry_run_full'),
    );
  }

  @Get('automations/:automationId/canvas/test-runs/:testRunId')
  @RequiredPermissions('canvas.test.view_history')
  getCanvasTestRun(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('testRunId') testRunId: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.testRunService.getRun(
      context.actor,
      context.access,
      automationId,
      testRunId,
    );
  }

  @Get('automations/:automationId/canvas/test-runs/:testRunId/steps')
  @RequiredPermissions('canvas.test.view_history')
  listCanvasTestRunSteps(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('testRunId') testRunId: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.testRunService.listSteps(
      context.access,
      automationId,
      testRunId,
      context.actor,
    );
  }

  @Get('automations/:automationId/canvas/test-runs/:testRunId/steps/:nodeId')
  @RequiredPermissions('canvas.test.view_history')
  getCanvasTestRunStep(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('testRunId') testRunId: string,
    @Param('nodeId') nodeId: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.testRunService.getStep(
      context.access,
      automationId,
      testRunId,
      nodeId,
      context.actor,
    );
  }

  @Post('automations/:automationId/canvas/test-runs/:testRunId/cancel')
  @HttpCode(200)
  @RequiredPermissions('canvas.test.cancel')
  cancelCanvasTestRun(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('testRunId') testRunId: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.testRunService.cancel(
      context.actor,
      context.access,
      automationId,
      testRunId,
    );
  }

  @Get('automations/:automationId/canvas/test-runs/:testRunId/artifacts')
  @RequiredPermissions('canvas.test.view_redacted')
  listCanvasTestArtifacts(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('testRunId') testRunId: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.testArtifactService.listArtifacts(
      context.actor,
      context.access,
      automationId,
      testRunId,
    );
  }

  @Get('automations/:automationId/canvas/test-runs/:testRunId/support-bundle')
  @RequiredPermissions('support.bundle.create')
  getCanvasTestSupportBundle(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('testRunId') testRunId: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    return this.supportBundleService.buildBundle(
      context.actor,
      context.access,
      automationId,
      testRunId,
    );
  }

  @Post('automations/:automationId/canvas/operations/preview')
  @HttpCode(200)
  @RequiredPermissions('canvas.view_validation')
  async previewCanvasOperations(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ): Promise<CanvasOperationPreviewResponse> {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    const response = await this.operationService.previewOperations(
      context.actor,
      context.access,
      automationId,
      parseCanvasOperationRequest(body),
    );

    await this.validationPersistenceService.persistRun({
      actor: context.actor,
      access: context.access,
      automationId,
      draftId: response.draft_id ?? null,
      revision: response.revision_counter,
      result: response.validation,
      source: 'operation_preview',
    });

    return response;
  }

  @Post('automations/:automationId/canvas/nodes/:nodeId/validate-config')
  @HttpCode(200)
  @RequiredPermissions('canvas.view_validation')
  async validateCanvasNodeConfig(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('nodeId') nodeId: string,
    @Body() body: unknown,
  ): Promise<CanvasStepConfigValidationResponse> {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    const input = parseCanvasStepConfigValidationRequest(body);
    const draft = await this.draftService.ensureDraft(
      context.actor,
      context.access,
      automationId,
    );
    const node = draft.workflow.nodes.find((item) => item.id === nodeId);
    if (!node) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        404,
        'Canvas node was not found.',
      );
    }

    const workflow = {
      ...draft.workflow,
      nodes: draft.workflow.nodes.map((item) =>
        item.id === nodeId
          ? {
              ...item,
              config: input.config ?? item.config,
              input_bindings: input.input_bindings ?? item.input_bindings,
            }
          : item,
      ),
    };
    const validation = this.validationService.fieldLevelValidate(
      workflow,
      nodeId,
    );
    const fieldErrors = validation.issues
      .filter((issue) => issue.affected_node_id === nodeId && issue.field_path)
      .map((issue) => ({
        field_path: issue.field_path!,
        code: issue.code,
        message: issue.message,
      }));

    return {
      node_id: nodeId,
      valid: !validation.issues.some(
        (issue) =>
          issue.severity === 'error' || issue.severity === 'policy_block',
      ),
      field_errors: fieldErrors,
      affected_outputs: node.outputs.map((output) => output.key),
      validation,
    };
  }

  @Post('automations/:automationId/canvas/validation/issues/:issueId/explain')
  @HttpCode(200)
  @RequiredPermissions('canvas.view_validation')
  async explainCanvasValidationIssue(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('issueId') issueId: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    const issue = await this.validationPersistenceService.findIssue({
      access: context.access,
      automationId,
      issueId,
    });
    if (!issue) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        404,
        'Validation issue was not found.',
      );
    }

    const state = await this.draftService.getDraftResponse(
      context.actor,
      context.access,
      automationId,
    );
    return {
      ...this.validationService.explainIssue(issue),
      no_code: this.presentationService.toNoCodeValidationMessage(
        issue,
        state.workflow,
        'basic',
      ),
    };
  }

  @Post('automations/:automationId/canvas/validation/issues/:issueId/apply-fix')
  @HttpCode(200)
  @RequiredPermissions('canvas.edit')
  async applyCanvasValidationFix(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('issueId') issueId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    const input = parseCanvasApplySuggestedFixRequest(body);
    const draft = await this.draftService.ensureDraft(
      context.actor,
      context.access,
      automationId,
    );
    const validation = this.validationService.validateWorkflow(draft.workflow, {
      mode: 'full',
      reason: 'apply_suggested_fix',
    });
    const issue = validation.issues.find((item) => item.id === issueId);
    const fix = issue?.suggested_fixes?.find(
      (item) => item.id === input.suggested_fix_id,
    );

    if (!issue || !fix || !fix.operation_type || !fix.operation_payload) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        404,
        'Suggested fix was not found or cannot be applied automatically.',
      );
    }
    if (
      (fix.requires_confirmation || fix.sensitive || fix.destructive) &&
      input.confirmed_by_user !== true
    ) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        409,
        'Suggested fix requires user confirmation.',
        { issue_id: issueId, suggested_fix_id: fix.id },
      );
    }

    const preview = await this.operationService.previewOperations(
      context.actor,
      context.access,
      automationId,
      {
        draft_id: draft.id,
        expected_revision: draft.revision_counter,
        base_hash: draft.workflow_hash,
        operations: [
          {
            client_operation_id: `validation_fix_preview_${fix.id}`,
            operation_type: fix.operation_type,
            operation_payload: fix.operation_payload,
            base_workflow_hash: draft.workflow_hash,
            base_revision_counter: draft.revision_counter,
          },
        ],
      },
    );
    if (!preview.would_succeed) {
      throw new AppHttpException(
        'CANVAS_VALIDATION_FIX_BLOCKED',
        422,
        'Suggested fix preview did not pass validation.',
        { validation: preview.validation },
      );
    }

    const response = await this.operationService.applyOperations(
      context.actor,
      context.access,
      automationId,
      {
        draft_id: draft.id,
        expected_revision: draft.revision_counter,
        base_hash: draft.workflow_hash,
        client_batch_id: `validation_fix_${issueId}`,
        operations: [
          {
            client_operation_id: `validation_fix_${fix.id}_${Date.now()}`,
            operation_type: fix.operation_type,
            operation_payload: fix.operation_payload,
            base_workflow_hash: draft.workflow_hash,
            base_revision_counter: draft.revision_counter,
          },
        ],
      },
      requestMeta(request),
    );

    return {
      ...response,
      no_code: this.presentationService.toNoCodeValidationMessage(
        issue,
        response.workflow,
        'basic',
      ),
    };
  }

  @Post('automations/:automationId/canvas/snapshots')
  @HttpCode(200)
  @RequiredPermissions('canvas.edit')
  createCanvasSnapshot(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.snapshotService.createSnapshot(
      context.actor,
      context.access,
      automationId,
      parseCanvasSnapshotRequest(body),
    );
  }

  @Post('automations/:automationId/canvas/checkpoints')
  @HttpCode(200)
  @RequiredPermissions('canvas.checkpoint.create')
  createCanvasCheckpoint(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.versioningService.createCheckpoint(
      context.actor,
      context.access,
      automationId,
      parseCanvasSnapshotRequest(body),
    );
  }

  @Post('automations/:automationId/canvas/snapshots/:snapshotId/restore')
  @HttpCode(200)
  @RequiredPermissions('canvas.version.restore_as_draft')
  restoreCanvasSnapshot(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('snapshotId') snapshotId: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.snapshotService.restoreSnapshot(
      context.actor,
      context.access,
      automationId,
      snapshotId,
    );
  }

  @Post('automations/:automationId/canvas/publish/validate')
  @HttpCode(200)
  @RequiredPermissions('canvas.publish.validate')
  validateCanvasPublish(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    const input = parseCanvasPublishRequest(body);
    return this.versioningService.validatePublish(
      context.actor,
      context.access,
      automationId,
      {
        draft_id: input.draft_id,
        expected_revision: input.expected_revision,
      },
    );
  }

  @Post('automations/:automationId/canvas/publish')
  @HttpCode(200)
  @RequiredPermissions('canvas.publish')
  async publishCanvasDraft(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const meta = requestMeta(request);
    const decision = await this.authorizationService.authorizeEndpoint({
      actor: context.actor,
      access: context.access,
      automationId,
      endpoint: 'publish',
    });
    await this.authorizationService.assertAllowed({
      actor: context.actor,
      access: context.access,
      automationId,
      decision,
      ...meta,
    });

    return this.publishingService.publishDraft(
      context.actor,
      context.access,
      automationId,
      parseCanvasPublishRequest(body),
    );
  }

  @Post('automations/:automationId/canvas/rollback/impact')
  @HttpCode(200)
  @RequiredPermissions('canvas.version.view')
  getCanvasRollbackImpact(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    const payload = isRecord(body) ? body : {};
    return this.versioningService.rollbackImpact(
      context.actor,
      context.access,
      automationId,
      {
        rollback_type: parseRollbackType(
          payload.rollback_type ?? payload.rollbackType,
        ),
        target_version_id: optionalString(
          payload.target_version_id ?? payload.targetVersionId,
        ),
      },
    );
  }

  @Post('automations/:automationId/canvas/rollback')
  @HttpCode(200)
  @RequiredPermissions('canvas.version.rollback')
  async rollbackCanvasVersion(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const meta = requestMeta(request);
    const decision = await this.authorizationService.authorizeEndpoint({
      actor: context.actor,
      access: context.access,
      automationId,
      endpoint: 'rollback',
    });
    await this.authorizationService.assertAllowed({
      actor: context.actor,
      access: context.access,
      automationId,
      decision,
      ...meta,
    });

    return this.versioningService.rollback(
      context.actor,
      context.access,
      automationId,
      parseCanvasRollbackRequest(body),
    );
  }

  @Post('automations/:automationId/canvas/emergency-disable')
  @HttpCode(200)
  @RequiredPermissions('canvas.version.emergency_disable')
  async emergencyDisableCanvas(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const meta = requestMeta(request);
    const decision = await this.authorizationService.authorizeEndpoint({
      actor: context.actor,
      access: context.access,
      automationId,
      endpoint: 'emergency-disable',
    });
    await this.authorizationService.assertAllowed({
      actor: context.actor,
      access: context.access,
      automationId,
      decision,
      ...meta,
    });
    const payload = isRecord(body) ? body : {};
    return this.versioningService.emergencyDisable(
      context.actor,
      context.access,
      automationId,
      {
        reason: optionalString(payload.reason),
        idempotency_key: optionalString(
          payload.idempotency_key ?? payload.idempotencyKey,
        ),
      },
    );
  }

  @Post('automations/:automationId/canvas/compile-preview')
  @HttpCode(200)
  @RequiredPermissions('canvas.view_compile_preview')
  async previewCanvasCompile(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ): Promise<CompileResponse> {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const meta = requestMeta(request);
    const decision = await this.authorizationService.authorizeEndpoint({
      actor: context.actor,
      access: context.access,
      automationId,
      endpoint: 'compile-preview',
    });
    await this.authorizationService.assertAllowed({
      actor: context.actor,
      access: context.access,
      automationId,
      decision,
      ...meta,
    });

    await this.draftService.ensureDraft(
      context.actor,
      context.access,
      automationId,
    );

    return this.workflowCompilerService.compilePreview(
      context.actor,
      context.access,
      automationId,
      parseCompileRequest(body, 'preview'),
      meta,
    );
  }

  @Post('automations/:automationId/canvas/compile')
  @HttpCode(200)
  @RequiredPermissions('canvas.compile')
  async compileCanvasDraft(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ): Promise<CompileResponse> {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const meta = requestMeta(request);
    const decision = await this.authorizationService.authorizeEndpoint({
      actor: context.actor,
      access: context.access,
      automationId,
      endpoint: 'compile',
    });
    await this.authorizationService.assertAllowed({
      actor: context.actor,
      access: context.access,
      automationId,
      decision,
      ...meta,
    });

    return this.workflowCompilerService.compile(
      context.actor,
      context.access,
      automationId,
      parseCompileRequest(body, 'dry_run_compile'),
      meta,
    );
  }

  @Post('automations/:automationId/canvas/sync-runtime')
  @HttpCode(200)
  @RequiredPermissions('canvas.sync_runtime')
  async syncCanvasRuntime(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ): Promise<CompileResponse> {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const meta = requestMeta(request);
    const decision = await this.authorizationService.authorizeEndpoint({
      actor: context.actor,
      access: context.access,
      automationId,
      endpoint: 'sync-runtime',
    });
    await this.authorizationService.assertAllowed({
      actor: context.actor,
      access: context.access,
      automationId,
      decision,
      ...meta,
    });

    return this.workflowCompilerService.syncRuntime(
      context.actor,
      context.access,
      automationId,
      parseRuntimeSyncRequest(body),
      meta,
    );
  }

  @Get('automations/:automationId/runtime-binding')
  @RequiredPermissions('canvas.runtime.view')
  getRuntimeBinding(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
  ): Promise<RuntimeBindingDto | null> {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.workflowCompilerService.getRuntimeBinding(
      context.access,
      automationId,
    );
  }

  @Get('automations/:automationId/runtime/sync-status')
  @RequiredPermissions('canvas.runtime.view')
  getRuntimeSyncStatus(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Req() request: LexframeRequest,
  ): Promise<RuntimeSyncStatusResponse> {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.workflowCompilerService.getRuntimeSyncStatus(
      context.actor,
      context.access,
      automationId,
      requestMeta(request),
    );
  }

  @Post('automations/:automationId/runtime/pull')
  @HttpCode(200)
  @RequiredPermissions('canvas.runtime.pull')
  async pullRuntime(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ): Promise<RuntimePullResponse> {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const meta = requestMeta(request);
    const decision = await this.authorizationService.authorizeEndpoint({
      actor: context.actor,
      access: context.access,
      automationId,
      endpoint: 'runtime-pull',
    });
    await this.authorizationService.assertAllowed({
      actor: context.actor,
      access: context.access,
      automationId,
      decision,
      ...meta,
    });

    return this.workflowCompilerService.pullRuntime(
      context.actor,
      context.access,
      automationId,
      parseRuntimePullRequest(body),
      meta,
    );
  }

  @Post('automations/:automationId/runtime/import-preview')
  @HttpCode(200)
  @RequiredPermissions('canvas.runtime.import_preview')
  async previewRuntimeImport(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ): Promise<RuntimeImportPreviewResponse> {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const meta = requestMeta(request);
    const decision = await this.authorizationService.authorizeEndpoint({
      actor: context.actor,
      access: context.access,
      automationId,
      endpoint: 'runtime-import-preview',
    });
    await this.authorizationService.assertAllowed({
      actor: context.actor,
      access: context.access,
      automationId,
      decision,
      ...meta,
    });

    return this.workflowCompilerService.previewRuntimeImport(
      context.actor,
      context.access,
      automationId,
      parseRuntimeImportPreviewRequest(body),
      meta,
    );
  }

  @Post('automations/:automationId/runtime/import-apply')
  @HttpCode(200)
  @RequiredPermissions('canvas.runtime.import_apply')
  async applyRuntimeImport(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ): Promise<RuntimeImportApplyResponse> {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const meta = requestMeta(request);
    const decision = await this.authorizationService.authorizeEndpoint({
      actor: context.actor,
      access: context.access,
      automationId,
      endpoint: 'runtime-import-apply',
    });
    await this.authorizationService.assertAllowed({
      actor: context.actor,
      access: context.access,
      automationId,
      decision,
      ...meta,
    });

    return this.workflowCompilerService.applyRuntimeImport(
      context.actor,
      context.access,
      automationId,
      parseRuntimeImportApplyRequest(body),
      meta,
    );
  }

  @Post('automations/:automationId/runtime/import-reject')
  @HttpCode(200)
  @RequiredPermissions('canvas.runtime.reject_import')
  async rejectRuntimeImport(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ): Promise<RuntimeImportRejectResponse> {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const meta = requestMeta(request);
    const decision = await this.authorizationService.authorizeEndpoint({
      actor: context.actor,
      access: context.access,
      automationId,
      endpoint: 'runtime-import-reject',
    });
    await this.authorizationService.assertAllowed({
      actor: context.actor,
      access: context.access,
      automationId,
      decision,
      ...meta,
    });

    return this.workflowCompilerService.rejectRuntimeImport(
      context.actor,
      context.access,
      automationId,
      parseRuntimeImportRejectRequest(body),
      meta,
    );
  }

  @Post('automations/:automationId/runtime/overwrite')
  @HttpCode(200)
  @RequiredPermissions('canvas.runtime.overwrite')
  async overwriteRuntime(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ): Promise<RuntimeOverwriteResponse> {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const meta = requestMeta(request);
    const decision = await this.authorizationService.authorizeEndpoint({
      actor: context.actor,
      access: context.access,
      automationId,
      endpoint: 'runtime-overwrite',
    });
    await this.authorizationService.assertAllowed({
      actor: context.actor,
      access: context.access,
      automationId,
      decision,
      ...meta,
    });

    return this.workflowCompilerService.overwriteRuntime(
      context.actor,
      context.access,
      automationId,
      parseRuntimeOverwriteRequest(body),
      meta,
    );
  }

  @Get('automations/:automationId/compile-reports')
  @RequiredPermissions('canvas.view_validation')
  async listCompileReports(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
  ): Promise<CompileReportsResponse> {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return {
      reports: await this.workflowCompilerService.listCompileReports(
        context.access,
        automationId,
      ),
    };
  }

  @Get('automations/:automationId/compile-reports/:reportId')
  @RequiredPermissions('canvas.view_validation')
  getCompileReport(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('reportId') reportId: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.workflowCompilerService.getCompileReport(
      context.access,
      automationId,
      reportId,
    );
  }

  @Post('automations/:automationId/runtime/check-drift')
  @HttpCode(200)
  @RequiredPermissions('canvas.view_validation')
  checkRuntimeDrift(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Req() request: LexframeRequest,
  ): Promise<RuntimeDriftResponse> {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.workflowCompilerService.checkDrift(
      context.actor,
      context.access,
      automationId,
      requestMeta(request),
    );
  }

  @Post('automations/:automationId/runtime/pull-snapshot')
  @HttpCode(200)
  @RequiredPermissions('canvas.view_validation')
  pullRuntimeSnapshot(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
  ): Promise<RuntimeSnapshotResponse> {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.workflowCompilerService.pullSnapshot(
      context.actor,
      context.access,
      automationId,
    );
  }

  @Get('automations/:automationId/canvas/io')
  @RequiredPermissions('canvas.view')
  getCanvasIo(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.ioService.getIo(context.actor, context.access, automationId);
  }

  @Get('automations/:automationId/canvas/nodes/:nodeId/inspector')
  @RequiredPermissions('canvas.view')
  getStepInspector(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('nodeId') nodeId: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.stepInspectorService.getInspector(
      context.actor,
      context.access,
      automationId,
      nodeId,
    );
  }

  @Get('automations/:automationId/canvas/nodes/:nodeId/data-sources')
  @RequiredPermissions('canvas.view')
  listStepDataSources(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('nodeId') nodeId: string,
    @Query('input_key') inputKey: string | undefined,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    if (!inputKey) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'input_key is required.',
      );
    }

    return this.stepInspectorService.listDataSources(
      context.actor,
      context.access,
      automationId,
      nodeId,
      inputKey,
    );
  }

  @Post('automations/:automationId/canvas/nodes/:nodeId/test')
  @HttpCode(200)
  @RequiredPermissions('canvas.test.step')
  async testCanvasNode(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('nodeId') nodeId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    const draft = await this.draftService.ensureDraft(
      context.actor,
      context.access,
      automationId,
    );
    const legacyRequest = parseStepTestRequest(body);
    const mode =
      legacyRequest.mode === 'up_to_step'
        ? 'test_until_selected_step'
        : legacyRequest.mode === 'branch'
          ? 'test_branch'
          : 'test_selected_step';
    const response = await this.testRunService.start(
      context.actor,
      context.access,
      automationId,
      parseCanvasTestRunRequest(
        {
          draft_version_id: draft.id,
          mode,
          target_node_id: nodeId,
          input_mode:
            legacyRequest.sample_data_mode === 'pinned'
              ? 'pinned_upstream'
              : legacyRequest.sample_data_mode === 'manual'
                ? 'manual_fixture'
                : legacyRequest.sample_data_mode === 'mock'
                  ? 'schema_generated'
                  : 'use_current_bindings',
          policy: {
            allow_real_reads: true,
            allow_real_writes: false,
            allow_external_calls: false,
            allow_ai_calls: false,
            ai_mode: 'mock',
            max_loop_items: 5,
            timeout_seconds: 30,
          },
          redaction: {
            raw_input_visible: false,
            raw_output_visible: false,
            store_raw_payload: false,
          },
        },
        mode,
      ),
    );
    return this.testRunService.compatibilityStepResult(response, nodeId);
  }

  @Get(
    'automations/:automationId/canvas/nodes/:nodeId/inputs/:inputKey/sources',
  )
  @RequiredPermissions('canvas.view')
  listCanvasInputSources(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('nodeId') nodeId: string,
    @Param('inputKey') inputKey: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.ioService.listSources(
      context.actor,
      context.access,
      automationId,
      nodeId,
      inputKey,
    );
  }

  @Post('automations/:automationId/canvas/bindings/validate')
  @HttpCode(200)
  @RequiredPermissions('canvas.view')
  validateCanvasBinding(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.ioService.validateBinding(
      context.actor,
      context.access,
      automationId,
      body,
    );
  }

  @Get(
    'automations/:automationId/canvas/nodes/:nodeId/outputs/:outputKey/sample',
  )
  @RequiredPermissions('canvas.view')
  getCanvasSampleOutput(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('nodeId') nodeId: string,
    @Param('outputKey') outputKey: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.ioService.getSampleOutput(
      context.actor,
      context.access,
      automationId,
      nodeId,
      outputKey,
    );
  }

  @Post(
    'automations/:automationId/canvas/nodes/:nodeId/outputs/:outputKey/pinned-data',
  )
  @HttpCode(200)
  @RequiredPermissions('canvas.edit')
  pinCanvasSampleOutput(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('nodeId') nodeId: string,
    @Param('outputKey') outputKey: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.ioService.pinSampleData(
      context.actor,
      context.access,
      automationId,
      nodeId,
      outputKey,
      parseSampleDataId(body),
    );
  }

  @Delete(
    'automations/:automationId/canvas/nodes/:nodeId/outputs/:outputKey/pinned-data',
  )
  @RequiredPermissions('canvas.edit')
  unpinCanvasSampleOutput(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('nodeId') nodeId: string,
    @Param('outputKey') outputKey: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.ioService.unpinSampleData(
      context.actor,
      context.access,
      automationId,
      nodeId,
      outputKey,
    );
  }

  @Post('automations/:automationId/canvas/lock')
  @HttpCode(200)
  @RequiredPermissions('canvas.edit')
  async acquireCanvasLock(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const input = parseCanvasLockRequest(body);
    const draftId =
      input.draftId ??
      (
        await this.draftService.ensureDraft(
          context.actor,
          context.access,
          automationId,
        )
      ).id;

    return this.lockService.acquireLock(
      context.access,
      context.actor,
      automationId,
      { ...input, draftId },
    );
  }

  @Post('automations/:automationId/canvas/lock/heartbeat')
  @HttpCode(200)
  @RequiredPermissions('canvas.edit')
  async heartbeatCanvasLock(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const input = parseCanvasLockRequest(body);
    const draftId =
      input.draftId ??
      (
        await this.draftService.ensureDraft(
          context.actor,
          context.access,
          automationId,
        )
      ).id;

    return this.lockService.heartbeatLock(
      context.access,
      context.actor,
      automationId,
      { ...input, draftId },
    );
  }

  @Delete('automations/:automationId/canvas/lock')
  @RequiredPermissions('canvas.edit')
  async releaseCanvasLock(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const input = parseCanvasLockRequest(body);
    const draftId =
      input.draftId ??
      (
        await this.draftService.ensureDraft(
          context.actor,
          context.access,
          automationId,
        )
      ).id;

    return this.lockService.releaseLock(
      context.access,
      context.actor,
      automationId,
      { ...input, draftId },
    );
  }

  @Get('connections/requirements')
  @RequiredPermissions('canvas.connection_view')
  listConnectionRequirements(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Query('module_code') moduleCode: string | undefined,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.connectionRequirementsService.listRequirements({
      access: context.access,
      moduleCode,
    });
  }

  @Post('connections/requests')
  @HttpCode(200)
  @RequiredPermissions('canvas.connection_request')
  createConnectionRequest(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }
    const payload = isRecord(body) ? body : {};
    return this.connectionRequirementsService.createRequest({
      actor: context.actor,
      access: context.access,
      moduleCode:
        typeof payload.module_code === 'string'
          ? payload.module_code
          : typeof payload.moduleCode === 'string'
            ? payload.moduleCode
            : null,
      connectionType:
        typeof payload.connection_type === 'string'
          ? payload.connection_type
          : typeof payload.connectionType === 'string'
            ? payload.connectionType
            : null,
    });
  }

  @Get('modules')
  @RequiredPermissions('canvas.view')
  listCanvasModules(
    @LexframeRequestContext() requestContext: LexframeRequest['lexframe'],
    @Query('context') context: string | undefined,
    @Query('automation_id') automationId: string | undefined,
  ) {
    void automationId;
    if (!requestContext?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    if (context !== 'canvas') {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Only context=canvas is supported by this endpoint.',
      );
    }

    return this.blockRegistryService.listCanvasModules(requestContext.access);
  }
}

function parseBlockCodeRequest(body: unknown): string {
  if (!isRecord(body)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Canvas block request body must be an object.',
    );
  }

  return expectString(
    body.blockCode ?? body.block_code ?? body.code,
    'blockCode',
  );
}

function parseInsertPositionQuery(value: string | undefined) {
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
      return null;
  }
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseCompatibilityRequest(
  body: unknown,
): CanvasCompatibilityCheckRequest {
  if (!isRecord(body)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Canvas compatibility request body must be an object.',
    );
  }
  const insert = isRecord(body.insert) ? body.insert : {};
  return {
    automation_id:
      typeof body.automation_id === 'string'
        ? body.automation_id
        : typeof body.automationId === 'string'
          ? body.automationId
          : null,
    draft_version_id:
      typeof body.draft_version_id === 'string'
        ? body.draft_version_id
        : typeof body.draftVersionId === 'string'
          ? body.draftVersionId
          : null,
    insert: {
      position:
        parseInsertPositionQuery(
          typeof insert.position === 'string'
            ? insert.position
            : typeof insert.mode === 'string'
              ? insert.mode
              : undefined,
        ) ?? 'workflow_end',
      source_node_id:
        typeof insert.source_node_id === 'string'
          ? insert.source_node_id
          : typeof insert.sourceNodeId === 'string'
            ? insert.sourceNodeId
            : null,
      target_node_id:
        typeof insert.target_node_id === 'string'
          ? insert.target_node_id
          : typeof insert.targetNodeId === 'string'
            ? insert.targetNodeId
            : null,
      source_handle: parseRequestHandle(
        typeof insert.source_handle === 'string'
          ? insert.source_handle
          : typeof insert.sourceHandle === 'string'
            ? insert.sourceHandle
            : null,
      ),
      target_handle: parseRequestHandle(
        typeof insert.target_handle === 'string'
          ? insert.target_handle
          : typeof insert.targetHandle === 'string'
            ? insert.targetHandle
            : null,
      ),
    },
  };
}

function parseRequestHandle(
  value: string | null,
): CanvasCompatibilityCheckRequest['insert']['source_handle'] {
  return value as CanvasCompatibilityCheckRequest['insert']['source_handle'];
}

function parseValidateBlockRequest(body: unknown): {
  readonly blockCode: string;
  readonly targetNodeId?: string;
  readonly config?: Record<string, unknown>;
  readonly bindings?: readonly StepInputBinding[];
  readonly hasApprovalPath?: boolean;
} {
  if (!isRecord(body)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Canvas validate-block request body must be an object.',
    );
  }

  return {
    blockCode: expectString(
      body.blockCode ?? body.block_code ?? body.code,
      'blockCode',
    ),
    targetNodeId:
      typeof (body.targetNodeId ?? body.target_node_id) === 'string'
        ? ((body.targetNodeId ?? body.target_node_id) as string)
        : undefined,
    config: isRecord(body.config) ? body.config : undefined,
    bindings: Array.isArray(body.bindings)
      ? (body.bindings as readonly StepInputBinding[])
      : undefined,
    hasApprovalPath:
      typeof body.hasApprovalPath === 'boolean'
        ? body.hasApprovalPath
        : typeof body.has_approval_path === 'boolean'
          ? body.has_approval_path
          : undefined,
  };
}

function parseValidateConnectionRequest(body: unknown): {
  readonly sourceBlockCode: string;
  readonly sourceHandle: CanvasHandleCode;
  readonly targetBlockCode: string;
  readonly targetHandle: CanvasHandleCode;
  readonly edgeType?: CanvasEdgeType;
  readonly hasApprovalPath?: boolean;
} {
  if (!isRecord(body)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Canvas validate-connection request body must be an object.',
    );
  }

  return {
    sourceBlockCode: expectString(
      body.sourceBlockCode ?? body.source_block_code,
      'sourceBlockCode',
    ),
    sourceHandle: expectString(
      body.sourceHandle ?? body.source_handle,
      'sourceHandle',
    ) as CanvasHandleCode,
    targetBlockCode: expectString(
      body.targetBlockCode ?? body.target_block_code,
      'targetBlockCode',
    ),
    targetHandle: expectString(
      body.targetHandle ?? body.target_handle,
      'targetHandle',
    ) as CanvasHandleCode,
    edgeType:
      typeof (body.edgeType ?? body.edge_type) === 'string'
        ? ((body.edgeType ?? body.edge_type) as CanvasEdgeType)
        : undefined,
    hasApprovalPath:
      typeof body.hasApprovalPath === 'boolean'
        ? body.hasApprovalPath
        : typeof body.has_approval_path === 'boolean'
          ? body.has_approval_path
          : undefined,
  };
}

function parseCanvasOperationRequest(body: unknown): CanvasOperationRequest {
  if (!isRecord(body)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Canvas operation request body must be an object.',
    );
  }

  const rawOperations = Array.isArray(body.operations)
    ? body.operations
    : isRecord(body.operation)
      ? [body.operation]
      : [body];
  const operations = rawOperations.map(parseCanvasOperation);

  return {
    draft_id: optionalString(body.draft_id ?? body.draftId),
    expected_revision: optionalNumber(
      body.expected_revision ?? body.expectedRevision,
    ),
    base_hash: optionalString(body.base_hash ?? body.baseHash),
    client_batch_id: optionalString(body.client_batch_id ?? body.clientBatchId),
    operations,
  };
}

function parseCanvasSecurityCheckRequest(
  body: unknown,
): CanvasSecurityCheckRequest {
  if (!isRecord(body)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Canvas security check request body must be an object.',
    );
  }
  const action = requiredString(body.action, 'action');
  const payload = isRecord(body.payload) ? body.payload : undefined;
  const operationType =
    typeof (body.operation_type ?? body.operationType) === 'string'
      ? normalizeCanvasOperation(
          String(body.operation_type ?? body.operationType),
          payload ?? {},
        ).operation_type
      : undefined;
  return {
    action,
    resource:
      typeof body.resource === 'string'
        ? (body.resource as CanvasSecurityCheckRequest['resource'])
        : undefined,
    resource_id: optionalString(body.resource_id ?? body.resourceId),
    operation_type: operationType,
    payload,
    draft_version_id: optionalString(
      body.draft_version_id ?? body.draftVersionId,
    ),
    node_id: optionalString(body.node_id ?? body.nodeId),
    edge_id: optionalString(body.edge_id ?? body.edgeId),
  };
}

function parseCanvasPolicyOverrideRequest(
  body: unknown,
): CanvasPolicyOverrideRequest {
  if (!isRecord(body)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Canvas policy override request body must be an object.',
    );
  }
  return {
    violation_id: optionalString(body.violation_id ?? body.violationId),
    policy_code: requiredString(
      body.policy_code ?? body.policyCode,
      'policy_code',
    ),
    reason: requiredString(body.reason, 'reason'),
    requested_action: requiredString(
      body.requested_action ?? body.requestedAction,
      'requested_action',
    ),
    expires_at: optionalString(body.expires_at ?? body.expiresAt),
  };
}

function parseCanvasPolicyOverrideDecisionRequest(
  body: unknown,
): CanvasPolicyOverrideDecisionRequest {
  if (!isRecord(body)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Canvas policy override decision request body must be an object.',
    );
  }
  return {
    override_request_id: requiredString(
      body.override_request_id ?? body.overrideRequestId,
      'override_request_id',
    ),
    reason: requiredString(body.reason, 'reason'),
  };
}

function parseCanvasAuditExportRequest(body: unknown): {
  readonly from?: string | null;
  readonly to?: string | null;
  readonly format?: 'json' | 'jsonl';
} {
  const payload = isRecord(body) ? body : {};
  return {
    from: optionalString(payload.from),
    to: optionalString(payload.to),
    format:
      payload.format === 'jsonl' || payload.format === 'json'
        ? payload.format
        : 'json',
  };
}

function parseCanvasOperation(value: unknown): CanvasOperation {
  if (!isRecord(value)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Canvas operation must be an object.',
    );
  }
  const clientOperationId = expectString(
    value.client_operation_id ?? value.clientOperationId,
    'client_operation_id',
  );
  const rawType = expectString(
    value.operation_type ?? value.operationType ?? value.type,
    'operation_type',
  );
  const rawPayload = isRecord(value.operation_payload)
    ? value.operation_payload
    : isRecord(value.operationPayload)
      ? value.operationPayload
      : isRecord(value.payload)
        ? value.payload
        : {};
  const normalized = normalizeCanvasOperation(rawType, rawPayload);

  return {
    client_operation_id: clientOperationId,
    operation_type: normalized.operation_type,
    operation_payload: normalized.operation_payload,
    base_workflow_hash:
      typeof (value.base_workflow_hash ?? value.baseHash) === 'string'
        ? ((value.base_workflow_hash ?? value.baseHash) as string)
        : null,
    base_revision_counter:
      typeof (value.base_revision_counter ?? value.baseRevisionCounter) ===
      'number'
        ? ((value.base_revision_counter ?? value.baseRevisionCounter) as number)
        : null,
    idempotency_key: optionalString(
      value.idempotency_key ?? value.idempotencyKey,
    ),
  };
}

function normalizeCanvasOperation(
  type: string,
  payload: Record<string, unknown>,
): Pick<CanvasOperation, 'operation_type' | 'operation_payload'> {
  switch (type) {
    case 'workflow.input.add':
    case 'workflow.input.update':
      return {
        operation_type: 'UPSERT_WORKFLOW_INPUT',
        operation_payload: payload,
      };
    case 'workflow.input.delete':
      return {
        operation_type: 'DELETE_WORKFLOW_INPUT',
        operation_payload: payload,
      };
    case 'workflow.output.add':
    case 'workflow.output.update':
      return {
        operation_type: 'UPSERT_WORKFLOW_OUTPUT',
        operation_payload: payload,
      };
    case 'workflow.output.delete':
      return {
        operation_type: 'DELETE_WORKFLOW_OUTPUT',
        operation_payload: payload,
      };
    case 'workflow.metadata.update':
      return { operation_type: 'UPDATE_NODE', operation_payload: payload };
    case 'node.add':
    case 'branch.add':
    case 'loop.add':
    case 'approval.add':
    case 'error_handler.add':
    case 'group.add':
      if (
        typeof payload.module_code === 'string' ||
        typeof payload.moduleCode === 'string'
      ) {
        return {
          operation_type: 'ADD_NODE_FROM_MODULE',
          operation_payload: payload,
        };
      }
      return {
        operation_type: 'ADD_NODE',
        operation_payload: isRecord(payload.node)
          ? payload
          : { node: semanticNodePayload(payload) },
      };
    case 'node.update_display':
      return {
        operation_type: 'UPDATE_NODE',
        operation_payload: {
          node_id: payload.node_id ?? payload.nodeId,
          patch: {
            display_name: payload.display_name ?? payload.displayName,
            description: payload.description,
          },
        },
      };
    case 'node.update_config':
    case 'loop.update':
    case 'approval.update':
    case 'error_handler.update':
    case 'group.update':
      return {
        operation_type: 'UPDATE_NODE_CONFIG',
        operation_payload: payload,
      };
    case 'node.update_policy':
      return {
        operation_type: 'UPDATE_NODE_POLICY',
        operation_payload: payload,
      };
    case 'node.move':
    case 'layout.update':
      return { operation_type: 'MOVE_NODE', operation_payload: payload };
    case 'node.delete':
    case 'branch.delete':
    case 'loop.delete':
    case 'approval.delete':
    case 'error_handler.delete':
    case 'group.delete':
      return { operation_type: 'DELETE_NODE', operation_payload: payload };
    case 'node.duplicate':
      return { operation_type: 'DUPLICATE_NODE', operation_payload: payload };
    case 'edge.add':
      return {
        operation_type: 'ADD_EDGE',
        operation_payload: isRecord(payload.edge)
          ? payload
          : { edge: semanticEdgePayload(payload) },
      };
    case 'edge.delete':
      return { operation_type: 'DELETE_EDGE', operation_payload: payload };
    case 'edge.update_condition':
    case 'branch.update_condition':
      return { operation_type: 'UPDATE_CONDITION', operation_payload: payload };
    case 'edge.update_mapping':
      return { operation_type: 'UPDATE_EDGE', operation_payload: payload };
    case 'binding.set':
    case 'binding.batch_set':
      return {
        operation_type: 'UPSERT_INPUT_BINDING',
        operation_payload: payload,
      };
    case 'binding.clear':
      return {
        operation_type: 'DELETE_INPUT_BINDING',
        operation_payload: payload,
      };
    case 'snapshot.restore':
      return { operation_type: 'SNAPSHOT_RESTORE', operation_payload: payload };
    case 'runtime.import_as_draft':
      return {
        operation_type: 'RUNTIME_IMPORT_AS_DRAFT',
        operation_payload: payload,
      };
    default:
      return {
        operation_type: type as CanvasOperation['operation_type'],
        operation_payload: payload,
      };
  }
}

function semanticNodePayload(payload: Record<string, unknown>) {
  return {
    id:
      optionalString(payload.node_id ?? payload.nodeId) ?? `node_${Date.now()}`,
    type: semanticNodeType(payload.node_type ?? payload.nodeType),
    module_code: payload.module_code ?? payload.moduleCode ?? null,
    display_name:
      payload.display_name ??
      payload.displayName ??
      payload.title ??
      'New node',
    description: payload.description ?? null,
    layout: {
      x: isRecord(payload.position) ? payload.position.x : payload.x,
      y: isRecord(payload.position) ? payload.position.y : payload.y,
    },
  };
}

function semanticNodeType(value: unknown) {
  switch (value) {
    case 'legal_action':
      return 'legalAction';
    case 'ai_action':
      return 'aiAction';
    case 'error_handler':
      return 'errorHandler';
    default:
      return typeof value === 'string' && value.length > 0
        ? value
        : 'legalAction';
  }
}

function semanticEdgePayload(payload: Record<string, unknown>) {
  return {
    id:
      optionalString(payload.edge_id ?? payload.edgeId) ?? `edge_${Date.now()}`,
    source_node_id: payload.source_node_id ?? payload.sourceNodeId,
    target_node_id: payload.target_node_id ?? payload.targetNodeId,
    source_handle:
      payload.source_handle ?? payload.sourceHandle ?? 'main_output',
    target_handle:
      payload.target_handle ?? payload.targetHandle ?? 'main_input',
    edge_type: payload.edge_type ?? payload.edgeType ?? 'control_flow',
    label: payload.label ?? null,
  };
}

function parseCanvasDraftRequest(body: unknown): CanvasDraftRequest {
  const payload = isRecord(body) ? body : {};
  return {
    source:
      typeof payload.source === 'string'
        ? (payload.source as CanvasDraftRequest['source'])
        : undefined,
    source_version_id: optionalString(
      payload.source_version_id ?? payload.sourceVersionId,
    ),
    idempotency_key: optionalString(
      payload.idempotency_key ?? payload.idempotencyKey,
    ),
  };
}

function parseCanvasSnapshotRequest(body: unknown): CanvasSnapshotRequest {
  const payload = isRecord(body) ? body : {};
  return {
    draft_id: optionalString(payload.draft_id ?? payload.draftId),
    reason: optionalString(payload.reason),
    note: optionalString(payload.note),
    checkpoint_name: optionalString(
      payload.checkpoint_name ?? payload.checkpointName,
    ),
    checkpoint_description: optionalString(
      payload.checkpoint_description ?? payload.checkpointDescription,
    ),
    checkpoint_kind: parseCheckpointKind(
      payload.checkpoint_kind ?? payload.checkpointKind,
    ),
    is_named:
      typeof (payload.is_named ?? payload.isNamed) === 'boolean'
        ? ((payload.is_named ?? payload.isNamed) as boolean)
        : undefined,
  };
}

function parseCanvasPublishRequest(body: unknown): CanvasPublishRequest {
  const payload = isRecord(body) ? body : {};
  return {
    draft_id: optionalString(payload.draft_id ?? payload.draftId),
    expected_revision: optionalNumber(
      payload.expected_revision ?? payload.expectedRevision,
    ),
    change_note: optionalString(payload.change_note ?? payload.changeNote),
    compile_preview_required:
      typeof (
        payload.compile_preview_required ?? payload.compilePreviewRequired
      ) === 'boolean'
        ? ((payload.compile_preview_required ??
            payload.compilePreviewRequired) as boolean)
        : undefined,
    version_name: optionalString(payload.version_name ?? payload.versionName),
    version_description: optionalString(
      payload.version_description ?? payload.versionDescription,
    ),
    sync_runtime:
      typeof (payload.sync_runtime ?? payload.syncRuntime) === 'boolean'
        ? ((payload.sync_runtime ?? payload.syncRuntime) as boolean)
        : undefined,
    idempotency_key: optionalString(
      payload.idempotency_key ?? payload.idempotencyKey,
    ),
    typed_confirmation: optionalString(
      payload.typed_confirmation ?? payload.typedConfirmation,
    ),
  };
}

function parseCanvasRollbackRequest(body: unknown): CanvasRollbackRequest {
  if (!isRecord(body)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Canvas rollback request body must be an object.',
    );
  }
  return {
    rollback_type: parseRollbackType(body.rollback_type ?? body.rollbackType),
    target_version_id: optionalString(
      body.target_version_id ?? body.targetVersionId,
    ),
    reason: expectString(body.reason, 'reason'),
    confirm_impact: (body.confirm_impact ?? body.confirmImpact) === true,
    expected_active_version_id: optionalString(
      body.expected_active_version_id ?? body.expectedActiveVersionId,
    ),
    idempotency_key: expectString(
      body.idempotency_key ?? body.idempotencyKey,
      'idempotency_key',
    ),
    impact_policy: parseImpactPolicy(body.impact_policy ?? body.impactPolicy),
  };
}

function parseRollbackType(
  value: unknown,
): CanvasRollbackRequest['rollback_type'] {
  switch (value) {
    case 'restore_as_draft':
    case 'publish_previous_version':
    case 'runtime_binding_rollback':
    case 'emergency_disable':
      return value;
    default:
      return 'publish_previous_version';
  }
}

function parseImpactPolicy(
  value: unknown,
): CanvasRollbackRequest['impact_policy'] {
  switch (value) {
    case 'cancel_queued':
    case 'keep_queued':
    case 'switch_queued':
      return value;
    default:
      return undefined;
  }
}

function parseCheckpointKind(
  value: unknown,
): CanvasSnapshotRequest['checkpoint_kind'] {
  switch (value) {
    case 'manual':
    case 'auto':
    case 'system':
    case 'publish':
      return value;
    default:
      return undefined;
  }
}

function parseCompileRequest(
  body: unknown,
  defaultMode: NonNullable<CompileRequest['mode']>,
): CompileRequest {
  const payload = isRecord(body) ? body : {};
  const mode = parseCompilerMode(payload.mode) ?? defaultMode;
  return {
    mode,
    target_runtime: 'activepieces',
    draft_version_id:
      optionalString(payload.draft_version_id ?? payload.draftVersionId) ??
      undefined,
    published_version_id:
      optionalString(
        payload.published_version_id ?? payload.publishedVersionId,
      ) ?? undefined,
    idempotency_key:
      optionalString(payload.idempotency_key ?? payload.idempotencyKey) ??
      undefined,
    options: {
      include_advanced_report:
        typeof (
          payload.include_advanced_report ?? payload.includeAdvancedReport
        ) === 'boolean'
          ? ((payload.include_advanced_report ??
              payload.includeAdvancedReport) as boolean)
          : true,
      validate_only:
        typeof (payload.validate_only ?? payload.validateOnly) === 'boolean'
          ? ((payload.validate_only ?? payload.validateOnly) as boolean)
          : undefined,
      allow_runtime_overwrite:
        typeof (
          payload.allow_runtime_overwrite ?? payload.allowRuntimeOverwrite
        ) === 'boolean'
          ? ((payload.allow_runtime_overwrite ??
              payload.allowRuntimeOverwrite) as boolean)
          : undefined,
      publish_activepieces_flow:
        typeof (
          payload.publish_activepieces_flow ?? payload.publishActivepiecesFlow
        ) === 'boolean'
          ? ((payload.publish_activepieces_flow ??
              payload.publishActivepiecesFlow) as boolean)
          : undefined,
    },
  };
}

function parseRuntimeSyncRequest(body: unknown): RuntimeSyncRequest {
  const payload = isRecord(body) ? body : {};
  return {
    compile_report_id: optionalString(
      payload.compile_report_id ?? payload.compileReportId,
    ),
    draft_version_id: optionalString(
      payload.draft_version_id ?? payload.draftVersionId,
    ),
    target_runtime: 'activepieces',
    publish_after_sync:
      typeof (payload.publish_after_sync ?? payload.publishAfterSync) ===
      'boolean'
        ? ((payload.publish_after_sync ?? payload.publishAfterSync) as boolean)
        : undefined,
    overwrite_runtime_changes:
      typeof (
        payload.overwrite_runtime_changes ?? payload.overwriteRuntimeChanges
      ) === 'boolean'
        ? ((payload.overwrite_runtime_changes ??
            payload.overwriteRuntimeChanges) as boolean)
        : undefined,
    idempotency_key: optionalString(
      payload.idempotency_key ?? payload.idempotencyKey,
    ),
  };
}

function parseRuntimePullRequest(body: unknown): RuntimePullRequest {
  const payload = isRecord(body) ? body : {};
  const source = payload.source;
  return {
    source:
      source === 'manual_pull' ||
      source === 'after_builder_close' ||
      source === 'before_run' ||
      source === 'scheduled_reconcile' ||
      source === 'webhook_hint'
        ? source
        : undefined,
    reason: optionalString(payload.reason),
  };
}

function parseRuntimeImportPreviewRequest(
  body: unknown,
): RuntimeImportPreviewRequest {
  const payload = isRecord(body) ? body : {};
  const mode = payload.mode;
  return {
    snapshot_id:
      optionalString(payload.snapshot_id ?? payload.snapshotId) ?? '',
    mode: mode === 'admin_review' ? 'admin_review' : 'safe',
  };
}

function parseRuntimeImportApplyRequest(
  body: unknown,
): RuntimeImportApplyRequest {
  const payload = isRecord(body) ? body : {};
  return {
    draft_candidate_id:
      optionalString(payload.draft_candidate_id ?? payload.draftCandidateId) ??
      '',
    resolution: 'create_new_draft',
    comment: optionalString(payload.comment),
  };
}

function parseRuntimeImportRejectRequest(
  body: unknown,
): RuntimeImportRejectRequest {
  const payload = isRecord(body) ? body : {};
  return {
    snapshot_id: optionalString(payload.snapshot_id ?? payload.snapshotId),
    draft_candidate_id: optionalString(
      payload.draft_candidate_id ?? payload.draftCandidateId,
    ),
    reason: optionalString(payload.reason),
  };
}

function parseRuntimeOverwriteRequest(body: unknown): RuntimeOverwriteRequest {
  const payload = isRecord(body) ? body : {};
  return {
    version_id: optionalString(payload.version_id ?? payload.versionId),
    confirm_discard_runtime_changes:
      (payload.confirm_discard_runtime_changes ??
        payload.confirmDiscardRuntimeChanges) === true,
  };
}

function parseCompilerMode(value: unknown): CompileRequest['mode'] | null {
  switch (value) {
    case 'preview':
    case 'dry_run_compile':
    case 'sync_draft_to_runtime':
    case 'publish_and_sync':
    case 'repair_runtime_projection':
      return value;
    default:
      return null;
  }
}

function parseCanvasValidateRequest(body: unknown): CanvasValidateRequest {
  const payload = isRecord(body) ? body : {};
  const level =
    payload.mode ?? payload.validation_level ?? payload.validationLevel;
  return {
    draft_id: optionalString(payload.draft_id ?? payload.draftId),
    draft_version_id: optionalString(
      payload.draft_version_id ?? payload.draftVersionId,
    ),
    mode: parseValidationMode(level),
    validation_level: parseValidationMode(level),
    scope: parseValidationScope(payload.scope),
    reason: optionalString(payload.reason),
    include_runtime_checks:
      typeof (
        payload.include_runtime_checks ?? payload.includeRuntimeChecks
      ) === 'boolean'
        ? ((payload.include_runtime_checks ??
            payload.includeRuntimeChecks) as boolean)
        : undefined,
  };
}

function parseCanvasTestRunRequest(
  body: unknown,
  defaultMode: CanvasTestMode,
): CanvasTestRunRequest {
  if (!isRecord(body)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Canvas test run request body must be an object.',
    );
  }
  const policy = parseCanvasTestPolicy(body.policy);
  const redaction = parseCanvasTestRedaction(body.redaction);
  return {
    draft_version_id: expectString(
      body.draft_version_id ?? body.draftVersionId,
      'draft_version_id',
    ),
    mode: parseCanvasTestMode(body.mode, defaultMode),
    target_node_id: optionalString(
      body.target_node_id ?? body.targetNodeId ?? body.node_id ?? body.nodeId,
    ),
    target_branch_id: optionalString(
      body.target_branch_id ?? body.targetBranchId,
    ),
    input_mode: parseCanvasTestInputMode(body.input_mode ?? body.inputMode),
    fixture_id: optionalString(body.fixture_id ?? body.fixtureId),
    previous_test_run_id: optionalString(
      body.previous_test_run_id ?? body.previousTestRunId,
    ),
    policy,
    redaction,
  };
}

function parseCanvasTestMode(
  value: unknown,
  fallback: CanvasTestMode,
): CanvasTestMode {
  switch (value) {
    case 'validation_only':
    case 'test_selected_step':
    case 'test_until_selected_step':
    case 'test_branch':
    case 'test_loop_sample':
    case 'test_subworkflow_contract':
    case 'dry_run_full':
    case 'replay_from_previous_run':
      return value;
    default:
      return fallback;
  }
}

function parseCanvasTestInputMode(value: unknown): CanvasTestInputMode {
  switch (value) {
    case 'manual_fixture':
    case 'schema_generated':
    case 'pinned_upstream':
    case 'previous_test_run':
      return value;
    default:
      return 'use_current_bindings';
  }
}

function parseCanvasTestPolicy(value: unknown): CanvasTestRunPolicy {
  const payload = isRecord(value) ? value : {};
  return {
    allow_real_reads:
      typeof payload.allow_real_reads === 'boolean'
        ? payload.allow_real_reads
        : typeof payload.allowRealReads === 'boolean'
          ? payload.allowRealReads
          : true,
    allow_real_writes: false,
    allow_external_calls: false,
    allow_ai_calls:
      typeof payload.allow_ai_calls === 'boolean'
        ? payload.allow_ai_calls
        : typeof payload.allowAiCalls === 'boolean'
          ? payload.allowAiCalls
          : false,
    ai_mode: parseCanvasAiTestMode(payload.ai_mode ?? payload.aiMode),
    max_loop_items: Math.max(
      1,
      Math.min(
        optionalNumber(payload.max_loop_items ?? payload.maxLoopItems) ?? 5,
        50,
      ),
    ),
    timeout_seconds: Math.max(
      1,
      Math.min(
        optionalNumber(payload.timeout_seconds ?? payload.timeoutSeconds) ?? 30,
        300,
      ),
    ),
  };
}

function parseCanvasAiTestMode(value: unknown): CanvasTestRunPolicy['ai_mode'] {
  switch (value) {
    case 'gateway_test_route':
    case 'real_policy_checked':
      return value;
    default:
      return 'mock';
  }
}

function parseCanvasTestRedaction(value: unknown): CanvasTestRunRedaction {
  const payload = isRecord(value) ? value : {};
  return {
    raw_input_visible:
      (payload.raw_input_visible ?? payload.rawInputVisible) === true,
    raw_output_visible:
      (payload.raw_output_visible ?? payload.rawOutputVisible) === true,
    store_raw_payload:
      (payload.store_raw_payload ?? payload.storeRawPayload) === true,
  };
}

function parseValidationMode(value: unknown): CanvasValidateRequest['mode'] {
  switch (value) {
    case 'fast':
    case 'full':
    case 'publish_gate':
    case 'runtime_gate':
    case 'operation_preview':
    case 'field_level':
      return value;
    default:
      return 'full';
  }
}

function parseValidationScope(value: unknown): CanvasValidateRequest['scope'] {
  switch (value) {
    case 'draft':
    case 'operation':
    case 'node':
    case 'publish':
    case 'runtime':
      return value;
    default:
      return 'draft';
  }
}

function parseCanvasStepConfigValidationRequest(
  body: unknown,
): CanvasStepConfigValidationRequest {
  if (!isRecord(body)) {
    return {};
  }
  return {
    config: isRecord(body.config) ? body.config : undefined,
    input_bindings: Array.isArray(body.input_bindings)
      ? (body.input_bindings as readonly ContractStepInputBinding[])
      : Array.isArray(body.inputBindings)
        ? (body.inputBindings as readonly ContractStepInputBinding[])
        : undefined,
    mode: 'field_level',
  };
}

function parseCanvasApplySuggestedFixRequest(body: unknown): {
  readonly suggested_fix_id: string;
  readonly confirmed_by_user: boolean;
} {
  if (!isRecord(body)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Canvas suggested fix request body must be an object.',
    );
  }
  return {
    suggested_fix_id: expectString(
      body.suggested_fix_id ?? body.suggestedFixId,
      'suggested_fix_id',
    ),
    confirmed_by_user:
      (body.confirmed_by_user ?? body.confirmedByUser) === true,
  };
}

function parseCanvasSuggestionApplyRequest(body: unknown): {
  readonly confirmed_by_user: boolean;
  readonly context_node_id?: string | null;
} {
  const payload = isRecord(body) ? body : {};
  return {
    confirmed_by_user:
      (payload.confirmed_by_user ?? payload.confirmedByUser) === true,
    context_node_id: optionalString(
      payload.context_node_id ?? payload.contextNodeId,
    ),
  };
}

function parseCanvasLockRequest(body: unknown): {
  readonly draftId?: string | null;
  readonly lockId?: string | null;
  readonly lockType?: string | null;
  readonly ttlSeconds?: number | null;
} {
  const payload = isRecord(body) ? body : {};
  return {
    draftId: optionalString(payload.draft_id ?? payload.draftId),
    lockId: optionalString(payload.lock_id ?? payload.lockId),
    lockType: optionalString(payload.lock_type ?? payload.lockType),
    ttlSeconds: optionalNumber(payload.ttl_seconds ?? payload.ttlSeconds),
  };
}

function parseSampleDataId(body: unknown) {
  if (!isRecord(body)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Canvas pinned-data request body must be an object.',
    );
  }
  return expectString(
    body.sample_data_id ?? body.sampleDataId ?? body.id,
    'sample_data_id',
  );
}

function parseStepTestRequest(body: unknown): StepTestRequest {
  if (!isRecord(body)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Canvas step test request body must be an object.',
    );
  }

  return {
    mode: parseStepTestMode(body.mode),
    sample_data_mode: parseStepSampleDataMode(
      body.sample_data_mode ?? body.sampleDataMode,
    ),
    trigger_test_data: isRecord(body.trigger_test_data)
      ? body.trigger_test_data
      : isRecord(body.triggerTestData)
        ? body.triggerTestData
        : undefined,
    client_operation_id: expectString(
      body.client_operation_id ?? body.clientOperationId,
      'client_operation_id',
    ),
  };
}

function parseStepTestMode(value: unknown): StepTestRequest['mode'] {
  switch (value) {
    case 'up_to_step':
    case 'branch':
      return value;
    default:
      return 'selected_step';
  }
}

function parseStepSampleDataMode(
  value: unknown,
): StepTestRequest['sample_data_mode'] {
  switch (value) {
    case 'mock':
    case 'pinned':
    case 'manual':
      return value;
    default:
      return 'auto';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      `Expected string field: ${field}.`,
    );
  }
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  throw new AppHttpException(
    'VALIDATION_ERROR',
    400,
    `${field} must be a non-empty string.`,
  );
}

function optionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseBooleanQuery(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}
