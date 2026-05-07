import type {
  CreateAutomationIntentRequest,
  UpdateAutomationIntentRequest,
} from '@lexframe/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import type { LexframeRequestState } from '../../common/types/lexframe-request';
import { AutomationBuilderService } from './automation-builder.service';

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class AutomationBuilderController {
  constructor(
    private readonly automationBuilderService: AutomationBuilderService,
  ) {}

  @Post('projects/:projectId/automation-intents')
  @RequiredPermissions('automation_builder.create_intent')
  createIntent(
    @LexframeRequestContext() context: LexframeRequestState,
    @Param('projectId') projectId: string,
    @Body() body: CreateAutomationIntentRequest,
  ) {
    return this.automationBuilderService.createIntent(
      requireActor(context),
      requireAccess(context),
      projectId,
      body,
      requestMeta(),
    );
  }

  @Get('automation-intents/:intentId')
  @RequiredPermissions('automation_builder.view')
  getIntent(
    @LexframeRequestContext() context: LexframeRequestState,
    @Param('intentId') intentId: string,
  ) {
    return this.automationBuilderService.getIntent(
      requireAccess(context),
      intentId,
    );
  }

  @Patch('automation-intents/:intentId')
  @RequiredPermissions('automation_builder.create_intent')
  updateIntent(
    @LexframeRequestContext() context: LexframeRequestState,
    @Param('intentId') intentId: string,
    @Body() body: UpdateAutomationIntentRequest,
  ) {
    return this.automationBuilderService.updateIntent(
      requireActor(context),
      requireAccess(context),
      intentId,
      body,
      requestMeta(),
    );
  }

  @Post('automation-intents/:intentId/cancel')
  @RequiredPermissions('automation_builder.create_intent')
  cancelIntent(
    @LexframeRequestContext() context: LexframeRequestState,
    @Param('intentId') intentId: string,
  ) {
    return this.automationBuilderService.cancelIntent(
      requireActor(context),
      requireAccess(context),
      intentId,
      requestMeta(),
    );
  }

  @Post('automation-intents/:intentId/plan')
  @RequiredPermissions('automation_builder.plan')
  planIntent(
    @LexframeRequestContext() context: LexframeRequestState,
    @Param('intentId') intentId: string,
  ) {
    return this.automationBuilderService.planIntent(
      requireActor(context),
      requireAccess(context),
      intentId,
      requestMeta(),
    );
  }

  @Post('automation-intents/:intentId/plan:stream')
  @RequiredPermissions('automation_builder.plan')
  planIntentStream(
    @LexframeRequestContext() context: LexframeRequestState,
    @Param('intentId') intentId: string,
  ) {
    return this.automationBuilderService.planIntent(
      requireActor(context),
      requireAccess(context),
      intentId,
      requestMeta(),
    );
  }

  @Post('automation-intents/:intentId/clarifications')
  @RequiredPermissions('automation_builder.answer_clarification')
  listClarifications(@Param('intentId') intentId: string) {
    return { intentId, clarifications: [] };
  }

  @Post('automation-intents/:intentId/clarifications/:clarificationId/answer')
  @RequiredPermissions('automation_builder.answer_clarification')
  answerClarification(
    @LexframeRequestContext() context: LexframeRequestState,
    @Param('clarificationId') clarificationId: string,
    @Body() body: { readonly answer?: unknown },
  ) {
    return this.automationBuilderService.answerClarification(
      requireActor(context),
      requireAccess(context),
      clarificationId,
      body.answer ?? body,
      requestMeta(),
    );
  }

  @Get('automation-blueprints/:blueprintId')
  @RequiredPermissions('automation_builder.view')
  getBlueprint(
    @LexframeRequestContext() context: LexframeRequestState,
    @Param('blueprintId') blueprintId: string,
  ) {
    return this.automationBuilderService.getBlueprint(
      requireAccess(context),
      blueprintId,
    );
  }

  @Post('automation-blueprints/:blueprintId/validate')
  @RequiredPermissions('automation_builder.validate')
  validateBlueprint(
    @LexframeRequestContext() context: LexframeRequestState,
    @Param('blueprintId') blueprintId: string,
  ) {
    return this.automationBuilderService.validateBlueprint(
      requireActor(context),
      requireAccess(context),
      blueprintId,
      requestMeta(),
    );
  }

  @Post('automation-blueprints/:blueprintId/compile-preview')
  @RequiredPermissions('automation_builder.validate')
  compilePreview(
    @LexframeRequestContext() context: LexframeRequestState,
    @Param('blueprintId') blueprintId: string,
  ) {
    return this.automationBuilderService.compilePreview(
      requireActor(context),
      requireAccess(context),
      blueprintId,
      requestMeta(),
    );
  }

  @Post('automation-blueprints/:blueprintId/approve')
  @RequiredPermissions('automation_builder.approve_blueprint')
  approveBlueprint(
    @LexframeRequestContext() context: LexframeRequestState,
    @Param('blueprintId') blueprintId: string,
  ) {
    return this.automationBuilderService.approveBlueprint(
      requireActor(context),
      requireAccess(context),
      blueprintId,
      requestMeta(),
    );
  }

  @Post('automation-blueprints/:blueprintId/reject')
  @RequiredPermissions('automation_builder.reject_blueprint')
  rejectBlueprint(
    @LexframeRequestContext() context: LexframeRequestState,
    @Param('blueprintId') blueprintId: string,
  ) {
    return this.automationBuilderService.rejectBlueprint(
      requireActor(context),
      requireAccess(context),
      blueprintId,
      requestMeta(),
    );
  }

  @Post('automation-blueprints/:blueprintId/convert-to-canvas-draft')
  @RequiredPermissions(
    'automation_builder.convert_to_canvas_draft',
    'canvas.edit',
  )
  convertToCanvasDraft(
    @LexframeRequestContext() context: LexframeRequestState,
    @Param('blueprintId') blueprintId: string,
  ) {
    return this.automationBuilderService.convertToCanvasDraft(
      requireActor(context),
      requireAccess(context),
      blueprintId,
      requestMeta(),
    );
  }

  @Post('automation-blueprints/:blueprintId/create-runtime-draft')
  @RequiredPermissions(
    'automation_builder.create_runtime_draft',
    'activepieces.sync_flow',
  )
  createRuntimeDraft(
    @LexframeRequestContext() context: LexframeRequestState,
    @Param('blueprintId') blueprintId: string,
  ) {
    return this.automationBuilderService.createRuntimeDraft(
      requireActor(context),
      requireAccess(context),
      blueprintId,
      requestMeta(),
    );
  }

  @Post('automation-blueprints/:blueprintId/export')
  @RequiredPermissions('automation_builder.export')
  exportBlueprint(
    @LexframeRequestContext() context: LexframeRequestState,
    @Param('blueprintId') blueprintId: string,
  ) {
    return this.automationBuilderService.getBlueprint(
      requireAccess(context),
      blueprintId,
    );
  }

  @Get('automation-builder/sessions/:sessionId')
  @RequiredPermissions('automation_builder.view')
  getSession(@Param('sessionId') sessionId: string) {
    return { id: sessionId, status: 'active' };
  }

  @Post('automation-builder/sessions')
  @RequiredPermissions('automation_builder.create_intent')
  createSession(
    @LexframeRequestContext() context: LexframeRequestState,
    @Body() body: { readonly projectId?: string; readonly title?: string },
  ) {
    return this.automationBuilderService.createSession(
      requireActor(context),
      requireAccess(context),
      body,
      requestMeta(),
    );
  }

  @Post('automation-builder/sessions/:sessionId/archive')
  @RequiredPermissions('automation_builder.create_intent')
  archiveSession(
    @LexframeRequestContext() context: LexframeRequestState,
    @Param('sessionId') sessionId: string,
  ) {
    return this.automationBuilderService.archiveSession(
      requireActor(context),
      requireAccess(context),
      sessionId,
      requestMeta(),
    );
  }

  @Get('automation-builder/module-catalog')
  @RequiredPermissions('automation_builder.view')
  getModuleCatalog() {
    return this.automationBuilderService.getModuleCatalog();
  }

  @Post('automation-builder/module-catalog/resolve')
  @RequiredPermissions('automation_builder.validate')
  resolveModuleCatalog(
    @Body()
    body: {
      readonly steps?: readonly {
        readonly kind?: string;
        readonly moduleCode?: string | null;
      }[];
    },
  ) {
    return this.automationBuilderService.resolveModuleCatalog(body);
  }

  @Post('automation-builder/context/preview')
  @RequiredPermissions('automation_builder.view')
  previewContext(
    @LexframeRequestContext() context: LexframeRequestState,
    @Body()
    body: {
      readonly projectId?: string | null;
      readonly intentId?: string | null;
    },
  ) {
    return this.automationBuilderService.previewContext(
      requireAccess(context),
      body,
    );
  }

  @Post('automation-builder/security/preflight')
  @RequiredPermissions('automation_builder.view')
  securityPreflight(@LexframeRequestContext() context: LexframeRequestState) {
    return this.automationBuilderService.securityPreflight(
      requireAccess(context),
    );
  }
}

function requireActor(context: LexframeRequestState) {
  if (!context.actor) {
    throw new Error('Authenticated actor is required.');
  }
  return context.actor;
}

function requireAccess(context: LexframeRequestState) {
  if (!context.access) {
    throw new Error('Workspace access is required.');
  }
  return context.access;
}

function requestMeta() {
  return { requestId: null, traceId: null };
}
