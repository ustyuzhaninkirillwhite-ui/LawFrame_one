import type {
  ActivepiecesRunEventCallback,
  ActivepiecesRunSmokeRequest,
  ActivepiecesStepEventCallback,
  CreateActivepiecesEmbedTokenRequest,
  CreateActivepiecesSessionRequest,
  CreateRunArtifactRequest,
  RuntimeApprovalGateCallback,
  RuntimeDeliveryGateCallback,
  StartAutomationRunRequest,
  SyncAutomationRuntimeRequest,
  UpsertRuntimeConnectionRequest,
} from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import { dataClassification } from '@lexframe/contracts';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  asLooseRecord,
  asRecord,
  expectString,
  expectStringArray,
  optionalString,
  requestMeta,
} from '../../common/http/request-parsing';
import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ActivepiecesService } from './activepieces.service';

@Controller()
export class ActivepiecesController {
  constructor(private readonly activepiecesService: ActivepiecesService) {}

  @Post('activepieces/embed-token')
  @HttpCode(200)
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions(
    'activepieces.open_builder',
    'canvas.open_advanced_builder',
  )
  createEmbedToken(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.activepiecesService.createEmbedToken(
      context.actor,
      context.access,
      parseCreateEmbedTokenRequest(body),
      requestMeta(request),
    );
  }

  @Post('activepieces/session')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store, no-cache, private')
  @Header('Referrer-Policy', 'no-referrer')
  @UseGuards(AuthGuard, WorkspaceContextGuard)
  createSession(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.activepiecesService.createSession(
      context.actor,
      context.access,
      parseCreateSessionRequest(body),
      requestMeta(request),
    );
  }

  @Post('activepieces/managed-authn/external-token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store, no-cache, private')
  @Header('Referrer-Policy', 'no-referrer')
  createManagedAuthnExternalToken(@Body() body: unknown) {
    return this.activepiecesService.createManagedAuthnExternalToken(
      parseManagedAuthnExternalTokenRequest(body),
    );
  }

  @Post('activepieces/session/:sessionId/initialized')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store, no-cache, private')
  @Header('Referrer-Policy', 'no-referrer')
  @UseGuards(AuthGuard, WorkspaceContextGuard)
  initializeSession(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('sessionId') sessionId: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.activepiecesService.initializeSession(
      context.actor,
      context.access,
      sessionId,
      requestMeta(request),
    );
  }

  @Get('admin/security/activepieces')
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('workspace.security.read')
  getSecurityOverview(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.activepiecesService.getWorkspaceSecurityOverview(
      context.access,
    );
  }

  @Get('admin/activepieces/catalog')
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('module.manage')
  getActivepiecesCatalogDiagnostics(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.activepiecesService.getCatalogDiagnostics();
  }

  @Post('admin/activepieces/catalog/sync')
  @HttpCode(202)
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('module.manage')
  requestActivepiecesCatalogSync(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.activepiecesService.requestCatalogSync();
  }

  @Get('integrations/activepieces/status')
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('automation.read')
  getIntegrationStatus(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.activepiecesService.getIntegrationStatus(context.access);
  }

  @Get('automations/:id/runtime/requirements')
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('automation.read')
  getRuntimeRequirements(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.activepiecesService.getAutomationRuntimeRequirements(
      context.access,
      id,
    );
  }

  @Post('automations/:id/runtime/sync')
  @HttpCode(200)
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('activepieces.sync_flow')
  syncFlow(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.activepiecesService.syncFlow(
      context.actor,
      context.access,
      id,
      parseSyncRuntimeRequest(body),
      requestMeta(request),
    );
  }

  @Post('automations/:id/run')
  @HttpCode(200)
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('automation.run')
  startAutomationRun(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.activepiecesService.startRun(
      context.actor,
      context.access,
      id,
      parseStartAutomationRunRequest(body),
      requestMeta(request),
    );
  }

  @Post('activepieces/run-smoke')
  @HttpCode(200)
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('automation.run')
  runSmoke(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.activepiecesService.runSmoke(
      context.actor,
      context.access,
      parseRunSmokeRequest(body),
      requestMeta(request),
    );
  }

  @Get('runtime/connections')
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('automation.read')
  listRuntimeConnections(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.activepiecesService.listRuntimeConnections(context.access);
  }

  @Post('runtime/connections')
  @HttpCode(200)
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('connections.manage')
  upsertRuntimeConnection(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.activepiecesService.upsertRuntimeConnection(
      context.actor,
      context.access,
      parseUpsertRuntimeConnectionRequest(body),
      requestMeta(request),
    );
  }

  @Post('runtime/activepieces/callbacks/step-event')
  @HttpCode(200)
  handleStepEvent(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.activepiecesService.handleStepEvent(
      parseStepEventCallback(body),
      authorization,
    );
  }

  @Post('runtime/activepieces/callbacks/run-event')
  @HttpCode(200)
  handleRunEvent(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.activepiecesService.handleRunEvent(
      parseRunEventCallback(body),
      authorization,
    );
  }

  @Post('runtime/activepieces/runs/:runId/artifacts')
  @HttpCode(200)
  ingestRuntimeArtifact(
    @Param('runId') runId: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.activepiecesService.ingestRuntimeArtifact(
      runId,
      authorization,
      parseCreateRunArtifactRequest(body),
    );
  }

  @Post('runtime/runs/:runId/step-events')
  @HttpCode(200)
  handleCanonicalStepEvent(
    @Param('runId') runId: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.activepiecesService.handleStepEvent(
      parseStepEventCallback({
        ...asRecord(body),
        runId,
      }),
      authorization,
    );
  }

  @Post('runtime/runs/:runId/artifacts')
  @HttpCode(200)
  ingestCanonicalRuntimeArtifact(
    @Param('runId') runId: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.activepiecesService.ingestRuntimeArtifact(
      runId,
      authorization,
      parseCreateRunArtifactRequest(body),
    );
  }

  @Post('runtime/approval-gates')
  @HttpCode(200)
  handleApprovalGate(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.activepiecesService.handleApprovalGate(
      parseApprovalGateCallback(body),
      authorization,
    );
  }

  @Post('runtime/delivery-gates')
  @HttpCode(200)
  handleDeliveryGate(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.activepiecesService.handleDeliveryGate(
      parseDeliveryGateCallback(body),
      authorization,
    );
  }
}

function parseCreateEmbedTokenRequest(
  body: unknown,
): CreateActivepiecesEmbedTokenRequest {
  const value = asRecord(body);
  const purpose = value.purpose;

  if (purpose !== undefined && purpose !== 'builder' && purpose !== 'viewer') {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Embed token purpose is invalid.',
    );
  }

  return {
    installedAutomationId: expectString(
      value.installedAutomationId,
      'Installed automation id is required.',
    ),
    ...(purpose ? { purpose } : {}),
  };
}

function parseCreateSessionRequest(
  body: unknown,
): CreateActivepiecesSessionRequest {
  const value = asRecord(body);
  const purpose = value.purpose;
  const preferredMode = value.preferred_mode;
  const modePreference = value.mode_preference;
  const rawAutomationId = value.automation_id;
  const deniedField = SESSION_REQUEST_DENYLIST.find((field) => field in value);

  if (deniedField) {
    throw new AppHttpException(
      'INVALID_CLIENT_FIELD',
      400,
      `Activepieces session field ${deniedField} is server-controlled.`,
    );
  }

  if (purpose !== 'automation_canvas') {
    throw new AppHttpException(
      'INVALID_REQUEST',
      400,
      'Activepieces session purpose is invalid.',
    );
  }

  const parsedPreferredMode = expectPreferredMode(
    preferredMode,
    'preferred_mode',
  );
  const parsedModePreference = expectPreferredMode(
    modePreference,
    'mode_preference',
  );
  if (
    parsedPreferredMode &&
    parsedModePreference &&
    parsedPreferredMode !== parsedModePreference
  ) {
    throw new AppHttpException(
      'INVALID_CLIENT_FIELD',
      400,
      'Activepieces session mode_preference conflicts with preferred_mode.',
    );
  }

  if (
    rawAutomationId !== undefined &&
    rawAutomationId !== null &&
    (typeof rawAutomationId !== 'string' || rawAutomationId.trim().length === 0)
  ) {
    throw new AppHttpException(
      'INVALID_REQUEST',
      400,
      'Activepieces session automation_id must be a string or null.',
    );
  }

  const workspaceId = optionalString(value.workspace_id);

  return {
    ...(workspaceId ? { workspaceId } : {}),
    projectId: expectString(
      value.project_id,
      'Activepieces session project_id is required.',
    ),
    automationId:
      typeof rawAutomationId === 'string' ? rawAutomationId.trim() : null,
    purpose: 'automation_canvas',
    clientRoute: expectString(
      value.client_route,
      'Activepieces session client_route is required.',
    ),
    ...(parsedPreferredMode
      ? {
          preferredMode: parsedPreferredMode,
        }
      : {}),
    ...(parsedModePreference
      ? {
          modePreference: parsedModePreference,
        }
      : {}),
    ...(typeof value.return_builder_config === 'boolean'
      ? { returnBuilderConfig: value.return_builder_config }
      : {}),
    ...(typeof value.client_trace_id === 'string'
      ? { clientTraceId: value.client_trace_id.trim() || null }
      : value.client_trace_id === null
        ? { clientTraceId: null }
        : {}),
    ...(typeof value.idempotency_key === 'string'
      ? { idempotencyKey: value.idempotency_key.trim() || null }
      : value.idempotency_key === null
        ? { idempotencyKey: null }
        : {}),
  };
}

function parseManagedAuthnExternalTokenRequest(body: unknown) {
  const value = asRecord(body);
  return {
    externalAccessToken: expectString(
      value.externalAccessToken,
      'Activepieces managed auth externalAccessToken is required.',
    ),
  };
}

const SESSION_REQUEST_DENYLIST = [
  'role',
  'activepieces_project_id',
  'activepiecesProjectId',
  'activepieces_flow_id',
  'activepiecesFlowId',
  'piecesFilterType',
  'pieces_filter_type',
  'piecesTags',
  'pieces_tags',
  'api_key',
  'apiKey',
  'signing_key',
  'signingKey',
  'provider_key',
  'providerKey',
  'connection_credentials',
  'connectionCredentials',
] as const;

function expectPreferredMode(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (
    value === 'auto' ||
    value === 'iframe_embed' ||
    value === 'reverse_proxy'
  ) {
    return value;
  }

  throw new AppHttpException(
    'INVALID_CLIENT_FIELD',
    400,
    `Activepieces session ${fieldName} is invalid.`,
  );
}

function parseSyncRuntimeRequest(body: unknown): SyncAutomationRuntimeRequest {
  const value = asRecord(body);

  return {
    ...(typeof value.versionId === 'string' && value.versionId.trim().length > 0
      ? { versionId: value.versionId.trim() }
      : value.versionId === null
        ? { versionId: null }
        : {}),
    ...(typeof value.dryRun === 'boolean' ? { dryRun: value.dryRun } : {}),
    ...(typeof value.force === 'boolean' ? { force: value.force } : {}),
  };
}

function parseStartAutomationRunRequest(
  body: unknown,
): StartAutomationRunRequest {
  const value = asRecord(body);
  const mode = value.mode;

  if (mode !== 'dry_run' && mode !== 'full_run') {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Run mode must be dry_run or full_run.',
    );
  }

  const inputs = value.inputs;
  const parsedInputs =
    inputs !== undefined
      ? (() => {
          const record = asRecord(inputs);
          return {
            ...(record.documentIds !== undefined
              ? {
                  documentIds: expectStringArray(
                    record.documentIds,
                    'Run input documentIds must be a string array.',
                  ),
                }
              : {}),
            ...(record.params !== undefined
              ? {
                  params: asLooseRecord(
                    record.params,
                    'Run input params must be an object.',
                  ),
                }
              : {}),
          };
        })()
      : undefined;
  const profileId =
    typeof value.profileId === 'string' && value.profileId.trim().length > 0
      ? value.profileId.trim()
      : value.profileId === null
        ? null
        : undefined;
  const idempotencyKey =
    typeof value.idempotencyKey === 'string' &&
    value.idempotencyKey.trim().length > 0
      ? value.idempotencyKey.trim()
      : value.idempotencyKey === null
        ? null
        : undefined;

  return {
    mode,
    ...(parsedInputs ? { inputs: parsedInputs } : {}),
    ...(profileId !== undefined ? { profileId } : {}),
    ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
  };
}

function parseRunSmokeRequest(body: unknown): ActivepiecesRunSmokeRequest {
  const value = asRecord(body);
  const mode = value.mode;

  if (mode !== undefined && mode !== 'dry_run' && mode !== 'full_run') {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Run smoke mode must be dry_run or full_run when provided.',
    );
  }

  return {
    automationId: expectString(
      value.automationId,
      'Installed automation id is required.',
    ),
    ...(mode ? { mode } : {}),
  };
}

function parseUpsertRuntimeConnectionRequest(
  body: unknown,
): UpsertRuntimeConnectionRequest {
  const value = asRecord(body);

  return {
    code: expectString(value.code, 'Connection code is required.'),
    provider: expectString(value.provider, 'Connection provider is required.'),
    ...(typeof value.displayName === 'string' &&
    value.displayName.trim().length > 0
      ? { displayName: value.displayName.trim() }
      : {}),
    ...(typeof value.externalConnectionName === 'string' &&
    value.externalConnectionName.trim().length > 0
      ? { externalConnectionName: value.externalConnectionName.trim() }
      : value.externalConnectionName === null
        ? { externalConnectionName: null }
        : {}),
  };
}

function parseStepEventCallback(body: unknown): ActivepiecesStepEventCallback {
  const value = asRecord(body);

  return {
    runId: expectString(value.runId, 'Run id is required.'),
    ...(typeof value.externalRunId === 'string' &&
    value.externalRunId.trim().length > 0
      ? { externalRunId: value.externalRunId.trim() }
      : value.externalRunId === null
        ? { externalRunId: null }
        : {}),
    stepCode: expectString(value.stepCode, 'Step code is required.'),
    ...(typeof value.moduleCode === 'string' &&
    value.moduleCode.trim().length > 0
      ? { moduleCode: value.moduleCode.trim() }
      : value.moduleCode === null
        ? { moduleCode: null }
        : {}),
    eventType: expectRunEventType(value.eventType),
    ...(value.outputs !== undefined
      ? {
          outputs:
            value.outputs === null
              ? null
              : asLooseRecord(
                  value.outputs,
                  'Step event outputs must be an object.',
                ),
        }
      : {}),
    ...(value.error !== undefined
      ? { error: parseCallbackError(value.error) }
      : {}),
    idempotencyKey: expectString(
      value.idempotencyKey,
      'Callback idempotency key is required.',
    ),
    occurredAt: expectString(
      value.occurredAt,
      'Callback occurredAt is required.',
    ),
  };
}

function parseRunEventCallback(body: unknown): ActivepiecesRunEventCallback {
  const value = asRecord(body);

  return {
    runId: expectString(value.runId, 'Run id is required.'),
    ...(typeof value.externalRunId === 'string' &&
    value.externalRunId.trim().length > 0
      ? { externalRunId: value.externalRunId.trim() }
      : value.externalRunId === null
        ? { externalRunId: null }
        : {}),
    eventType: expectRunEventType(value.eventType),
    ...(value.error !== undefined
      ? { error: parseCallbackError(value.error) }
      : {}),
    idempotencyKey: expectString(
      value.idempotencyKey,
      'Callback idempotency key is required.',
    ),
    occurredAt: expectString(
      value.occurredAt,
      'Callback occurredAt is required.',
    ),
  };
}

function parseCallbackError(
  value: unknown,
):
  | ActivepiecesRunEventCallback['error']
  | ActivepiecesStepEventCallback['error'] {
  if (value === null) {
    return null;
  }

  const record = asRecord(value);
  return {
    code: expectString(record.code, 'Callback error code is required.'),
    message: expectString(
      record.message,
      'Callback error message is required.',
    ),
  };
}

function parseCreateRunArtifactRequest(
  body: unknown,
): CreateRunArtifactRequest {
  const value = asRecord(body);
  const classification = value.classification;

  if (
    typeof classification !== 'string' ||
    !dataClassification.includes(classification as never)
  ) {
    throw new AppHttpException(
      'DOCUMENT_CLASSIFICATION_REQUIRED',
      400,
      'Artifact classification is required.',
    );
  }

  return {
    artifactType: expectString(
      value.artifactType,
      'Artifact type is required.',
    ),
    title: expectString(value.title, 'Artifact title is required.'),
    mimeType: expectString(value.mimeType, 'Artifact MIME type is required.'),
    classification:
      classification as CreateRunArtifactRequest['classification'],
    source: expectDocumentSource(value.source),
    ...(typeof value.sourceDocumentId === 'string' &&
    value.sourceDocumentId.trim().length > 0
      ? { sourceDocumentId: value.sourceDocumentId.trim() }
      : {}),
  };
}

function parseApprovalGateCallback(body: unknown): RuntimeApprovalGateCallback {
  const value = asRecord(body);

  return {
    runId: expectString(value.runId, 'Run id is required.'),
    stepCode: expectString(value.stepCode, 'Step code is required.'),
    title: expectString(value.title, 'Approval title is required.'),
    ...(typeof value.approvalRouteId === 'string' &&
    value.approvalRouteId.trim().length > 0
      ? { approvalRouteId: value.approvalRouteId.trim() }
      : value.approvalRouteId === null
        ? { approvalRouteId: null }
        : {}),
    ...(typeof value.approverUserId === 'string' &&
    value.approverUserId.trim().length > 0
      ? { approverUserId: value.approverUserId.trim() }
      : value.approverUserId === null
        ? { approverUserId: null }
        : {}),
    ...(typeof value.approverRole === 'string' &&
    value.approverRole.trim().length > 0
      ? { approverRole: value.approverRole.trim() }
      : value.approverRole === null
        ? { approverRole: null }
        : {}),
    ...(typeof value.expiresAt === 'string' && value.expiresAt.trim().length > 0
      ? { expiresAt: value.expiresAt.trim() }
      : value.expiresAt === null
        ? { expiresAt: null }
        : {}),
    ...(value.metadata !== undefined
      ? {
          metadata:
            value.metadata === null
              ? null
              : asLooseRecord(
                  value.metadata,
                  'Approval gate metadata must be an object.',
                ),
        }
      : {}),
    idempotencyKey: expectString(
      value.idempotencyKey,
      'Approval gate idempotency key is required.',
    ),
    occurredAt: expectString(
      value.occurredAt,
      'Approval gate occurredAt is required.',
    ),
  };
}

function parseDeliveryGateCallback(body: unknown): RuntimeDeliveryGateCallback {
  const value = asRecord(body);

  return {
    runId: expectString(value.runId, 'Run id is required.'),
    title: expectString(value.title, 'Delivery title is required.'),
    channel: expectDeliveryChannel(value.channel),
    subject: expectString(value.subject, 'Delivery subject is required.'),
    body: expectString(value.body, 'Delivery body is required.'),
    recipientEmails: expectStringArray(
      value.recipientEmails,
      'Delivery recipientEmails must be a string array.',
    ),
    ...(value.artifactIds !== undefined
      ? {
          artifactIds: expectStringArray(
            value.artifactIds,
            'Delivery artifactIds must be a string array.',
          ),
        }
      : {}),
    ...(typeof value.requiresApproval === 'boolean'
      ? { requiresApproval: value.requiresApproval }
      : {}),
    ...(value.metadata !== undefined
      ? {
          metadata:
            value.metadata === null
              ? null
              : asLooseRecord(
                  value.metadata,
                  'Delivery metadata must be an object.',
                ),
        }
      : {}),
    idempotencyKey: expectString(
      value.idempotencyKey,
      'Delivery gate idempotency key is required.',
    ),
    occurredAt: expectString(
      value.occurredAt,
      'Delivery gate occurredAt is required.',
    ),
  };
}

function expectDocumentSource(
  value: unknown,
): CreateRunArtifactRequest['source'] {
  if (
    value === 'user_upload' ||
    value === 'automation_result' ||
    value === 'activepieces_artifact' ||
    value === 'ai_generated' ||
    value === 'template_library' ||
    value === 'profile_library' ||
    value === 'system_import'
  ) {
    return value;
  }

  throw new AppHttpException(
    'VALIDATION_ERROR',
    400,
    'Artifact source is invalid.',
  );
}

function expectRunEventType(value: unknown) {
  if (
    value === 'queued' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'waiting_approval'
  ) {
    return value;
  }

  throw new AppHttpException(
    'VALIDATION_ERROR',
    400,
    'Runtime event type is invalid.',
  );
}

function expectDeliveryChannel(
  value: unknown,
): RuntimeDeliveryGateCallback['channel'] {
  if (value === 'email') {
    return value;
  }

  throw new AppHttpException(
    'VALIDATION_ERROR',
    400,
    'Delivery channel must be email.',
  );
}
