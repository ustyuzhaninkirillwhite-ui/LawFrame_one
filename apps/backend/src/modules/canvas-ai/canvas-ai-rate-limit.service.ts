import type { AccessContext } from '../../common/types/lexframe-request';
import type { CanvasAiMode } from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AiPolicyService } from '../ai-gateway/ai-policy.service';

const WINDOW_MS = 60_000;
const MODE_LIMITS: Record<CanvasAiMode, number> = {
  explain: 30,
  edit: 12,
  fix_validation: 12,
  configure_step: 12,
  test_plan: 20,
  debug_test: 12,
};

@Injectable()
export class CanvasAiRateLimitService {
  private readonly buckets = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(private readonly aiPolicyService: AiPolicyService) {}

  async ensureAllowed(input: {
    readonly access: AccessContext;
    readonly automationId: string;
    readonly mode: CanvasAiMode;
  }) {
    const workspaceId = input.access.activeWorkspace?.id;
    if (!workspaceId) {
      throw new AppHttpException(
        'WORKSPACE_CONTEXT_REQUIRED',
        403,
        'Workspace context is required for Canvas AI.',
      );
    }

    const policy = await this.aiPolicyService.getWorkspacePolicy(workspaceId);
    await this.aiPolicyService.ensureRateLimit(workspaceId, policy);
    await this.aiPolicyService.ensureBudgetAvailable(workspaceId, policy);

    const key = `${workspaceId}:${input.automationId}:${input.mode}`;
    const now = Date.now();
    const current = this.buckets.get(key);
    const bucket =
      current && current.resetAt > now
        ? current
        : { count: 0, resetAt: now + WINDOW_MS };
    bucket.count += 1;
    this.buckets.set(key, bucket);

    if (bucket.count > MODE_LIMITS[input.mode]) {
      throw new AppHttpException(
        'RATE_LIMITED',
        429,
        'Canvas AI rate limit exceeded for this automation and mode.',
      );
    }
  }
}
