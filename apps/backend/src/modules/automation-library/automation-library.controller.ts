import type {
  AutomationTemplateOwner,
  AutomationTemplateScope,
  CreateAutomationTemplateRequest,
  CreateAutomationTemplateVersionRequest,
  ForkAutomationTemplateRequest,
  ModerationDecision,
  SubmitPublicationRequest,
  TemplateRequirement,
  UpdateAutomationTemplateRequest,
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
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AutomationLibraryService } from './automation-library.service';

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class AutomationLibraryController {
  constructor(
    private readonly automationLibraryService: AutomationLibraryService,
  ) {}

  @Get('library')
  @RequiredPermissions('automation.read')
  listTemplates(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    return this.automationLibraryService.listTemplates(context?.access ?? null);
  }

  @Get('automation-templates')
  @RequiredPermissions('automation.read')
  listAutomationTemplates(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Req() request: LexframeRequest,
  ) {
    return this.automationLibraryService.listTemplates(
      context?.access ?? null,
      parseTemplateQuery(request.query),
    );
  }

  @Get('automation-templates/:id')
  @RequiredPermissions('automation.read')
  getAutomationTemplate(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    return this.automationLibraryService.getTemplate(context?.access ?? null, id);
  }

  @Post('automation-templates')
  @HttpCode(200)
  @RequiredPermissions('automation.edit')
  createAutomationTemplate(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.automationLibraryService.createTemplate(
      context.actor,
      context.access,
      parseCreateTemplateRequest(body),
      requestMeta(request),
    );
  }

  @Patch('automation-templates/:id')
  @RequiredPermissions('automation.edit')
  updateAutomationTemplate(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.automationLibraryService.updateTemplate(
      context.actor,
      context.access,
      id,
      parseUpdateTemplateRequest(body),
      requestMeta(request),
    );
  }

  @Post('automation-templates/:id/versions')
  @HttpCode(200)
  @RequiredPermissions('automation.edit')
  createAutomationTemplateVersion(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.automationLibraryService.createTemplateVersion(
      context.actor,
      context.access,
      id,
      parseCreateTemplateVersionRequest(body),
      requestMeta(request),
    );
  }

  @Post('automation-template-versions/:id/validate')
  @HttpCode(200)
  @RequiredPermissions('automation.read')
  validateAutomationTemplateVersion(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    return this.automationLibraryService.validateTemplateVersion(
      context?.access ?? null,
      id,
    );
  }

  @Post('automation-template-versions/:id/publish-draft')
  @HttpCode(200)
  @RequiredPermissions('automation.publish')
  publishAutomationTemplateDraft(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.automationLibraryService.publishTemplateDraft(
      context.actor,
      context.access,
      id,
      requestMeta(request),
    );
  }

  @Post('automation-templates/:id/install')
  @HttpCode(200)
  @RequiredPermissions('automation.install')
  installAutomationTemplate(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.automationLibraryService.installTemplate(
      context.actor,
      context.access,
      id,
      parseInstallRequest(body),
      requestMeta(request),
    );
  }

  @Post('automation-templates/:id/fork')
  @HttpCode(200)
  @RequiredPermissions('automation.fork')
  forkAutomationTemplate(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.automationLibraryService.forkTemplate(
      context.actor,
      context.access,
      id,
      parseForkRequest(body),
      requestMeta(request),
    );
  }

  @Get('automation-templates/:id/related')
  @RequiredPermissions('automation.read')
  relatedTemplates(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    return this.automationLibraryService.relatedTemplates(
      context?.access ?? null,
      id,
    );
  }

  @Get('automations')
  @RequiredPermissions('automation.read')
  listInstalled(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.automationLibraryService.listInstalled(context.access);
  }

  @Get('automations/:id')
  @RequiredPermissions('automation.read')
  getInstalled(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.automationLibraryService.getInstalledAutomation(context.access, id);
  }

  @Post('installed-automations/:id/fork-to-template')
  @HttpCode(200)
  @RequiredPermissions('automation.fork')
  forkInstalledAutomation(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.automationLibraryService.forkInstalledAutomationToTemplate(
      context.actor,
      context.access,
      id,
      parseForkRequest(body),
      requestMeta(request),
    );
  }

  @Get('installed-automations/:id/source-diff')
  @RequiredPermissions('automation.update_source')
  getInstalledAutomationSourceDiff(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.automationLibraryService.getInstalledAutomationSourceDiff(
      context.access,
      id,
    );
  }

  @Post('installed-automations/:id/apply-source-update')
  @HttpCode(200)
  @RequiredPermissions('automation.update_source')
  applyInstalledAutomationSourceUpdate(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.automationLibraryService.applyInstalledAutomationSourceUpdate(
      context.actor,
      context.access,
      id,
      parseApplySourceUpdateRequest(body),
      requestMeta(request),
    );
  }

  @Post('automation-templates/:id/submit-publication')
  @HttpCode(200)
  @RequiredPermissions('automation.submit_publication')
  submitAutomationTemplatePublication(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.automationLibraryService.submitPublication(
      context.actor,
      context.access,
      id,
      parseSubmitPublicationRequest(body),
      requestMeta(request),
    );
  }

  @Get('publication-requests/:id')
  @RequiredPermissions('automation.read')
  getPublicationRequest(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.automationLibraryService.getPublicationRequest(context.access, id);
  }

  @Get('moderation/publication-requests')
  @RequiredPermissions('moderation.review')
  listPublicationRequests() {
    return this.automationLibraryService.listPublicationRequests();
  }

  @Get('moderation/publication-requests/:id')
  @RequiredPermissions('moderation.review')
  getModerationPublicationRequest(@Param('id') id: string) {
    return this.automationLibraryService.getModerationPublicationRequest(id);
  }

  @Post('moderation/publication-requests/:id/approve')
  @HttpCode(200)
  @RequiredPermissions('moderation.review')
  approvePublicationRequest(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    return this.reviewPublicationRequest(
      context,
      id,
      body,
      request,
      'approve',
    );
  }

  @Post('moderation/publication-requests/:id/reject')
  @HttpCode(200)
  @RequiredPermissions('moderation.review')
  rejectPublicationRequest(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    return this.reviewPublicationRequest(
      context,
      id,
      body,
      request,
      'reject',
    );
  }

  @Post('moderation/publication-requests/:id/request-changes')
  @HttpCode(200)
  @RequiredPermissions('moderation.review')
  requestPublicationChanges(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    return this.reviewPublicationRequest(
      context,
      id,
      body,
      request,
      'request_changes',
    );
  }

  private reviewPublicationRequest(
    context: LexframeRequest['lexframe'],
    id: string,
    body: unknown,
    request: LexframeRequest,
    expectedDecision: ModerationDecision['decision'],
  ) {
    if (!context?.actor) {
      throw new Error('Actor context was not attached.');
    }

    const decision = parseModerationDecision(body, expectedDecision);

    return this.automationLibraryService.reviewPublicationRequest(
      context.actor,
      id,
      decision,
      requestMeta(request),
    );
  }
}

function parseTemplateQuery(
  value: unknown,
): {
  q?: string;
  scope?: AutomationTemplateScope;
  owner?: AutomationTemplateOwner;
  mine?: boolean;
} {
  const query = asRecord(value ?? {});
  const output: {
    q?: string;
    scope?: AutomationTemplateScope;
    owner?: AutomationTemplateOwner;
    mine?: boolean;
  } = {};

  if (typeof query.q === 'string' && query.q.trim().length > 0) {
    output.q = query.q.trim();
  }

  if (isTemplateScope(query.scope)) {
    output.scope = query.scope;
  }

  if (isTemplateOwner(query.owner)) {
    output.owner = query.owner;
  }

  if (query.mine === 'true' || query.mine === true) {
    output.mine = true;
  }

  return output;
}

function parseCreateTemplateRequest(body: unknown): CreateAutomationTemplateRequest {
  const value = asRecord(body);
  const scope = value.scope;

  if (scope !== 'workspace' && scope !== 'private') {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Template scope must be workspace or private.',
    );
  }

  return {
    code: expectString(value.code, 'Template code is required.'),
    title: expectString(value.title, 'Template title is required.'),
    category: expectString(value.category, 'Template category is required.'),
    description: expectString(
      value.description,
      'Template description is required.',
    ),
    scope,
    requiredPermissions: expectStringArray(
      value.requiredPermissions,
      'Required permissions are required.',
    ) as CreateAutomationTemplateRequest['requiredPermissions'],
    moduleCodes: expectStringArray(value.moduleCodes, 'Module codes are required.'),
    workflow: asLooseRecord(value.workflow, 'Workflow payload is required.'),
    requirements: expectRequirementArray(value.requirements),
    sourceTemplateId:
      typeof value.sourceTemplateId === 'string' && value.sourceTemplateId.trim().length > 0
        ? value.sourceTemplateId.trim()
        : undefined,
  };
}

function parseUpdateTemplateRequest(body: unknown): UpdateAutomationTemplateRequest {
  const value = asRecord(body);
  const output: {
    title?: string;
    category?: string;
    description?: string;
    requiredPermissions?: CreateAutomationTemplateRequest['requiredPermissions'];
  } = {};

  if (typeof value.title === 'string' && value.title.trim().length > 0) {
    output.title = value.title.trim();
  }

  if (typeof value.category === 'string' && value.category.trim().length > 0) {
    output.category = value.category.trim();
  }

  if (
    typeof value.description === 'string' &&
    value.description.trim().length > 0
  ) {
    output.description = value.description.trim();
  }

  if (value.requiredPermissions !== undefined) {
    output.requiredPermissions = expectStringArray(
      value.requiredPermissions,
      'Required permissions must be a string array.',
    ) as CreateAutomationTemplateRequest['requiredPermissions'];
  }

  return output;
}

function parseCreateTemplateVersionRequest(
  body: unknown,
): CreateAutomationTemplateVersionRequest {
  const value = asRecord(body);

  return {
    version: expectString(value.version, 'Template version is required.'),
    workflow: asLooseRecord(value.workflow, 'Workflow payload is required.'),
    requirements: expectRequirementArray(value.requirements),
  };
}

function parseInstallRequest(body: unknown) {
  const value = asRecord(body);
  const approvalPolicy = value.approvalPolicy;

  if (
    approvalPolicy !== undefined &&
    approvalPolicy !== 'manual' &&
    approvalPolicy !== 'auto_with_gate'
  ) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Approval policy is invalid.',
    );
  }

  const output: {
    workspaceId?: string;
    profileId?: string | null;
    documentIds?: readonly string[];
    connectionIds?: readonly string[];
    approvalPolicy?: 'manual' | 'auto_with_gate';
  } = {
    workspaceId:
      typeof value.workspaceId === 'string' && value.workspaceId.trim().length > 0
        ? value.workspaceId.trim()
        : undefined,
    profileId:
      typeof value.profileId === 'string' && value.profileId.trim().length > 0
        ? value.profileId.trim()
        : value.profileId === null
          ? null
          : undefined,
    documentIds:
      value.documentIds !== undefined
        ? expectStringArray(value.documentIds, 'Document ids must be a string array.')
        : undefined,
    connectionIds:
      value.connectionIds !== undefined
        ? expectStringArray(
            value.connectionIds,
            'Connection ids must be a string array.',
          )
        : undefined,
  };

  if (approvalPolicy === 'manual' || approvalPolicy === 'auto_with_gate') {
    output.approvalPolicy = approvalPolicy;
  }

  return output;
}

function parseForkRequest(body: unknown): ForkAutomationTemplateRequest {
  const value = asRecord(body);
  const targetScope = value.targetScope;

  if (
    targetScope !== undefined &&
    targetScope !== 'workspace' &&
    targetScope !== 'private'
  ) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Fork target scope must be workspace or private.',
    );
  }

  return {
    title:
      typeof value.title === 'string' && value.title.trim().length > 0
        ? value.title.trim()
        : undefined,
    targetScope,
  };
}

function parseApplySourceUpdateRequest(body: unknown) {
  const value = asRecord(body);

  return {
    targetTemplateVersionId: expectString(
      value.targetTemplateVersionId,
      'Target template version id is required.',
    ),
  };
}

function parseSubmitPublicationRequest(body: unknown): SubmitPublicationRequest {
  const value = asRecord(body);

  return {
    note:
      typeof value.note === 'string' && value.note.trim().length > 0
        ? value.note.trim()
        : undefined,
  };
}

function parseModerationDecision(
  body: unknown,
  expectedDecision: ModerationDecision['decision'],
): ModerationDecision {
  const value = asRecord(body);
  const decision = value.decision;

  if (decision !== undefined && decision !== expectedDecision) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      `Decision must be ${expectedDecision}.`,
    );
  }

  return {
    decision: expectedDecision,
    note: expectString(value.note, 'Moderation note is required.'),
  };
}

function expectRequirementArray(value: unknown): readonly TemplateRequirement[] {
  if (!Array.isArray(value)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Requirements array is required.',
    );
  }

  return value.map((entry) => {
    const record = asRecord(entry);
    const kind = record.kind;
    const status = record.status;

    if (
      kind !== 'document' &&
      kind !== 'profile' &&
      kind !== 'connection' &&
      kind !== 'approval' &&
      kind !== 'permission'
    ) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Requirement kind is invalid.',
      );
    }

    if (status !== 'ready' && status !== 'missing' && status !== 'blocked') {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Requirement status is invalid.',
      );
    }

    return {
      code: expectString(record.code, 'Requirement code is required.'),
      label: expectString(record.label, 'Requirement label is required.'),
      kind,
      description: expectString(
        record.description,
        'Requirement description is required.',
      ),
      status,
      optional: Boolean(record.optional),
      sourceDocumentId:
        typeof record.sourceDocumentId === 'string' &&
        record.sourceDocumentId.trim().length > 0
          ? record.sourceDocumentId.trim()
          : null,
    };
  });
}

function expectStringArray(value: unknown, message: string): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new AppHttpException('VALIDATION_ERROR', 400, message);
  }

  return value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

function expectString(value: unknown, message: string): string {
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

function asLooseRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppHttpException('VALIDATION_ERROR', 400, message);
  }

  return value as Record<string, unknown>;
}

function isTemplateScope(value: unknown): value is AutomationTemplateScope {
  return (
    value === 'product' ||
    value === 'workspace' ||
    value === 'public' ||
    value === 'private'
  );
}

function isTemplateOwner(value: unknown): value is AutomationTemplateOwner {
  return (
    value === 'lexframe' ||
    value === 'workspace' ||
    value === 'public' ||
    value === 'private'
  );
}

function requestMeta(request: LexframeRequest) {
  return {
    requestId: request.headers['x-request-id'] ?? null,
    traceId: request.headers['x-trace-id'] ?? null,
  };
}
