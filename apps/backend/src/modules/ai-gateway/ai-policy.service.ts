import type { AiProviderPolicy, DataClassification } from '@lexframe/contracts';
import type { AiPolicyContext } from '../../common/types/lexframe-request';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

interface WorkspaceAiPolicyRow {
  readonly workspace_id: string;
  readonly ai_enabled: boolean;
  readonly allow_confidential: boolean;
  readonly allow_legal_secret: boolean;
  readonly cometapi_public_enabled: boolean;
  readonly plaintext_opt_in: boolean;
  readonly sensitive_logging: boolean;
  readonly monthly_budget_usd: string | number;
  readonly requests_per_minute_limit: number;
}

interface AiProviderPolicyRow {
  readonly id: string;
  readonly workspace_id: string | null;
  readonly provider: string;
  readonly model: string;
  readonly allowed_data_classes: readonly string[] | null;
  readonly requires_zdr: boolean;
  readonly requires_redaction: boolean;
  readonly store_prompts: boolean;
  readonly max_tokens: number | null;
  readonly monthly_budget_cents: number | null;
  readonly enabled: boolean;
}

const DEFAULT_POLICY: AiPolicyContext = {
  aiEnabled: true,
  allowConfidential: true,
  allowLegalSecret: false,
  cometapiPublicEnabled: true,
  plaintextOptIn: false,
  sensitiveLogging: false,
  monthlyBudgetUsd: 50,
  requestsPerMinuteLimit: 20,
};

@Injectable()
export class AiPolicyService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getWorkspacePolicy(workspaceId: string): Promise<AiPolicyContext> {
    const row = await this.databaseService.one<WorkspaceAiPolicyRow>(
      `
        select
          workspace_id,
          ai_enabled,
          allow_confidential,
          allow_legal_secret,
          cometapi_public_enabled,
          plaintext_opt_in,
          sensitive_logging,
          monthly_budget_usd,
          requests_per_minute_limit
        from app.workspace_ai_policies
        where workspace_id = $1
      `,
      [workspaceId],
    );

    if (!row) {
      return DEFAULT_POLICY;
    }

    return {
      aiEnabled: row.ai_enabled,
      allowConfidential: row.allow_confidential,
      allowLegalSecret: row.allow_legal_secret,
      cometapiPublicEnabled: row.cometapi_public_enabled,
      plaintextOptIn: row.plaintext_opt_in,
      sensitiveLogging: row.sensitive_logging,
      monthlyBudgetUsd: Number(
        row.monthly_budget_usd ?? DEFAULT_POLICY.monthlyBudgetUsd,
      ),
      requestsPerMinuteLimit:
        row.requests_per_minute_limit ?? DEFAULT_POLICY.requestsPerMinuteLimit,
    };
  }

  async listProviderPolicies(
    workspaceId: string | null,
  ): Promise<readonly AiProviderPolicy[]> {
    const result = await this.databaseService.query<AiProviderPolicyRow>(
      `
        select
          id,
          workspace_id,
          provider,
          model,
          allowed_data_classes,
          requires_zdr,
          requires_redaction,
          store_prompts,
          max_tokens,
          monthly_budget_cents,
          enabled
        from app.ai_provider_policies
        where workspace_id is null
          or workspace_id = $1
        order by workspace_id nulls first, provider asc, model asc
      `,
      [workspaceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      provider: row.provider,
      model: row.model,
      allowedDataClasses: (row.allowed_data_classes ??
        []) as readonly DataClassification[],
      requiresZdr: row.requires_zdr,
      requiresRedaction: row.requires_redaction,
      storePrompts: row.store_prompts,
      maxTokens: row.max_tokens,
      monthlyBudgetCents: row.monthly_budget_cents,
      enabled: row.enabled,
    }));
  }

  async ensureBudgetAvailable(
    workspaceId: string,
    policy: AiPolicyContext,
  ): Promise<void> {
    const result = await this.databaseService.one<{
      readonly cost_usd: string | number;
    }>(
      `
        select coalesce(sum(cost_usd), 0) as cost_usd
        from app.ai_cost_usage
        where workspace_id = $1
          and created_at >= date_trunc('month', timezone('utc', now()))
      `,
      [workspaceId],
    );

    const currentUsage = Number(result?.cost_usd ?? 0);

    if (currentUsage >= policy.monthlyBudgetUsd) {
      throw new AppHttpException(
        'AI_BUDGET_EXCEEDED',
        429,
        'Месячный лимит бюджета ИИ для этого рабочего пространства исчерпан.',
        {
          currentUsage,
          monthlyBudgetUsd: policy.monthlyBudgetUsd,
        },
      );
    }
  }

  async ensureRateLimit(
    workspaceId: string,
    policy: AiPolicyContext,
  ): Promise<void> {
    const result = await this.databaseService.one<{
      readonly total: string | number;
    }>(
      `
        select count(*) as total
        from app.ai_requests
        where workspace_id = $1
          and created_at >= timezone('utc', now()) - interval '1 minute'
      `,
      [workspaceId],
    );

    const total = Number(result?.total ?? 0);

    if (total >= policy.requestsPerMinuteLimit) {
      throw new AppHttpException(
        'AI_BUDGET_EXCEEDED',
        429,
        'Достигнут лимит частоты ИИ-запросов для этого рабочего пространства.',
        {
          total,
          limit: policy.requestsPerMinuteLimit,
        },
      );
    }
  }
}
