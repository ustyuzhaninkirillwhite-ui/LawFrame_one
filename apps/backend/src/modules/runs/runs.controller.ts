import type {
  ArtifactSignedUrlRequest,
  CreateRunArtifactRequest,
  RunCreateRequest,
  RunPreflightRequest,
} from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { dataClassification } from '@lexframe/contracts';
import {
  optionalRecord,
  optionalString,
  optionalStringArray,
  requestMeta,
} from '../stage7-support/stage7.helpers';
import { RunCommandService } from './run-command.service';
import { RunPreflightService } from './run-preflight.service';
import { RunSnapshotService } from './run-snapshot.service';
import { RunsService } from './runs.service';

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class RunsController {
  constructor(
    private readonly runsService: RunsService,
    private readonly runPreflightService: RunPreflightService,
    private readonly runSnapshotService: RunSnapshotService,
    private readonly runCommandService: RunCommandService,
  ) {}

  @Get('runs')
  @RequiredPermissions('automation.read')
  list(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.runsService.list(context.access);
  }

  @Post('automations/:id/runs/preflight')
  @HttpCode(200)
  @RequiredPermissions('automation.read')
  preflight(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.runPreflightService.preflight(
      context.access,
      id,
      parseRunRequest(body),
    );
  }

  @Post('automations/:id/runs')
  @HttpCode(200)
  @RequiredPermissions('automation.run')
  createRun(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.runCommandService.createRun(
      context.actor,
      context.access,
      id,
      parseRunRequest(body),
      requestMeta(request),
    );
  }

  @Get('runs/:runId')
  @RequiredPermissions('automation.read')
  getRun(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('runId') runId: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.runSnapshotService.getRunSnapshot(context.access, runId);
  }

  @Get('runs/:runId/live-snapshot')
  @RequiredPermissions('automation.read')
  getRunLiveSnapshot(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('runId') runId: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.runSnapshotService.getRunLiveSnapshot(context.access, runId);
  }

  @Post('runs/:runId/cancel')
  @HttpCode(200)
  @RequiredPermissions('automation.run')
  cancelRun(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('runId') runId: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.runCommandService.cancelRun(
      context.actor,
      context.access,
      runId,
      requestMeta(request),
    );
  }

  @Post('runs/:runId/retry')
  @HttpCode(200)
  @RequiredPermissions('automation.run')
  retryRun(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('runId') runId: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.runCommandService.retryRun(
      context.actor,
      context.access,
      runId,
      requestMeta(request),
    );
  }

  @Post('runs/:runId/steps/:stepId/retry')
  @HttpCode(200)
  @RequiredPermissions('automation.run')
  retryStep(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('runId') runId: string,
    @Param('stepId') stepId: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.runCommandService.retryStep(
      context.actor,
      context.access,
      runId,
      stepId,
      requestMeta(request),
    );
  }

  @Get('runs/:runId/artifacts')
  @RequiredPermissions('automation.read')
  listArtifacts(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('runId') runId: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.runsService.listArtifacts(context.access, runId);
  }

  @Post('runs/:runId/artifacts')
  @HttpCode(200)
  @RequiredPermissions('automation.run', 'document.upload')
  createArtifact(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('runId') runId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.runsService.createArtifact(
      context.actor,
      context.access,
      runId,
      parseCreateRunArtifactRequest(body),
      {
        requestId: request.headers['x-request-id'] ?? null,
        traceId: request.headers['x-trace-id'] ?? null,
      },
    );
  }

  @Post('artifacts/:artifactId/signed-url')
  @HttpCode(200)
  @RequiredPermissions('document.read')
  createArtifactSignedUrl(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('artifactId') artifactId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.runCommandService.createArtifactSignedUrl(
      context.actor,
      context.access,
      artifactId,
      parseArtifactSignedUrlRequest(body),
      requestMeta(request),
    );
  }

  @Post('artifacts/:artifactId/accept-as-document')
  @HttpCode(200)
  @RequiredPermissions('automation.read')
  acceptArtifactAsDocument(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('artifactId') artifactId: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.runCommandService.acceptArtifactAsDocument(
      context.actor,
      context.access,
      artifactId,
      requestMeta(request),
    );
  }
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

function parseRunRequest(
  body: unknown,
): RunPreflightRequest & RunCreateRequest {
  const value = asRecord(body ?? {});

  return {
    ...(value.profileId !== undefined
      ? { profileId: optionalString(value.profileId) }
      : {}),
    ...(value.idempotencyKey !== undefined
      ? { idempotencyKey: optionalString(value.idempotencyKey) }
      : {}),
    ...(value.inputs !== undefined
      ? {
          inputs: {
            ...(Array.isArray(asRecord(value.inputs).documentIds)
              ? {
                  documentIds:
                    optionalStringArray(asRecord(value.inputs).documentIds) ??
                    [],
                }
              : {}),
            ...(asRecord(value.inputs).params !== undefined
              ? {
                  params: optionalRecord(asRecord(value.inputs).params) ?? {},
                }
              : {}),
          },
        }
      : {}),
  };
}

function parseArtifactSignedUrlRequest(
  body: unknown,
): ArtifactSignedUrlRequest {
  const value = asRecord(body ?? {});
  const objectRole = value.objectRole;
  const purpose = value.purpose;

  if (
    objectRole !== 'original' &&
    objectRole !== 'preview_pdf' &&
    objectRole !== 'thumbnail'
  ) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Artifact objectRole is required.',
    );
  }

  if (purpose !== 'download' && purpose !== 'preview') {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Artifact signed URL purpose is invalid.',
    );
  }

  return {
    ...(typeof value.versionId === 'string' && value.versionId.trim().length > 0
      ? { versionId: value.versionId.trim() }
      : {}),
    objectRole,
    purpose,
    ...(typeof value.expiresInSeconds === 'number'
      ? { expiresInSeconds: value.expiresInSeconds }
      : {}),
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

function expectString(value: unknown, message: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppHttpException('VALIDATION_ERROR', 400, message);
  }

  return value.trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Request body must be a JSON object.',
    );
  }

  return value as Record<string, unknown>;
}
