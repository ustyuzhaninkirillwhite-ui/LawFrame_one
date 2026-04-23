import type {
  LegalModuleIoSchema,
  LegalModuleSummary,
  TemplateRequirement,
  ValidateLegalModuleStepRequest,
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
import { LegalModulesService } from './legal-modules.service';

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class LegalModulesController {
  constructor(private readonly legalModulesService: LegalModulesService) {}

  @Get('legal-modules')
  @RequiredPermissions('automation.read')
  list() {
    return this.legalModulesService.list();
  }

  @Get('legal-modules/:code')
  @RequiredPermissions('automation.read')
  get(@Param('code') code: string) {
    return this.legalModulesService.getDetail(code);
  }

  @Post('legal-modules/validate-step')
  @HttpCode(200)
  @RequiredPermissions('automation.read')
  validateStep(@Body() body: unknown) {
    return this.legalModulesService.validateStep(
      parseValidateStepRequest(body),
    );
  }

  @Get('admin/legal-modules')
  @RequiredPermissions('module.manage')
  listAdmin() {
    return this.legalModulesService.list();
  }

  @Post('admin/legal-modules')
  @HttpCode(200)
  @RequiredPermissions('module.manage')
  createModule(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor) {
      throw new Error('Actor context was not attached.');
    }

    return this.legalModulesService.createModule(
      context.actor,
      parseCreateModuleRequest(body),
      requestMeta(request),
    );
  }

  @Post('admin/legal-modules/:code/versions')
  @HttpCode(200)
  @RequiredPermissions('module.manage')
  createVersion(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('code') code: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor) {
      throw new Error('Actor context was not attached.');
    }

    return this.legalModulesService.createVersion(
      context.actor,
      code,
      parseCreateVersionRequest(body),
      requestMeta(request),
    );
  }

  @Post('admin/legal-modules/:code/versions/:version/publish')
  @HttpCode(200)
  @RequiredPermissions('module.manage')
  publishVersion(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('code') code: string,
    @Param('version') version: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor) {
      throw new Error('Actor context was not attached.');
    }

    return this.legalModulesService.publishVersion(
      context.actor,
      code,
      version,
      requestMeta(request),
    );
  }

  @Post('admin/legal-modules/:code/versions/:version/deprecate')
  @HttpCode(200)
  @RequiredPermissions('module.manage')
  deprecateVersion(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('code') code: string,
    @Param('version') version: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor) {
      throw new Error('Actor context was not attached.');
    }

    return this.legalModulesService.deprecateVersion(
      context.actor,
      code,
      version,
      requestMeta(request),
    );
  }
}

function parseValidateStepRequest(
  body: unknown,
): ValidateLegalModuleStepRequest {
  const value = asRecord(body);

  return {
    moduleCode: expectString(value.moduleCode, 'Module code is required.'),
    inputCodes: expectStringArray(
      value.inputCodes,
      'Input codes are required.',
    ),
    outputCodes: expectStringArray(
      value.outputCodes,
      'Output codes are required.',
    ),
    ...(typeof value.requiresApproval === 'boolean'
      ? { requiresApproval: value.requiresApproval }
      : {}),
  };
}

function parseCreateModuleRequest(body: unknown) {
  const value = asRecord(body);
  const riskLevel = value.riskLevel;

  if (riskLevel !== 'low' && riskLevel !== 'medium' && riskLevel !== 'high') {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Risk level must be low, medium, or high.',
    );
  }

  return {
    code: expectString(value.code, 'Module code is required.'),
    title: expectString(value.title, 'Module title is required.'),
    category: expectString(value.category, 'Module category is required.'),
    description: expectString(
      value.description,
      'Module description is required.',
    ),
    riskLevel: riskLevel as LegalModuleSummary['riskLevel'],
  };
}

function parseCreateVersionRequest(body: unknown) {
  const value = asRecord(body);

  return {
    version: expectString(value.version, 'Module version is required.'),
    inputSchema: expectIoSchemaArray(value.inputSchema),
    outputSchema: expectIoSchemaArray(value.outputSchema),
    requirements: expectRequirementArray(value.requirements),
    runtimeMapping: asLooseRecord(
      value.runtimeMapping,
      'Runtime mapping is required.',
    ),
    examples: expectStringArray(value.examples, 'Examples are required.'),
  };
}

function expectIoSchemaArray(value: unknown): readonly LegalModuleIoSchema[] {
  if (!Array.isArray(value)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Schema arrays are required.',
    );
  }

  return value.map((entry) => {
    const record = asRecord(entry);

    return {
      code: expectString(record.code, 'Schema code is required.'),
      label: expectString(record.label, 'Schema label is required.'),
      schema: asLooseRecord(record.schema, 'Schema object is required.'),
    };
  });
}

function expectRequirementArray(
  value: unknown,
): readonly TemplateRequirement[] {
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
        typeof record.sourceDocumentId === 'string'
          ? record.sourceDocumentId
          : null,
    };
  });
}

function expectStringArray(value: unknown, message: string): readonly string[] {
  if (!isStringArray(value)) {
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

function asLooseRecord(
  value: unknown,
  message: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppHttpException('VALIDATION_ERROR', 400, message);
  }

  return value as Record<string, unknown>;
}

function requestMeta(request: LexframeRequest) {
  return {
    requestId: request.headers['x-request-id'] ?? null,
    traceId: request.headers['x-trace-id'] ?? null,
  };
}

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  );
}
