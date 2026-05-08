import type {
  CreateAiProviderConnectionRequest,
  UpdateAiProviderConnectionRequest,
  UpdateAiRouteGroupPreferenceRequest,
  UpdateOrganizationSettingsRequest,
  UpdateProfileSettingsRequest,
} from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AiSettingsService } from './ai-settings.service';
import {
  ManualFormSettingsFormatAdapter,
  optionalBoolean,
  optionalObject,
  optionalString,
  requiredString,
} from './settings-format-adapter';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly aiSettingsService: AiSettingsService,
  ) {}

  @Get('bootstrap')
  @RequiredPermissions('settings.view')
  bootstrap(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.settingsService.bootstrap({
      actor,
      access,
      requestId: request.headers['x-request-id'] ?? null,
      traceId: request.headers['x-trace-id'] ?? null,
    });
  }

  @Patch('profile')
  @RequiredPermissions('settings.profile.update_self')
  updateProfile(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.settingsService.updateProfile({
      actor,
      access,
      request: parseProfileUpdate(body),
      requestId: request.headers['x-request-id'] ?? null,
      traceId: request.headers['x-trace-id'] ?? null,
    });
  }

  @Patch('organization')
  @RequiredPermissions('settings.organization.update')
  updateOrganization(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.settingsService.updateOrganization({
      actor,
      access,
      request: parseOrganizationUpdate(body),
      requestId: request.headers['x-request-id'] ?? null,
      traceId: request.headers['x-trace-id'] ?? null,
    });
  }

  @Get('ai')
  @RequiredPermissions('settings.ai.view')
  getAiSettings(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.aiSettingsService.getSettings({
      actor,
      access,
      requestId: request.headers['x-request-id'] ?? null,
      traceId: request.headers['x-trace-id'] ?? null,
    });
  }

  @Post('ai/provider-connections')
  @RequiredPermissions('settings.ai.view')
  createAiProviderConnection(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.aiSettingsService.createProviderConnection({
      actor,
      access,
      request: parseCreateProviderConnection(body),
      requestId: request.headers['x-request-id'] ?? null,
      traceId: request.headers['x-trace-id'] ?? null,
    });
  }

  @Patch('ai/provider-connections/:id')
  @RequiredPermissions('settings.ai.view')
  updateAiProviderConnection(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') connectionId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.aiSettingsService.updateProviderConnection({
      actor,
      access,
      connectionId,
      request: parseUpdateProviderConnection(body),
      requestId: request.headers['x-request-id'] ?? null,
      traceId: request.headers['x-trace-id'] ?? null,
    });
  }

  @Post('ai/provider-connections/:id/secret')
  @RequiredPermissions('settings.ai.view')
  replaceAiProviderConnectionSecret(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') connectionId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.aiSettingsService.replaceSecret({
      actor,
      access,
      connectionId,
      apiKey: parseSecretReplacement(body).apiKey,
      requestId: request.headers['x-request-id'] ?? null,
      traceId: request.headers['x-trace-id'] ?? null,
    });
  }

  @Post('ai/provider-connections/:id/test')
  @RequiredPermissions('settings.ai.connection.test')
  testAiProviderConnection(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') connectionId: string,
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.aiSettingsService.testConnection({
      actor,
      access,
      connectionId,
      requestId: request.headers['x-request-id'] ?? null,
      traceId: request.headers['x-trace-id'] ?? null,
    });
  }

  @Patch('ai/route-groups/:routeGroup')
  @RequiredPermissions('settings.ai.view')
  updateAiRouteGroupPreference(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('routeGroup') routeGroup: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.aiSettingsService.updateRouteGroupPreference({
      actor,
      access,
      routeGroup: routeGroup as never,
      request: parseRouteGroupPreference(body),
      requestId: request.headers['x-request-id'] ?? null,
      traceId: request.headers['x-trace-id'] ?? null,
    });
  }

  @Get('ai/effective-policy')
  @RequiredPermissions('settings.ai.effective_policy.view')
  getAiEffectivePolicy(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.aiSettingsService.getEffectivePolicy({
      actor,
      access,
      traceId: request.headers['x-trace-id'] ?? null,
    });
  }
}

function requireContext(context: LexframeRequest['lexframe']) {
  if (!context?.actor || !context.access) {
    throw new Error('Workspace access context was not attached.');
  }

  return {
    actor: context.actor,
    access: context.access,
  };
}

function parseProfileUpdate(body: unknown): UpdateProfileSettingsRequest {
  return new ManualFormSettingsFormatAdapter((record) => ({
    firstName: optionalString(record.firstName, 'firstName'),
    lastName: optionalString(record.lastName, 'lastName'),
    displayName: optionalString(record.displayName, 'displayName'),
    locale: optionalString(record.locale, 'locale', 16),
    timezone: optionalString(record.timezone, 'timezone', 64),
  })).parse(body);
}

function parseOrganizationUpdate(
  body: unknown,
): UpdateOrganizationSettingsRequest {
  return new ManualFormSettingsFormatAdapter((record) => ({
    organizationDisplayName: optionalString(
      record.organizationDisplayName,
      'organizationDisplayName',
    ),
    organizationLegalName: optionalString(
      record.organizationLegalName,
      'organizationLegalName',
    ),
  })).parse(body);
}

function parseCreateProviderConnection(
  body: unknown,
): CreateAiProviderConnectionRequest {
  return new ManualFormSettingsFormatAdapter((record) => ({
    routeGroup: requiredString(record.routeGroup, 'routeGroup') as never,
    ownerScope: optionalString(record.ownerScope, 'ownerScope') as never,
    providerCode: requiredString(record.providerCode, 'providerCode') as never,
    uiLabel: optionalString(record.uiLabel, 'uiLabel'),
    baseUrl: requiredString(record.baseUrl, 'baseUrl', 2048),
    modelId: requiredString(record.modelId, 'modelId'),
    apiKey: optionalString(record.apiKey, 'apiKey', 4096),
    capabilities: parseCapabilities(record.capabilities),
  })).parse(body);
}

function parseUpdateProviderConnection(
  body: unknown,
): UpdateAiProviderConnectionRequest {
  return new ManualFormSettingsFormatAdapter((record) => ({
    providerCode: optionalString(record.providerCode, 'providerCode') as never,
    uiLabel: optionalString(record.uiLabel, 'uiLabel'),
    baseUrl: optionalString(record.baseUrl, 'baseUrl', 2048) ?? undefined,
    modelId: optionalString(record.modelId, 'modelId') ?? undefined,
    enabled: optionalBoolean(record.enabled, 'enabled'),
    capabilities: parseCapabilities(record.capabilities),
  })).parse(body);
}

function parseSecretReplacement(body: unknown): { readonly apiKey: string } {
  return new ManualFormSettingsFormatAdapter((record) => ({
    apiKey: requiredString(record.apiKey, 'apiKey', 4096),
  })).parse(body);
}

function parseRouteGroupPreference(
  body: unknown,
): UpdateAiRouteGroupPreferenceRequest {
  return new ManualFormSettingsFormatAdapter((record) => ({
    scopeType: requiredString(record.scopeType, 'scopeType') as never,
    providerConnectionId: requiredString(
      record.providerConnectionId,
      'providerConnectionId',
    ),
    modelId: optionalString(record.modelId, 'modelId') ?? undefined,
    enabled: optionalBoolean(record.enabled, 'enabled'),
    capabilitiesConfirmed: parseCapabilities(record.capabilitiesConfirmed),
  })).parse(body);
}

function parseCapabilities(value: unknown) {
  const record = optionalObject(value, 'capabilities');
  if (!record) {
    return undefined;
  }

  return {
    streaming: optionalBoolean(record.streaming, 'streaming'),
    jsonMode: optionalBoolean(record.jsonMode, 'jsonMode'),
    structuredJsonSchema: optionalBoolean(
      record.structuredJsonSchema,
      'structuredJsonSchema',
    ),
    toolCalls: optionalBoolean(record.toolCalls, 'toolCalls'),
  };
}
