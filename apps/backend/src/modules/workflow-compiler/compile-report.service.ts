import type {
  CanvasValidationResult,
  CompileReport,
  CompileStatus,
  CompilerMode,
  CompilerTargetRuntime,
  RuntimeConnectionRequirement,
  RuntimeIR,
  RuntimePieceVersionRequirement,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { DatabaseService } from '../database/database.service';
import {
  TARGET_RUNTIME,
  WORKFLOW_COMPILER_VERSION,
} from './workflow-compiler.types';

interface CompileReportRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly automation_id: string;
  readonly automation_version_id: string | null;
  readonly compiler_version: string;
  readonly target_runtime: string;
  readonly source_workflow_hash: string;
  readonly status: string;
  readonly validation_result: CanvasValidationResult;
  readonly runtime_ir: RuntimeIR;
  readonly activepieces_projection: unknown;
  readonly generated_operations: readonly unknown[];
  readonly required_pieces: readonly RuntimePieceVersionRequirement[];
  readonly required_connections: readonly RuntimeConnectionRequirement[];
  readonly warnings: CompileReport['warnings'];
  readonly blocking_issues: CompileReport['blocking_issues'];
  readonly created_by: string;
  readonly created_at: string;
}

interface PersistReportInput {
  readonly workspaceId: string;
  readonly automationId: string;
  readonly automationVersionId: string | null;
  readonly draftVersionId: string | null;
  readonly compileMode: CompilerMode;
  readonly sourceWorkflowHash: string;
  readonly status: CompileStatus;
  readonly validationResult: CanvasValidationResult;
  readonly runtimeIr: RuntimeIR;
  readonly activepiecesProjection: unknown;
  readonly generatedOperations: readonly unknown[];
  readonly requiredPieces: readonly RuntimePieceVersionRequirement[];
  readonly requiredConnections: readonly RuntimeConnectionRequirement[];
  readonly warnings: CompileReport['warnings'];
  readonly blockingIssues: CompileReport['blocking_issues'];
  readonly actorId: string;
}

@Injectable()
export class CompileReportService {
  constructor(private readonly databaseService: DatabaseService) {}

  async persistReport(input: PersistReportInput): Promise<CompileReport> {
    const id = randomUUID();
    const row = await this.databaseService.one<CompileReportRow>(
      `
        insert into app.automation_compile_reports (
          id,
          workspace_id,
          automation_id,
          automation_version_id,
          draft_version_id,
          compiler_version,
          target_runtime,
          compile_mode,
          source_workflow_hash,
          status,
          validation_result,
          runtime_ir,
          activepieces_projection,
          generated_operations,
          required_pieces,
          required_connections,
          warnings,
          blocking_issues,
          created_by
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
          $11::jsonb,
          $12::jsonb,
          $13::jsonb,
          $14::jsonb,
          $15::jsonb,
          $16::jsonb,
          $17::jsonb,
          $18::jsonb,
          $19
        )
        returning
          id,
          workspace_id,
          automation_id,
          automation_version_id,
          compiler_version,
          target_runtime,
          source_workflow_hash,
          status,
          validation_result,
          runtime_ir,
          activepieces_projection,
          generated_operations,
          required_pieces,
          required_connections,
          warnings,
          blocking_issues,
          created_by,
          created_at
      `,
      [
        id,
        input.workspaceId,
        input.automationId,
        input.automationVersionId,
        input.draftVersionId,
        WORKFLOW_COMPILER_VERSION,
        TARGET_RUNTIME,
        input.compileMode,
        input.sourceWorkflowHash,
        input.status,
        JSON.stringify(input.validationResult),
        JSON.stringify(input.runtimeIr),
        JSON.stringify(input.activepiecesProjection),
        JSON.stringify(input.generatedOperations),
        JSON.stringify(input.requiredPieces),
        JSON.stringify(input.requiredConnections),
        JSON.stringify(input.warnings),
        JSON.stringify(input.blockingIssues),
        input.actorId,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'WORKFLOW_COMPILER_BLOCKED',
        500,
        'Compile report was not persisted.',
      );
    }

    return mapReport(row);
  }

  async getReport(
    workspaceId: string,
    automationId: string,
    reportId: string,
  ): Promise<CompileReport> {
    const row = await this.databaseService.one<CompileReportRow>(
      this.reportSelectSql(`
        where workspace_id = $1
          and automation_id = $2
          and id = $3
        limit 1
      `),
      [workspaceId, automationId, reportId],
    );
    if (!row) {
      throw new AppHttpException(
        'WORKFLOW_COMPILE_REPORT_NOT_FOUND',
        404,
        'Compile report was not found.',
      );
    }
    return mapReport(row);
  }

  async listReports(
    workspaceId: string,
    automationId: string,
  ): Promise<readonly CompileReport[]> {
    const result = await this.databaseService.query<CompileReportRow>(
      this.reportSelectSql(`
        where workspace_id = $1
          and automation_id = $2
        order by created_at desc
        limit 50
      `),
      [workspaceId, automationId],
    );
    return result.rows.map(mapReport);
  }

  private reportSelectSql(whereClause: string) {
    return `
      select
        id,
        workspace_id,
        automation_id,
        automation_version_id,
        compiler_version,
        target_runtime,
        source_workflow_hash,
        status,
        validation_result,
        runtime_ir,
        activepieces_projection,
        generated_operations,
        required_pieces,
        required_connections,
        warnings,
        blocking_issues,
        created_by,
        created_at
      from app.automation_compile_reports
      ${whereClause}
    `;
  }
}

function mapReport(row: CompileReportRow): CompileReport {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    automation_id: row.automation_id,
    automation_version_id: row.automation_version_id,
    compiler_version: row.compiler_version,
    target_runtime: row.target_runtime as CompilerTargetRuntime,
    source_workflow_hash: row.source_workflow_hash,
    status: row.status as CompileStatus,
    validation_result: row.validation_result,
    runtime_ir: row.runtime_ir,
    activepieces_projection: row.activepieces_projection,
    generated_operations: row.generated_operations,
    required_pieces: row.required_pieces,
    required_connections: row.required_connections,
    warnings: row.warnings,
    blocking_issues: row.blocking_issues,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}
