import type {
  DocumentStructureSection,
  DocumentTemplatePlaceholder,
  DocumentValidationIssue,
  DocumentValidationReportDetail,
  PhraseRuleSummary,
  RecheckDocumentValidationRequest,
  WorkflowRuntimeDocumentValidationExecuteRequest,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { ClausesService } from '../clauses/clauses.service';
import { DatabaseService } from '../database/database.service';
import { DocumentTemplatesService } from '../document-templates/document-templates.service';
import { validateGeneratedDocument, type RequestMeta } from '../stage7-support/stage7.helpers';

interface ValidationReportRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly generation_job_id: string | null;
  readonly document_id: string | null;
  readonly document_version_id: string | null;
  readonly status: DocumentValidationReportDetail['status'];
  readonly issue_count: number;
  readonly blocking_issue_count: number;
  readonly created_at: string;
  readonly updated_at: string;
}

interface ValidationIssueRow {
  readonly id: string;
  readonly code: string;
  readonly severity: DocumentValidationIssue['severity'];
  readonly path: string;
  readonly message: string;
  readonly suggested_fix: string | null;
  readonly resolved: boolean;
}

interface GenerationJobValidationRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly template_id: string;
  readonly template_version_id: string;
  readonly document_type_id: string | null;
  readonly approval_route_id: string | null;
  readonly missing_field_codes: readonly string[];
  readonly preview_document_id: string | null;
  readonly preview_document_version_id: string | null;
  readonly final_document_id: string | null;
  readonly final_document_version_id: string | null;
  readonly validation_report_id: string | null;
  readonly input_payload: Record<string, unknown>;
}

interface DocumentTypeSectionsRow {
  readonly structure: readonly DocumentStructureSection[];
}

@Injectable()
export class DocumentValidationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly clausesService: ClausesService,
    private readonly documentTemplatesService: DocumentTemplatesService,
  ) {}

  async getReport(
    access: AccessContext,
    id: string,
  ): Promise<DocumentValidationReportDetail> {
    const row = await this.databaseService.one<ValidationReportRow>(
      `
        select
          id,
          workspace_id,
          generation_job_id,
          document_id,
          document_version_id,
          status,
          issue_count,
          blocking_issue_count,
          created_at,
          updated_at
        from app.document_validation_reports
        where id = $1
          and workspace_id = $2
        limit 1
      `,
      [id, access.activeWorkspace!.id],
    );

    if (!row) {
      throw new AppHttpException(
        'DOCUMENT_VALIDATION_NOT_FOUND',
        404,
        'Validation report was not found.',
      );
    }

    const issues = await this.loadIssues(id);

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      generationJobId: row.generation_job_id,
      documentId: row.document_id,
      documentVersionId: row.document_version_id,
      status: row.status,
      issueCount: row.issue_count,
      blockingIssueCount: row.blocking_issue_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      issues,
    };
  }

  async recheck(
    actor: AuthenticatedActor,
    access: AccessContext,
    id: string,
    input: RecheckDocumentValidationRequest,
    meta: RequestMeta,
  ): Promise<DocumentValidationReportDetail> {
    const current = await this.getReport(access, id);
    const generationJobId = input.generationJobId ?? current.generationJobId;

    if (!generationJobId) {
      return current;
    }

    const report = await this.recomputeFromGenerationJob(generationJobId);

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'document.validation.completed',
      entityType: 'document_validation_report',
      entityId: report.id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        generationJobId,
        issueCount: report.issueCount,
      },
    });

    return report;
  }

  async executeRuntime(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: WorkflowRuntimeDocumentValidationExecuteRequest,
    meta: RequestMeta,
  ): Promise<DocumentValidationReportDetail> {
    const report = await this.recomputeFromGenerationJob(input.generationJobId);

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'document.validation.completed',
      entityType: 'document_validation_report',
      entityId: report.id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        generationJobId: input.generationJobId,
        workflowRunId: input.workflowRunId,
      },
    });

    return report;
  }

  async createOrReplaceReport(input: {
    readonly workspaceId: string;
    readonly generationJobId: string | null;
    readonly documentId: string | null;
    readonly documentVersionId: string | null;
    readonly placeholders: readonly DocumentTemplatePlaceholder[];
    readonly missingFieldCodes: readonly string[];
    readonly renderedText: string;
    readonly documentTypeSections?: readonly DocumentStructureSection[];
    readonly approvalRouteBound: boolean;
    readonly phraseRules: readonly PhraseRuleSummary[];
    readonly existingReportId?: string | null;
  }): Promise<DocumentValidationReportDetail> {
    const issues = validateGeneratedDocument({
      placeholders: input.placeholders,
      missingFieldCodes: input.missingFieldCodes,
      phraseRules: input.phraseRules,
      renderedText: input.renderedText,
      documentTypeSections: input.documentTypeSections ?? [],
      approvalRouteBound: input.approvalRouteBound,
    });
    const blockingIssueCount = issues.filter((issue) => issue.severity === 'error').length;
    const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
    const status: DocumentValidationReportDetail['status'] =
      blockingIssueCount > 0 ? 'invalid' : warningCount > 0 ? 'warning' : 'valid';

    let reportId = input.existingReportId ?? null;

    if (!reportId) {
      const inserted = await this.databaseService.one<{ readonly id: string }>(
        `
          insert into app.document_validation_reports (
            workspace_id,
            generation_job_id,
            document_id,
            document_version_id,
            status,
            issue_count,
            blocking_issue_count
          )
          values ($1, $2, $3, $4, $5, $6, $7)
          returning id
        `,
        [
          input.workspaceId,
          input.generationJobId,
          input.documentId,
          input.documentVersionId,
          status,
          issues.length,
          blockingIssueCount,
        ],
      );
      reportId = inserted?.id ?? null;
    } else {
      await this.databaseService.query(
        `
          update app.document_validation_reports
          set
            generation_job_id = $2,
            document_id = $3,
            document_version_id = $4,
            status = $5,
            issue_count = $6,
            blocking_issue_count = $7,
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [
          reportId,
          input.generationJobId,
          input.documentId,
          input.documentVersionId,
          status,
          issues.length,
          blockingIssueCount,
        ],
      );

      await this.databaseService.query(
        `
          delete from app.document_validation_issues
          where report_id = $1
        `,
        [reportId],
      );
    }

    if (!reportId) {
      throw new AppHttpException(
        'DOCUMENT_VALIDATION_CREATE_FAILED',
        500,
        'Validation report was not created.',
      );
    }

    for (const issue of issues) {
      await this.databaseService.query(
        `
          insert into app.document_validation_issues (
            report_id,
            workspace_id,
            code,
            severity,
            path,
            message,
            suggested_fix,
            resolved
          )
          values ($1, $2, $3, $4, $5, $6, $7, false)
        `,
        [
          reportId,
          input.workspaceId,
          issue.code,
          issue.severity,
          issue.path,
          issue.message,
          issue.suggestedFix,
        ],
      );
    }

    if (input.generationJobId) {
      await this.databaseService.query(
        `
          update app.document_generation_jobs
          set
            validation_report_id = $2,
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [input.generationJobId, reportId],
      );
    }

    return {
      id: reportId,
      workspaceId: input.workspaceId,
      generationJobId: input.generationJobId,
      documentId: input.documentId,
      documentVersionId: input.documentVersionId,
      status,
      issueCount: issues.length,
      blockingIssueCount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      issues: issues.map((issue, index) => ({
        id: `${reportId}:${index}`,
        code: issue.code,
        severity: issue.severity,
        path: issue.path,
        message: issue.message,
        suggestedFix: issue.suggestedFix,
        resolved: false,
      })),
    };
  }

  private async recomputeFromGenerationJob(
    generationJobId: string,
  ): Promise<DocumentValidationReportDetail> {
    const job = await this.databaseService.one<GenerationJobValidationRow>(
      `
        select
          id,
          workspace_id,
          template_id,
          template_version_id,
          document_type_id,
          approval_route_id,
          missing_field_codes,
          preview_document_id,
          preview_document_version_id,
          final_document_id,
          final_document_version_id,
          validation_report_id,
          input_payload
        from app.document_generation_jobs
        where id = $1
        limit 1
      `,
      [generationJobId],
    );

    if (!job) {
      throw new AppHttpException(
        'DOCUMENT_GENERATION_NOT_FOUND',
        404,
        'Document generation job was not found.',
      );
    }

    const templateVersion = await this.documentTemplatesService.getVersion(
      job.template_id,
      job.template_version_id,
    );
    const phraseRules = await this.clausesService.listPhraseRules(
      {
        activeWorkspace: {
          id: job.workspace_id,
          slug: '',
          name: '',
          role: 'owner',
          status: 'active',
        },
        roles: [],
        permissions: [],
      },
      null,
    );
    const documentTypeVersion = job.document_type_id
      ? await this.databaseService.one<DocumentTypeSectionsRow>(
          `
            select structure
            from app.document_type_versions
            where document_type_id = $1
            order by version desc
            limit 1
          `,
          [job.document_type_id],
        )
      : null;

    return this.createOrReplaceReport({
      workspaceId: job.workspace_id,
      generationJobId: job.id,
      documentId: job.final_document_id ?? job.preview_document_id,
      documentVersionId:
        job.final_document_version_id ?? job.preview_document_version_id,
      placeholders: templateVersion.placeholders,
      missingFieldCodes: job.missing_field_codes ?? [],
      renderedText: JSON.stringify(job.input_payload ?? {}),
      documentTypeSections: documentTypeVersion?.structure ?? [],
      approvalRouteBound: Boolean(job.approval_route_id),
      phraseRules,
      existingReportId: job.validation_report_id,
    });
  }

  private async loadIssues(
    reportId: string,
  ): Promise<readonly DocumentValidationIssue[]> {
    const result = await this.databaseService.query<ValidationIssueRow>(
      `
        select
          id,
          code,
          severity,
          path,
          message,
          suggested_fix,
          resolved
        from app.document_validation_issues
        where report_id = $1
        order by created_at asc
      `,
      [reportId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      code: row.code,
      severity: row.severity,
      path: row.path,
      message: row.message,
      suggestedFix: row.suggested_fix,
      resolved: row.resolved,
    }));
  }
}
