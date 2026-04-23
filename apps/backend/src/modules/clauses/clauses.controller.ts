import type {
  CreateClauseLibraryItemRequest,
  CreatePhraseRuleRequest,
  UpdateClauseLibraryItemRequest,
  UpdatePhraseRuleRequest,
} from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
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
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  asRecord,
  expectString,
  optionalRecord,
  optionalString,
  optionalStringArray,
  requestMeta,
} from '../stage7-support/stage7.helpers';
import { ClausesService } from './clauses.service';

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class ClausesController {
  constructor(private readonly clausesService: ClausesService) {}

  @Get('clauses')
  @RequiredPermissions('profile.read')
  listClauses(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.clausesService.listClauses(context.access, context.actor?.id ?? null);
  }

  @Post('clauses')
  @HttpCode(200)
  @RequiredPermissions('profile.update')
  createClause(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.clausesService.createClause(
      context.actor,
      context.access,
      parseCreateClauseLibraryItemRequest(body),
      requestMeta(request),
    );
  }

  @Patch('clauses/:id')
  @RequiredPermissions('profile.update')
  updateClause(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.clausesService.updateClause(
      context.actor,
      context.access,
      id,
      parseUpdateClauseLibraryItemRequest(body),
      requestMeta(request),
    );
  }

  @Get('phrase-rules')
  @RequiredPermissions('profile.read')
  listPhraseRules(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.clausesService.listPhraseRules(context.access, context.actor?.id ?? null);
  }

  @Post('phrase-rules')
  @HttpCode(200)
  @RequiredPermissions('profile.update')
  createPhraseRule(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.clausesService.createPhraseRule(
      context.actor,
      context.access,
      parseCreatePhraseRuleRequest(body),
      requestMeta(request),
    );
  }

  @Patch('phrase-rules/:id')
  @RequiredPermissions('profile.update')
  updatePhraseRule(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.clausesService.updatePhraseRule(
      context.actor,
      context.access,
      id,
      parseUpdatePhraseRuleRequest(body),
      requestMeta(request),
    );
  }
}

function parseCreateClauseLibraryItemRequest(
  body: unknown,
): CreateClauseLibraryItemRequest {
  const value = asRecord(body);

  return {
    workspaceId: optionalString(value.workspaceId),
    ownerUserId: optionalString(value.ownerUserId),
    scope: expectClauseScope(value.scope),
    title: expectString(value.title, 'Clause title is required.'),
    tags: optionalStringArray(value.tags) ?? [],
    richText: optionalRecord(value.richText) ?? {},
  };
}

function parseUpdateClauseLibraryItemRequest(
  body: unknown,
): UpdateClauseLibraryItemRequest {
  const value = asRecord(body);

  return {
    ...(value.title !== undefined ? { title: expectString(value.title, 'Clause title must be a string.') } : {}),
    ...(value.tags !== undefined ? { tags: optionalStringArray(value.tags) ?? [] } : {}),
    ...(value.richText !== undefined ? { richText: optionalRecord(value.richText) ?? {} } : {}),
    ...(value.status !== undefined ? { status: expectClauseStatus(value.status) } : {}),
  };
}

function parseCreatePhraseRuleRequest(body: unknown): CreatePhraseRuleRequest {
  const value = asRecord(body);

  return {
    workspaceId: optionalString(value.workspaceId),
    ownerUserId: optionalString(value.ownerUserId),
    ruleType: expectRuleType(value.ruleType),
    phrase: expectString(value.phrase, 'Phrase rule text is required.'),
    rationale: optionalString(value.rationale),
  };
}

function parseUpdatePhraseRuleRequest(body: unknown): UpdatePhraseRuleRequest {
  const value = asRecord(body);

  return {
    ...(value.phrase !== undefined ? { phrase: expectString(value.phrase, 'Phrase must be a string.') } : {}),
    ...(value.rationale !== undefined ? { rationale: optionalString(value.rationale) } : {}),
  };
}

function expectClauseScope(value: unknown): CreateClauseLibraryItemRequest['scope'] {
  if (value === 'system' || value === 'workspace' || value === 'personal') {
    return value;
  }

  throw new Error('Clause scope must be system, workspace or personal.');
}

function expectClauseStatus(value: unknown): NonNullable<UpdateClauseLibraryItemRequest['status']> {
  if (value === 'draft' || value === 'published' || value === 'archived') {
    return value;
  }

  throw new Error('Clause status is invalid.');
}

function expectRuleType(value: unknown): CreatePhraseRuleRequest['ruleType'] {
  if (value === 'preferred' || value === 'forbidden') {
    return value;
  }

  throw new Error('Phrase rule type must be preferred or forbidden.');
}
