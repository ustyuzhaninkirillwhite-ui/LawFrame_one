import type {
  CanvasAiMessageRequest,
  CanvasAiMode,
  CanvasAiPatchApplyRequest,
  CanvasAiPatchRejectRequest,
} from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
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
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { requestMeta } from '../../common/http/request-parsing';
import { CanvasAiOrchestrator } from './canvas-ai-orchestrator.service';

@Controller('automations/:automationId/canvas/ai')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class CanvasAiController {
  constructor(private readonly orchestrator: CanvasAiOrchestrator) {}

  @Post('messages')
  @HttpCode(200)
  @RequiredPermissions('canvas.ai.use')
  sendMessage(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.orchestrator.sendMessage({
      actor,
      access,
      automationId,
      request: parseMessageRequest(body, 'edit'),
      meta: requestMeta(request),
    });
  }

  @Post('propose-patch')
  @HttpCode(200)
  @RequiredPermissions('canvas.ai.use', 'canvas.ai.propose_patch')
  proposePatch(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.orchestrator.proposePatch({
      actor,
      access,
      automationId,
      request: parseMessageRequest(body, 'edit'),
      meta: requestMeta(request),
    });
  }

  @Post('explain')
  @HttpCode(200)
  @RequiredPermissions('canvas.ai.use', 'canvas.ai.explain')
  explain(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.orchestrator.explain({
      actor,
      access,
      automationId,
      request: parseMessageRequest(body, 'explain'),
      meta: requestMeta(request),
    });
  }

  @Post('fix-validation')
  @HttpCode(200)
  @RequiredPermissions('canvas.ai.use', 'canvas.ai.fix_validation')
  fixValidation(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.orchestrator.fixValidation({
      actor,
      access,
      automationId,
      request: parseMessageRequest(body, 'fix_validation'),
      meta: requestMeta(request),
    });
  }

  @Post('configure-step')
  @HttpCode(200)
  @RequiredPermissions('canvas.ai.use', 'canvas.ai.configure_step')
  configureStep(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.orchestrator.configureStep({
      actor,
      access,
      automationId,
      request: parseMessageRequest(body, 'configure_step'),
      meta: requestMeta(request),
    });
  }

  @Post('test-plan')
  @HttpCode(200)
  @RequiredPermissions('canvas.ai.use')
  createTestPlan(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.orchestrator.createTestPlan({
      actor,
      access,
      automationId,
      request: parseMessageRequest(body, 'test_plan'),
      meta: requestMeta(request),
    });
  }

  @Post('debug-test')
  @HttpCode(200)
  @RequiredPermissions('canvas.ai.use', 'canvas.ai.debug_test')
  debugTest(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.orchestrator.debugTest({
      actor,
      access,
      automationId,
      request: parseMessageRequest(body, 'debug_test'),
      meta: requestMeta(request),
    });
  }

  @Post('apply-patch')
  @HttpCode(200)
  @RequiredPermissions('canvas.ai.use', 'canvas.ai.apply_patch')
  applyPatch(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.orchestrator.applyPatch({
      actor,
      access,
      automationId,
      request: parseApplyRequest(body),
      meta: requestMeta(request),
    });
  }

  @Get('sessions/:sessionId')
  @RequiredPermissions('canvas.ai.use')
  getSession(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('sessionId') sessionId: string,
  ) {
    const { access } = requireContext(context);
    return this.orchestrator.getSession({ access, automationId, sessionId });
  }

  @Get('patches/:patchId')
  @RequiredPermissions('canvas.ai.use')
  getPatch(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('patchId') patchId: string,
  ) {
    const { access } = requireContext(context);
    return this.orchestrator.getPatch({ access, automationId, patchId });
  }

  @Post('patches/:patchId/reject')
  @HttpCode(200)
  @RequiredPermissions('canvas.ai.use', 'canvas.ai.propose_patch')
  rejectPatch(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('automationId') automationId: string,
    @Param('patchId') patchId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    const { actor, access } = requireContext(context);
    return this.orchestrator.rejectPatch({
      actor,
      access,
      automationId,
      patchId,
      request: parseRejectRequest(body),
      meta: requestMeta(request),
    });
  }
}

function requireContext(context: LexframeRequest['lexframe']) {
  if (!context?.actor || !context.access) {
    throw new Error('Workspace access context was not attached.');
  }
  return { actor: context.actor, access: context.access };
}

function parseMessageRequest(
  body: unknown,
  defaultMode: CanvasAiMode,
): CanvasAiMessageRequest {
  const payload = isRecord(body) ? body : {};
  return {
    session_id: optionalString(payload.session_id ?? payload.sessionId),
    mode: parseMode(payload.mode, defaultMode),
    message:
      optionalString(
        payload.message ?? payload.prompt ?? payload.instruction,
      ) ?? defaultMessage(defaultMode),
    draft_version_id: optionalString(
      payload.draft_version_id ?? payload.draftVersionId,
    ),
    base_workflow_hash: optionalString(
      payload.base_workflow_hash ?? payload.baseWorkflowHash,
    ),
    selected_node_id: optionalString(
      payload.selected_node_id ?? payload.selectedNodeId ?? payload.node_id,
    ),
    selected_edge_id: optionalString(
      payload.selected_edge_id ?? payload.selectedEdgeId ?? payload.edge_id,
    ),
    selected_validation_issue_id: optionalString(
      payload.selected_validation_issue_id ??
        payload.selectedValidationIssueId ??
        payload.issue_id,
    ),
    client_context: isRecord(payload.client_context)
      ? payload.client_context
      : isRecord(payload.clientContext)
        ? payload.clientContext
        : null,
    include_sensitive_context:
      (payload.include_sensitive_context ?? payload.includeSensitiveContext) ===
      true,
    idempotency_key: optionalString(
      payload.idempotency_key ?? payload.idempotencyKey,
    ),
  };
}

function parseApplyRequest(body: unknown): CanvasAiPatchApplyRequest {
  if (!isRecord(body)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Canvas AI apply request body must be an object.',
    );
  }
  return {
    patch_id: expectString(body.patch_id ?? body.patchId, 'patch_id'),
    base_workflow_hash: expectString(
      body.base_workflow_hash ?? body.baseWorkflowHash,
      'base_workflow_hash',
    ),
    user_confirmation:
      (body.user_confirmation ?? body.userConfirmation) === true,
    idempotency_key: optionalString(
      body.idempotency_key ?? body.idempotencyKey,
    ),
  };
}

function parseRejectRequest(body: unknown): CanvasAiPatchRejectRequest {
  const payload = isRecord(body) ? body : {};
  return { reason: optionalString(payload.reason) };
}

function parseMode(value: unknown, fallback: CanvasAiMode): CanvasAiMode {
  switch (value) {
    case 'explain':
    case 'edit':
    case 'fix_validation':
    case 'configure_step':
    case 'test_plan':
    case 'debug_test':
      return value;
    default:
      return fallback;
  }
}

function defaultMessage(mode: CanvasAiMode) {
  switch (mode) {
    case 'explain':
      return 'Explain the current Canvas workflow.';
    case 'fix_validation':
      return 'Propose a fix for the selected validation issue.';
    case 'configure_step':
      return 'Propose configuration for the selected step.';
    case 'test_plan':
      return 'Create a draft-only test plan.';
    case 'debug_test':
      return 'Explain the redacted test failure.';
    default:
      return 'Propose a Canvas patch.';
  }
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
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
