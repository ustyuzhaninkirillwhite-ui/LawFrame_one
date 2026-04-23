import type {
  AccessReviewCampaign,
  ComplianceProcessingActivity,
  DsrRequest,
  RetentionPolicy,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

interface ProcessingActivityRow {
  readonly id: string;
  readonly workspace_id: string | null;
  readonly activity_code: string;
  readonly purpose: string;
  readonly legal_basis: string | null;
  readonly data_categories: readonly string[] | null;
  readonly recipient_categories: readonly string[] | null;
  readonly retention_policy_id: string | null;
  readonly owner_user_id: string | null;
}

interface RetentionPolicyRow {
  readonly id: string;
  readonly workspace_id: string | null;
  readonly code: string;
  readonly label: string;
  readonly retention_days: number;
  readonly legal_hold_enabled: boolean;
}

interface DsrRequestRow {
  readonly id: string;
  readonly user_id: string | null;
  readonly workspace_id: string | null;
  readonly request_type: DsrRequest['requestType'];
  readonly status: DsrRequest['status'];
  readonly created_at: string;
  readonly updated_at: string;
}

interface AccessReviewCampaignRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly title: string;
  readonly status: AccessReviewCampaign['status'];
  readonly due_at: string | null;
  readonly created_at: string;
}

@Injectable()
export class ComplianceService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listProcessingActivities(
    workspaceId: string | null,
  ): Promise<readonly ComplianceProcessingActivity[]> {
    const result = await this.databaseService.query<ProcessingActivityRow>(
      `
        select
          id,
          workspace_id,
          activity_code,
          purpose,
          legal_basis,
          data_categories,
          recipient_categories,
          retention_policy_id,
          owner_user_id
        from app.processing_activities
        where ($1::uuid is null or workspace_id = $1)
        order by activity_code asc
      `,
      [workspaceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      activityCode: row.activity_code,
      purpose: row.purpose,
      legalBasis: row.legal_basis,
      dataCategories: row.data_categories ?? [],
      recipientCategories: row.recipient_categories ?? [],
      retentionPolicyId: row.retention_policy_id,
      ownerUserId: row.owner_user_id,
    }));
  }

  async listRetentionPolicies(
    workspaceId: string | null,
  ): Promise<readonly RetentionPolicy[]> {
    const result = await this.databaseService.query<RetentionPolicyRow>(
      `
        select
          id,
          workspace_id,
          code,
          label,
          retention_days,
          legal_hold_enabled
        from app.retention_policies
        where ($1::uuid is null or workspace_id = $1)
        order by code asc
      `,
      [workspaceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      code: row.code,
      label: row.label,
      retentionDays: row.retention_days,
      legalHoldEnabled: row.legal_hold_enabled,
    }));
  }

  async listDsrRequests(workspaceId: string | null): Promise<readonly DsrRequest[]> {
    const result = await this.databaseService.query<DsrRequestRow>(
      `
        select
          id,
          user_id,
          workspace_id,
          request_type,
          status,
          created_at,
          updated_at
        from app.dsr_requests
        where ($1::uuid is null or workspace_id = $1)
        order by created_at desc
      `,
      [workspaceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      requestType: row.request_type,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async listAccessReviewCampaigns(
    workspaceId: string | null,
  ): Promise<readonly AccessReviewCampaign[]> {
    const result = await this.databaseService.query<AccessReviewCampaignRow>(
      `
        select
          id,
          workspace_id,
          title,
          status,
          due_at,
          created_at
        from app.access_review_campaigns
        where ($1::uuid is null or workspace_id = $1)
        order by created_at desc
      `,
      [workspaceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      title: row.title,
      status: row.status,
      dueAt: row.due_at,
      createdAt: row.created_at,
    }));
  }

  async getRetentionReport(workspaceId: string | null) {
    const policies = await this.listRetentionPolicies(workspaceId);
    const dsrRequests = await this.listDsrRequests(workspaceId);
    return {
      policies,
      dsrRequestsOpen: dsrRequests.filter((item) => item.status !== 'completed').length,
    };
  }
}
