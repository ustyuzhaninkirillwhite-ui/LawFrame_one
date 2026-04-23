import type {
  LegalModuleDetail,
  LegalModuleIoSchema,
  LegalModuleSummary,
  LegalModuleVersionSummary,
  TemplateRequirement,
  ValidateLegalModuleStepRequest,
  WorkflowValidationSummary,
} from '@lexframe/contracts';
import type { AuthenticatedActor } from '../../common/types/lexframe-request';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { randomUUID } from 'node:crypto';

interface ModuleSummaryRow {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly category: string;
  readonly description: string;
  readonly risk_level: LegalModuleSummary['riskLevel'];
  readonly current_status: LegalModuleSummary['status'];
  readonly version: string | null;
  readonly input_schema: readonly LegalModuleIoSchema[] | null;
  readonly output_schema: readonly LegalModuleIoSchema[] | null;
}

interface ModuleVersionRow {
  readonly id: string;
  readonly version: string;
  readonly status: LegalModuleVersionSummary['status'];
  readonly validation_status: LegalModuleVersionSummary['validationStatus'];
  readonly validation_issues: readonly string[] | null;
  readonly input_schema: readonly LegalModuleIoSchema[] | null;
  readonly output_schema: readonly LegalModuleIoSchema[] | null;
  readonly requirements: readonly TemplateRequirement[] | null;
  readonly runtime_mapping: Record<string, unknown> | null;
  readonly examples: readonly string[] | null;
  readonly created_at: string;
  readonly published_at: string | null;
}

interface ModuleVersionInput {
  readonly version: string;
  readonly inputSchema: readonly LegalModuleIoSchema[];
  readonly outputSchema: readonly LegalModuleIoSchema[];
  readonly requirements: readonly TemplateRequirement[];
  readonly runtimeMapping: Record<string, unknown>;
  readonly examples: readonly string[];
}

@Injectable()
export class LegalModulesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async list(): Promise<readonly LegalModuleSummary[]> {
    const result = await this.databaseService.query<ModuleSummaryRow>(
      `
        select
          lm.id,
          lm.code,
          lm.title,
          lm.category,
          lm.description,
          lm.risk_level,
          lm.current_status,
          lv.version,
          lv.input_schema,
          lv.output_schema
        from app.legal_modules lm
        left join lateral (
          select
            version,
            input_schema,
            output_schema
          from app.legal_module_versions lmv
          where lmv.module_id = lm.id
          order by
            case when lmv.status = 'published' then 0 else 1 end,
            lmv.published_at desc nulls last,
            lmv.created_at desc
          limit 1
        ) lv on true
        where lm.deleted_at is null
        order by lm.category asc, lm.title asc
      `,
    );

    return result.rows.map((row) => mapModuleSummary(row));
  }

  async getDetail(code: string): Promise<LegalModuleDetail> {
    const summary = await this.databaseService.one<ModuleSummaryRow>(
      `
        select
          lm.id,
          lm.code,
          lm.title,
          lm.category,
          lm.description,
          lm.risk_level,
          lm.current_status,
          lv.version,
          lv.input_schema,
          lv.output_schema
        from app.legal_modules lm
        left join lateral (
          select
            version,
            input_schema,
            output_schema
          from app.legal_module_versions lmv
          where lmv.module_id = lm.id
          order by
            case when lmv.status = 'published' then 0 else 1 end,
            lmv.published_at desc nulls last,
            lmv.created_at desc
          limit 1
        ) lv on true
        where lm.code = $1
          and lm.deleted_at is null
        limit 1
      `,
      [code],
    );

    if (!summary) {
      throw new AppHttpException(
        'MODULE_NOT_FOUND',
        404,
        'Legal module was not found.',
      );
    }

    const versionsResult = await this.databaseService.query<ModuleVersionRow>(
      `
        select
          id,
          version,
          status,
          validation_status,
          validation_issues,
          input_schema,
          output_schema,
          requirements,
          runtime_mapping,
          examples,
          created_at,
          published_at
        from app.legal_module_versions
        where module_id = $1
        order by created_at desc
      `,
      [summary.id],
    );

    const currentVersion = versionsResult.rows[0];

    if (!currentVersion) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        409,
        'Legal module exists without a version payload.',
      );
    }

    return {
      ...mapModuleSummary(summary),
      versions: versionsResult.rows.map((row) => mapModuleVersion(row)),
      inputs: currentVersion.input_schema ?? [],
      outputs: currentVersion.output_schema ?? [],
      requirements: currentVersion.requirements ?? [],
      runtimeMapping: currentVersion.runtime_mapping ?? {},
      examples: currentVersion.examples ?? [],
    };
  }

  async validateStep(
    input: ValidateLegalModuleStepRequest,
  ): Promise<WorkflowValidationSummary> {
    const detail = await this.getDetail(input.moduleCode);
    const allowedInputs = new Set(detail.inputs.map((entry) => entry.code));
    const allowedOutputs = new Set(detail.outputs.map((entry) => entry.code));
    const issues: string[] = [];

    for (const code of input.inputCodes) {
      if (!allowedInputs.has(code)) {
        issues.push(`Input ${code} is not allowed for module ${input.moduleCode}`);
      }
    }

    for (const code of input.outputCodes) {
      if (!allowedOutputs.has(code)) {
        issues.push(`Output ${code} is not allowed for module ${input.moduleCode}`);
      }
    }

    if (
      detail.code === 'delivery.email-draft' &&
      input.requiresApproval !== true
    ) {
      issues.push(
        'External delivery steps must keep requiresApproval=true.',
      );
    }

    return {
      ok: issues.length === 0,
      issues,
    };
  }

  async createModule(
    actor: AuthenticatedActor,
    input: {
      readonly code: string;
      readonly title: string;
      readonly category: string;
      readonly description: string;
      readonly riskLevel: LegalModuleSummary['riskLevel'];
    },
    requestMeta: {
      readonly requestId: string | null;
      readonly traceId: string | null;
    },
  ): Promise<LegalModuleDetail> {
    await this.databaseService.query(
      `
        insert into app.legal_modules (
          id,
          code,
          title,
          category,
          description,
          risk_level,
          current_status
        )
        values ($1, $2, $3, $4, $5, $6, 'draft')
      `,
      [
        randomUUID(),
        input.code,
        input.title,
        input.category,
        input.description,
        input.riskLevel,
      ],
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: null,
      action: 'legal_module.created',
      entityType: 'legal_module',
      entityId: input.code,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
    });

    return this.getDetail(input.code);
  }

  async createVersion(
    actor: AuthenticatedActor,
    code: string,
    input: ModuleVersionInput,
    requestMeta: {
      readonly requestId: string | null;
      readonly traceId: string | null;
    },
  ): Promise<LegalModuleDetail> {
    const moduleRow = await this.databaseService.one<{ readonly id: string }>(
      `
        select id
        from app.legal_modules
        where code = $1
          and deleted_at is null
        limit 1
      `,
      [code],
    );

    if (!moduleRow) {
      throw new AppHttpException(
        'MODULE_NOT_FOUND',
        404,
        'Legal module was not found.',
      );
    }

    await this.databaseService.query(
      `
        insert into app.legal_module_versions (
          id,
          module_id,
          version,
          status,
          input_schema,
          output_schema,
          requirements,
          runtime_mapping,
          examples,
          validation_status,
          validation_issues,
          created_by_user_id
        )
        values (
          $1,
          $2,
          $3,
          'draft',
          $4::jsonb,
          $5::jsonb,
          $6::jsonb,
          $7::jsonb,
          $8::jsonb,
          'valid',
          '[]'::jsonb,
          $9
        )
      `,
      [
        randomUUID(),
        moduleRow.id,
        input.version,
        JSON.stringify(input.inputSchema),
        JSON.stringify(input.outputSchema),
        JSON.stringify(input.requirements),
        JSON.stringify(input.runtimeMapping),
        JSON.stringify(input.examples),
        actor.id,
      ],
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: null,
      action: 'legal_module.version_created',
      entityType: 'legal_module',
      entityId: code,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      metadata: {
        version: input.version,
      },
    });

    return this.getDetail(code);
  }

  async publishVersion(
    actor: AuthenticatedActor,
    code: string,
    version: string,
    requestMeta: {
      readonly requestId: string | null;
      readonly traceId: string | null;
    },
  ): Promise<LegalModuleDetail> {
    await this.databaseService.transaction(async (client) => {
      const moduleRow = await client.query<{ readonly id: string }>(
        `
          select id
          from app.legal_modules
          where code = $1
            and deleted_at is null
          limit 1
        `,
        [code],
      );

      const moduleId = moduleRow.rows[0]?.id;

      if (!moduleId) {
        throw new AppHttpException(
          'MODULE_NOT_FOUND',
          404,
          'Legal module was not found.',
        );
      }

      await client.query(
        `
          update app.legal_module_versions
          set
            status = 'published',
            published_at = timezone('utc', now())
          where module_id = $1
            and version = $2
        `,
        [moduleId, version],
      );

      await client.query(
        `
          update app.legal_modules
          set
            current_status = 'published',
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [moduleId],
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: null,
      action: 'legal_module.version_published',
      entityType: 'legal_module',
      entityId: code,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      metadata: {
        version,
      },
    });

    return this.getDetail(code);
  }

  async deprecateVersion(
    actor: AuthenticatedActor,
    code: string,
    version: string,
    requestMeta: {
      readonly requestId: string | null;
      readonly traceId: string | null;
    },
  ): Promise<LegalModuleDetail> {
    await this.databaseService.transaction(async (client) => {
      const moduleRow = await client.query<{ readonly id: string }>(
        `
          select id
          from app.legal_modules
          where code = $1
            and deleted_at is null
          limit 1
        `,
        [code],
      );

      const moduleId = moduleRow.rows[0]?.id;

      if (!moduleId) {
        throw new AppHttpException(
          'MODULE_NOT_FOUND',
          404,
          'Legal module was not found.',
        );
      }

      await client.query(
        `
          update app.legal_module_versions
          set status = 'deprecated'
          where module_id = $1
            and version = $2
        `,
        [moduleId, version],
      );

      await client.query(
        `
          update app.legal_modules
          set
            current_status = 'deprecated',
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [moduleId],
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: null,
      action: 'legal_module.version_deprecated',
      entityType: 'legal_module',
      entityId: code,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      metadata: {
        version,
      },
    });

    return this.getDetail(code);
  }
}

function mapModuleSummary(row: ModuleSummaryRow): LegalModuleSummary {
  return {
    code: row.code,
    title: row.title,
    category: row.category,
    description: row.description,
    riskLevel: row.risk_level,
    publishedVersion: row.version,
    status: row.current_status,
    inputCodes: (row.input_schema ?? []).map((entry) => entry.code),
    outputCodes: (row.output_schema ?? []).map((entry) => entry.code),
    available: true,
    disabledReason: null,
    compatibilityStatus: 'compatible',
  };
}

function mapModuleVersion(row: ModuleVersionRow): LegalModuleVersionSummary {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    validationStatus: row.validation_status,
    validationIssues: row.validation_issues ?? [],
    createdAt: row.created_at,
    publishedAt: row.published_at,
  };
}
