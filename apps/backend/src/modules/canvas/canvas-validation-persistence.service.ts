import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import type {
  CanvasValidationResult,
  ValidationIssue,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { requireWorkspaceId } from './canvas-access';

interface PersistValidationRunInput {
  readonly actor: AuthenticatedActor;
  readonly access: AccessContext;
  readonly automationId: string;
  readonly draftId: string | null;
  readonly revision: number | null;
  readonly result: CanvasValidationResult;
  readonly source?: string;
}

interface ValidationIssueRow {
  readonly id: string;
  readonly issue_id: string;
  readonly validation_run_id: string;
  readonly code: string;
  readonly category: ValidationIssue['category'];
  readonly severity: ValidationIssue['severity'];
  readonly message: string;
  readonly developer_message: string | null;
  readonly node_id: string | null;
  readonly edge_id: string | null;
  readonly binding_id: string | null;
  readonly input_key: string | null;
  readonly field_path: string | null;
  readonly blocks: readonly string[];
  readonly suggested_fixes: readonly unknown[];
  readonly evidence: Record<string, unknown>;
  readonly created_at: string;
}

@Injectable()
export class CanvasValidationPersistenceService {
  constructor(private readonly databaseService: DatabaseService) {}

  async persistRun(input: PersistValidationRunInput) {
    const workspaceId = requireWorkspaceId(input.access);
    const startedAt = input.result.created_at;
    const finishedAt = new Date().toISOString();
    const durationMs = Math.max(
      0,
      Date.parse(finishedAt) - Date.parse(startedAt),
    );
    const cacheKey = `${input.result.mode}:${input.result.workflow_hash}`;

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          insert into app.automation_canvas_validation_results (
            id,
            workspace_id,
            installed_automation_id,
            draft_version_id,
            revision,
            validation_level,
            mode,
            status,
            errors,
            warnings,
            policy_blocks,
            summary,
            can_save,
            can_test,
            can_publish,
            can_compile,
            can_run,
            created_by_user_id,
            workflow_hash,
            reason,
            source,
            cache_key,
            started_at,
            finished_at,
            duration_ms
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9::jsonb,
            $10::jsonb,
            $11::jsonb,
            $12::jsonb,
            $13,
            $14,
            $15,
            $16,
            $17,
            $18,
            $19,
            $20,
            $21,
            $22,
            $23::timestamptz,
            $24::timestamptz,
            $25
          )
          on conflict (id) do nothing
        `,
        [
          input.result.validation_run_id,
          workspaceId,
          input.automationId,
          input.draftId,
          input.revision,
          input.result.mode,
          input.result.mode,
          input.result.status,
          JSON.stringify(
            input.result.issues.filter((issue) => issue.severity === 'error'),
          ),
          JSON.stringify(
            input.result.issues.filter((issue) => issue.severity === 'warning'),
          ),
          JSON.stringify(
            input.result.issues.filter(
              (issue) => issue.severity === 'policy_block',
            ),
          ),
          JSON.stringify(input.result),
          input.result.can_save,
          input.result.can_test,
          input.result.can_publish,
          input.result.can_compile,
          input.result.can_run,
          input.actor.id,
          input.result.workflow_hash,
          input.result.reason ?? null,
          input.source ?? 'backend',
          cacheKey,
          startedAt,
          finishedAt,
          durationMs,
        ],
      );

      for (const issue of input.result.issues) {
        await client.query(
          `
            insert into app.automation_canvas_validation_issues (
              issue_id,
              validation_run_id,
              workspace_id,
              installed_automation_id,
              draft_version_id,
              code,
              category,
              severity,
              message,
              developer_message,
              node_id,
              edge_id,
              binding_id,
              input_key,
              field_path,
              blocks,
              suggested_fixes,
              evidence,
              created_at
            )
            values (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11,
              $12,
              $13,
              $14,
              $15,
              $16,
              $17::jsonb,
              $18::jsonb,
              $19::timestamptz
            )
            on conflict (validation_run_id, issue_id) do nothing
          `,
          [
            issue.id,
            input.result.validation_run_id,
            workspaceId,
            input.automationId,
            input.draftId,
            issue.code,
            issue.category ?? 'schema',
            issue.severity,
            issue.message,
            issue.developer_message ?? null,
            issue.affected_node_id ?? null,
            issue.affected_edge_id ?? null,
            issue.affected_binding_id ?? null,
            issue.affected_input_key ?? null,
            issue.field_path ?? null,
            issue.blocks ?? [],
            JSON.stringify(issue.suggested_fixes ?? []),
            JSON.stringify(issue.evidence ?? {}),
            issue.created_at ?? input.result.created_at,
          ],
        );
      }
    });

    return input.result.validation_run_id;
  }

  async findIssue(input: {
    readonly access: AccessContext;
    readonly automationId: string;
    readonly issueId: string;
  }): Promise<ValidationIssue | null> {
    const workspaceId = requireWorkspaceId(input.access);
    const result = await this.databaseService.one<ValidationIssueRow>(
      `
        select
          id,
          issue_id,
          validation_run_id,
          code,
          category,
          severity,
          message,
          developer_message,
          node_id,
          edge_id,
          binding_id,
          input_key,
          field_path,
          blocks,
          suggested_fixes,
          evidence,
          created_at
        from app.automation_canvas_validation_issues
        where workspace_id = $1
          and installed_automation_id = $2
          and issue_id = $3
        order by created_at desc
        limit 1
      `,
      [workspaceId, input.automationId, input.issueId],
    );

    if (!result) {
      return null;
    }

    return {
      id: result.issue_id,
      validation_run_id: result.validation_run_id,
      code: result.code,
      category: result.category,
      severity: result.severity,
      scope: inferScope(result),
      title: result.code,
      message: result.message,
      developer_message: result.developer_message,
      affected_node_id: result.node_id,
      affected_edge_id: result.edge_id,
      affected_binding_id: result.binding_id,
      affected_input_key: result.input_key,
      field_path: result.field_path,
      blocks: result.blocks as ValidationIssue['blocks'],
      suggested_fixes:
        result.suggested_fixes as ValidationIssue['suggested_fixes'],
      evidence: result.evidence,
      created_at: result.created_at,
    };
  }
}

function inferScope(row: ValidationIssueRow): ValidationIssue['scope'] {
  if (row.node_id) {
    return 'node';
  }
  if (row.edge_id) {
    return 'edge';
  }
  if (row.binding_id || row.input_key) {
    return 'binding';
  }
  if (row.category === 'runtime') {
    return 'runtime';
  }
  return 'workflow';
}
