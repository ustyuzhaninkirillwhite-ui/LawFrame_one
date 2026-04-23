import type {
  ApplyInstalledAutomationSourceUpdateRequest,
  AutomationTemplateDetail,
  AutomationTemplateOwner,
  AutomationTemplateScope,
  AutomationTemplateSummary,
  AutomationTemplateVersionSummary,
  CompatibilityStatus,
  CreateAutomationTemplateRequest,
  CreateAutomationTemplateVersionRequest,
  ForkAutomationTemplateRequest,
  InstalledAutomationDetail,
  InstalledAutomationSourceDiff,
  ModerationDecision,
  PublicationRequest,
  SubmitPublicationRequest,
  TemplateRequirement,
  TemplateVersionStatus,
  UpdateAutomationTemplateRequest,
  WorkflowValidationSummary,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { validateWorkflowDefinition } from '@lexframe/workflow';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';

interface TemplateQuery {
  readonly q?: string;
  readonly scope?: AutomationTemplateScope;
  readonly owner?: AutomationTemplateOwner;
  readonly mine?: boolean;
}

interface RequestMeta {
  readonly requestId: string | null;
  readonly traceId: string | null;
}

interface TemplateSummaryRow {
  readonly id: string;
  readonly workspace_id: string | null;
  readonly code: string;
  readonly title: string;
  readonly category: string;
  readonly description: string;
  readonly scope: AutomationTemplateScope;
  readonly status: AutomationTemplateSummary['status'];
  readonly readiness: AutomationTemplateSummary['readiness'];
  readonly required_permissions: readonly string[] | null;
  readonly module_codes: readonly string[] | null;
  readonly publication_status: AutomationTemplateSummary['publicationStatus'];
  readonly compatibility_status: CompatibilityStatus;
  readonly runtime_sync_state: AutomationTemplateSummary['runtimeSyncState'];
  readonly available: boolean;
  readonly disabled_reason: string | null;
  readonly source_template_id: string | null;
  readonly version_id: string | null;
  readonly version: string | null;
  readonly workflow: Record<string, unknown> | null;
  readonly requirements: readonly TemplateRequirement[] | null;
  readonly required_inputs: readonly string[] | null;
  readonly validation_status:
    | AutomationTemplateVersionSummary['validationStatus']
    | null;
  readonly validation_issues: readonly string[] | null;
}

interface TemplateVersionRow {
  readonly id: string;
  readonly version: string;
  readonly status: TemplateVersionStatus;
  readonly publication_status: AutomationTemplateVersionSummary['publicationStatus'];
  readonly workflow: Record<string, unknown>;
  readonly requirements: readonly TemplateRequirement[] | null;
  readonly module_codes: readonly string[] | null;
  readonly required_inputs: readonly string[] | null;
  readonly validation_status: AutomationTemplateVersionSummary['validationStatus'];
  readonly validation_issues: readonly string[] | null;
  readonly created_at: string;
  readonly published_at: string | null;
}

interface InstalledAutomationRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly template_id: string;
  readonly source_template_version_id: string;
  readonly title: string;
  readonly version: string;
  readonly workflow_state: InstalledAutomationDetail['workflowState'];
  readonly builder_state: InstalledAutomationDetail['builderState'];
  readonly sync_state: InstalledAutomationDetail['syncState'];
  readonly compatibility_status: InstalledAutomationDetail['compatibilityStatus'];
  readonly available: boolean;
  readonly disabled_reason: string | null;
  readonly required_inputs: readonly string[] | null;
  readonly requirements: readonly TemplateRequirement[] | null;
  readonly missing_connections: readonly string[] | null;
  readonly next_gate: string;
  readonly workflow: Record<string, unknown> | null;
  readonly runtime_project_id: string | null;
  readonly runtime_flow_id: string | null;
  readonly sync_hash: string | null;
  readonly last_synced_at: string | null;
}

interface PublicationRequestRow {
  readonly id: string;
  readonly template_id: string;
  readonly template_version_id: string;
  readonly workspace_id: string;
  readonly status: PublicationRequest['status'];
  readonly submitted_at: string;
  readonly reviewed_at: string | null;
  readonly reviewer_user_id: string | null;
  readonly review_note: string | null;
  readonly public_template_id: string | null;
}

interface ModuleRegistryRow {
  readonly code: string;
  readonly input_schema: readonly { code: string }[] | null;
  readonly output_schema: readonly { code: string }[] | null;
}

@Injectable()
export class AutomationLibraryService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async listTemplates(
    access: AccessContext | null,
    filters: TemplateQuery = {},
  ): Promise<readonly AutomationTemplateSummary[]> {
    const workspaceId = access?.activeWorkspace?.id ?? null;
    const values: unknown[] = [workspaceId];
    const clauses = [
      `at.deleted_at is null`,
      `(
        at.scope in ('product', 'public')
        or ($1::uuid is not null and at.workspace_id = $1::uuid)
      )`,
    ];

    if (filters.mine) {
      clauses.push(`$1::uuid is not null and at.workspace_id = $1::uuid`);
    }

    if (filters.scope) {
      values.push(filters.scope);
      clauses.push(`at.scope = $${values.length}`);
    }

    if (filters.q) {
      const normalizedQuery = filters.q.trim();

      if (normalizedQuery.length > 0) {
        values.push(normalizedQuery);
        const position = values.length;
        clauses.push(`
          (
            to_tsvector(
              'simple',
              coalesce(at.title, '') || ' ' || coalesce(at.description, '') || ' ' || coalesce(at.code, '')
            ) @@ websearch_to_tsquery('simple', $${position})
            or similarity(at.title, $${position}) > 0.1
            or similarity(at.code, $${position}) > 0.1
            or at.description ilike '%' || $${position} || '%'
          )
        `);
      }
    }

    const result = await this.databaseService.query<TemplateSummaryRow>(
      `
        select
          at.id,
          at.workspace_id,
          at.code,
          at.title,
          at.category,
          at.description,
          at.scope,
          at.status,
          at.readiness,
          at.required_permissions,
          at.module_codes,
          at.publication_status,
          at.compatibility_status,
          at.runtime_sync_state,
          at.available,
          at.disabled_reason,
          at.source_template_id,
          current_version.id as version_id,
          current_version.version,
          current_version.workflow,
          current_version.requirements,
          current_version.required_inputs,
          current_version.validation_status,
          current_version.validation_issues
        from app.automation_templates at
        left join lateral (
          select
            atv.id,
            atv.version,
            atv.workflow,
            atv.requirements,
            atv.required_inputs,
            atv.validation_status,
            atv.validation_issues
          from app.automation_template_versions atv
          where atv.template_id = at.id
          order by
            case when atv.status = 'published' then 0 else 1 end,
            atv.published_at desc nulls last,
            atv.created_at desc
          limit 1
        ) current_version on true
        where ${clauses.join('\n          and ')}
        order by at.updated_at desc, at.title asc
      `,
      values,
    );

    const summaries = result.rows.map((row) => mapTemplateSummary(row, access));

    if (!filters.owner) {
      return summaries;
    }

    return summaries.filter((summary) => summary.owner === filters.owner);
  }

  async getTemplate(
    access: AccessContext | null,
    templateId: string,
  ): Promise<AutomationTemplateDetail> {
    const summary = await this.getVisibleTemplateRow(access, templateId);
    const versions = await this.listTemplateVersions(templateId);
    const currentVersion = versions[0];

    if (!currentVersion) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        409,
        'Template exists without any version payload.',
      );
    }

    const related = await this.databaseService.query<{ readonly id: string }>(
      `
        select id
        from app.automation_templates
        where deleted_at is null
          and id <> $1
          and (
            source_template_id = $1
            or id = $2
            or source_template_id = $2
            or category = $3
          )
        order by updated_at desc
        limit 4
      `,
      [summary.id, summary.source_template_id, summary.category],
    );

    return {
      ...mapTemplateSummary(summary, access),
      versions: versions.map((version) => mapTemplateVersion(version)),
      requirements: currentVersion.requirements ?? [],
      workflow: currentVersion.workflow ?? {},
      sourceTemplateId: summary.source_template_id,
      sourceTemplateVersionId: summary.version_id,
      relatedTemplateIds: related.rows.map((row) => row.id),
      editable:
        summary.workspace_id !== null &&
        summary.workspace_id === access?.activeWorkspace?.id &&
        (summary.scope === 'workspace' || summary.scope === 'private'),
    };
  }

  async createTemplate(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: CreateAutomationTemplateRequest,
    requestMeta: RequestMeta,
  ): Promise<AutomationTemplateDetail> {
    const workspaceId = access.activeWorkspace?.id;

    if (!workspaceId) {
      throw new AppHttpException(
        'NO_WORKSPACE',
        400,
        'An active workspace is required to create a template.',
      );
    }

    const validation = await this.validateWorkflowPayload(input.workflow);

    if (!validation.ok) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Workflow payload is invalid.',
        {
          issues: validation.issues,
        },
      );
    }

    const templateId = randomUUID();
    const versionId = randomUUID();
    const moduleCodes = extractWorkflowModuleCodes(
      input.workflow,
      input.moduleCodes,
    );
    const requiredInputs = extractWorkflowInputs(input.workflow);

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          insert into app.automation_templates (
            id,
            workspace_id,
            code,
            title,
            category,
            description,
            scope,
            status,
            readiness,
            required_permissions,
            module_codes,
            publication_status,
            compatibility_status,
            runtime_sync_state,
            available,
            disabled_reason,
            source_template_id,
            created_by_user_id,
            updated_by_user_id
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            'draft',
            'contract_ready',
            $8::text[],
            $9::text[],
            'not_requested',
            'runtime_sync_pending',
            'not_requested',
            true,
            null,
            $10,
            $11,
            $11
          )
        `,
        [
          templateId,
          workspaceId,
          input.code,
          input.title,
          input.category,
          input.description,
          input.scope,
          [...input.requiredPermissions],
          [...moduleCodes],
          input.sourceTemplateId ?? null,
          actor.id,
        ],
      );

      await client.query(
        `
          insert into app.automation_template_versions (
            id,
            template_id,
            version,
            status,
            publication_status,
            workflow,
            requirements,
            module_codes,
            required_inputs,
            validation_status,
            validation_issues,
            created_by_user_id
          )
          values (
            $1,
            $2,
            'v1',
            'draft',
            'not_requested',
            $3::jsonb,
            $4::jsonb,
            $5::text[],
            $6::text[],
            $7,
            $8::jsonb,
            $9
          )
        `,
        [
          versionId,
          templateId,
          JSON.stringify(input.workflow),
          JSON.stringify(input.requirements),
          [...moduleCodes],
          [...requiredInputs],
          validation.ok ? 'valid' : 'invalid',
          JSON.stringify(validation.issues),
          actor.id,
        ],
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'automation.template.created',
      entityType: 'automation_template',
      entityId: templateId,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      metadata: {
        scope: input.scope,
        moduleCount: moduleCodes.length,
      },
    });

    return this.getTemplate(access, templateId);
  }

  async updateTemplate(
    actor: AuthenticatedActor,
    access: AccessContext,
    templateId: string,
    input: UpdateAutomationTemplateRequest,
    requestMeta: RequestMeta,
  ): Promise<AutomationTemplateDetail> {
    const template = await this.getEditableTemplate(access, templateId);
    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.title) {
      values.push(input.title);
      updates.push(`title = $${values.length}`);
    }

    if (input.category) {
      values.push(input.category);
      updates.push(`category = $${values.length}`);
    }

    if (input.description) {
      values.push(input.description);
      updates.push(`description = $${values.length}`);
    }

    if (input.requiredPermissions) {
      values.push([...input.requiredPermissions]);
      updates.push(`required_permissions = $${values.length}::text[]`);
    }

    if (updates.length === 0) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Template update payload is empty.',
      );
    }

    values.push(actor.id);
    updates.push(`updated_by_user_id = $${values.length}`);
    updates.push(`updated_at = timezone('utc', now())`);
    values.push(templateId);

    await this.databaseService.query(
      `
        update app.automation_templates
        set ${updates.join(',\n            ')}
        where id = $${values.length}
      `,
      values,
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'automation.template.updated',
      entityType: 'automation_template',
      entityId: template.id,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
    });

    return this.getTemplate(access, templateId);
  }

  async createTemplateVersion(
    actor: AuthenticatedActor,
    access: AccessContext,
    templateId: string,
    input: CreateAutomationTemplateVersionRequest,
    requestMeta: RequestMeta,
  ): Promise<AutomationTemplateVersionSummary> {
    const template = await this.getEditableTemplate(access, templateId);
    const validation = await this.validateWorkflowPayload(input.workflow);
    const moduleCodes = extractWorkflowModuleCodes(input.workflow);
    const requiredInputs = extractWorkflowInputs(input.workflow);
    const versionId = randomUUID();

    await this.databaseService.query(
      `
        insert into app.automation_template_versions (
          id,
          template_id,
          version,
          status,
          publication_status,
          workflow,
          requirements,
          module_codes,
          required_inputs,
          validation_status,
          validation_issues,
          created_by_user_id
        )
        values (
          $1,
          $2,
          $3,
          'draft',
          'not_requested',
          $4::jsonb,
          $5::jsonb,
          $6::text[],
          $7::text[],
          $8,
          $9::jsonb,
          $10
        )
      `,
      [
        versionId,
        template.id,
        input.version,
        JSON.stringify(input.workflow),
        JSON.stringify(input.requirements),
        [...moduleCodes],
        [...requiredInputs],
        validation.ok ? 'valid' : 'invalid',
        JSON.stringify(validation.issues),
        actor.id,
      ],
    );

    await this.databaseService.query(
      `
        update app.automation_templates
        set
          module_codes = $1::text[],
          updated_by_user_id = $2,
          updated_at = timezone('utc', now())
        where id = $3
      `,
      [[...moduleCodes], actor.id, template.id],
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'automation.template.version_created',
      entityType: 'automation_template',
      entityId: template.id,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      metadata: {
        version: input.version,
      },
    });

    return {
      id: versionId,
      version: input.version,
      status: 'draft',
      publicationStatus: 'not_requested',
      validationStatus: validation.ok ? 'valid' : 'invalid',
      validationIssues: validation.issues,
      createdAt: new Date().toISOString(),
      publishedAt: null,
      moduleCodes,
      requiredInputs,
    };
  }

  async validateTemplateVersion(
    access: AccessContext | null,
    versionId: string,
  ): Promise<WorkflowValidationSummary> {
    const version = await this.databaseService.one<
      TemplateVersionRow & { readonly scope: AutomationTemplateScope }
    >(
      `
        select
          atv.id,
          atv.version,
          atv.status,
          atv.publication_status,
          atv.workflow,
          atv.requirements,
          atv.module_codes,
          atv.required_inputs,
          atv.validation_status,
          atv.validation_issues,
          atv.created_at,
          atv.published_at,
          at.scope
        from app.automation_template_versions atv
        join app.automation_templates at
          on at.id = atv.template_id
        where atv.id = $1
          and at.deleted_at is null
          and (
            at.scope in ('product', 'public')
            or at.workspace_id = $2
          )
        limit 1
      `,
      [versionId, access?.activeWorkspace?.id ?? null],
    );

    if (!version) {
      throw new AppHttpException(
        'TEMPLATE_NOT_FOUND',
        404,
        'Template version was not found.',
      );
    }

    return this.validateWorkflowPayload(version.workflow);
  }

  async publishTemplateDraft(
    actor: AuthenticatedActor,
    access: AccessContext,
    versionId: string,
    requestMeta: RequestMeta,
  ): Promise<AutomationTemplateDetail> {
    const version = await this.databaseService.one<
      TemplateVersionRow & {
        readonly template_id: string;
        readonly workspace_id: string | null;
      }
    >(
      `
        select
          atv.id,
          atv.template_id,
          at.workspace_id,
          atv.version,
          atv.status,
          atv.publication_status,
          atv.workflow,
          atv.requirements,
          atv.module_codes,
          atv.required_inputs,
          atv.validation_status,
          atv.validation_issues,
          atv.created_at,
          atv.published_at
        from app.automation_template_versions atv
        join app.automation_templates at
          on at.id = atv.template_id
        where atv.id = $1
          and at.deleted_at is null
        limit 1
      `,
      [versionId],
    );

    if (!version) {
      throw new AppHttpException(
        'TEMPLATE_NOT_FOUND',
        404,
        'Template version was not found.',
      );
    }

    if (version.workspace_id !== access.activeWorkspace?.id) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        403,
        'Template version does not belong to the active workspace.',
      );
    }

    const validation = await this.validateWorkflowPayload(version.workflow);

    if (!validation.ok) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Only valid template versions can be published.',
        {
          issues: validation.issues,
        },
      );
    }

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.automation_template_versions
          set status = 'deprecated'
          where template_id = $1
            and status = 'published'
        `,
        [version.template_id],
      );

      await client.query(
        `
          update app.automation_template_versions
          set
            status = 'published',
            published_at = timezone('utc', now()),
            validation_status = 'valid',
            validation_issues = '[]'::jsonb
          where id = $1
        `,
        [version.id],
      );

      await client.query(
        `
          update app.automation_templates
          set
            status = 'ready',
            module_codes = $1::text[],
            updated_by_user_id = $2,
            updated_at = timezone('utc', now())
          where id = $3
        `,
        [version.module_codes ?? [], actor.id, version.template_id],
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'automation.template.version_published',
      entityType: 'automation_template',
      entityId: version.template_id,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      metadata: {
        version: version.version,
      },
    });

    return this.getTemplate(access, version.template_id);
  }

  async installTemplate(
    actor: AuthenticatedActor,
    access: AccessContext,
    templateId: string,
    input: {
      readonly workspaceId?: string;
      readonly profileId?: string | null;
      readonly documentIds?: readonly string[];
      readonly connectionIds?: readonly string[];
      readonly approvalPolicy?: 'manual' | 'auto_with_gate';
    },
    requestMeta: RequestMeta,
  ): Promise<InstalledAutomationDetail> {
    const workspaceId = input.workspaceId ?? access.activeWorkspace?.id ?? null;

    if (!workspaceId || workspaceId !== access.activeWorkspace?.id) {
      throw new AppHttpException(
        'NO_WORKSPACE',
        400,
        'Install requires the active workspace.',
      );
    }

    const template = await this.getVisibleTemplateRow(access, templateId);
    const currentVersion = await this.getCurrentTemplateVersion(template.id);

    if (!currentVersion) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        409,
        'Template has no version to install.',
      );
    }

    if (currentVersion.validation_status !== 'valid') {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Template version is invalid and cannot be installed.',
      );
    }

    const resolvedRequirements = resolveInstalledRequirements(
      currentVersion.requirements ?? [],
      access,
      input,
    );
    const compatibilityStatus = deriveCompatibilityStatus(
      template.compatibility_status,
      resolvedRequirements,
    );
    const missingConnections = resolvedRequirements
      .filter(
        (requirement) =>
          requirement.kind === 'connection' && requirement.status !== 'ready',
      )
      .map((requirement) => requirement.code.replace(/^connection\./, ''));
    const disabledReason =
      deriveRequirementBlocker(resolvedRequirements) ??
      template.disabled_reason;
    const installedAutomationId = randomUUID();

    await this.databaseService.query(
      `
        insert into app.installed_automations (
          id,
          workspace_id,
          template_id,
          source_template_version_id,
          title,
          version,
          workflow_state,
          builder_state,
          sync_state,
          compatibility_status,
          available,
          disabled_reason,
          required_inputs,
          requirements,
          missing_connections,
          next_gate,
          workflow,
          created_by_user_id
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          'draft',
          'unavailable',
          'pending',
          $7,
          $8,
          $9,
          $10::text[],
          $11::jsonb,
          $12::text[],
          $13,
          $14::jsonb,
          $15
        )
      `,
      [
        installedAutomationId,
        workspaceId,
        template.id,
        currentVersion.id,
        template.title,
        currentVersion.version,
        compatibilityStatus,
        compatibilityStatus !== 'policy_blocked',
        disabledReason,
        currentVersion.required_inputs ?? [],
        JSON.stringify(resolvedRequirements),
        missingConnections,
        buildNextGate(compatibilityStatus, resolvedRequirements),
        JSON.stringify(currentVersion.workflow),
        actor.id,
      ],
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'automation.template.installed',
      entityType: 'installed_automation',
      entityId: installedAutomationId,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      metadata: {
        templateId: template.id,
        sourceTemplateVersionId: currentVersion.id,
        syncState: 'pending',
      },
    });

    return this.getInstalledAutomation(access, installedAutomationId);
  }

  async forkTemplate(
    actor: AuthenticatedActor,
    access: AccessContext,
    templateId: string,
    input: ForkAutomationTemplateRequest,
    requestMeta: RequestMeta,
  ): Promise<AutomationTemplateDetail> {
    const source = await this.getVisibleTemplateRow(access, templateId);
    const currentVersion = await this.getCurrentTemplateVersion(source.id);
    const workspaceId = access.activeWorkspace?.id;

    if (!workspaceId || !currentVersion) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        409,
        'Template cannot be forked without an active workspace and current version.',
      );
    }

    const forkTemplateId = randomUUID();
    const forkVersionId = randomUUID();
    const baseCode = `${source.code}.fork.${forkTemplateId.slice(0, 8)}`;

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          insert into app.automation_templates (
            id,
            workspace_id,
            code,
            title,
            category,
            description,
            scope,
            status,
            readiness,
            required_permissions,
            module_codes,
            publication_status,
            compatibility_status,
            runtime_sync_state,
            available,
            disabled_reason,
            source_template_id,
            created_by_user_id,
            updated_by_user_id
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            'draft',
            'contract_ready',
            $8::text[],
            $9::text[],
            'not_requested',
            $10,
            'not_requested',
            true,
            null,
            $11,
            $12,
            $12
          )
        `,
        [
          forkTemplateId,
          workspaceId,
          baseCode,
          input.title?.trim() || `${source.title} fork`,
          source.category,
          source.description,
          input.targetScope ?? 'workspace',
          source.required_permissions ?? [],
          currentVersion.module_codes ?? [],
          source.compatibility_status,
          source.id,
          actor.id,
        ],
      );

      await client.query(
        `
          insert into app.automation_template_versions (
            id,
            template_id,
            version,
            status,
            publication_status,
            workflow,
            requirements,
            module_codes,
            required_inputs,
            validation_status,
            validation_issues,
            created_by_user_id
          )
          values (
            $1,
            $2,
            'v1',
            'draft',
            'not_requested',
            $3::jsonb,
            $4::jsonb,
            $5::text[],
            $6::text[],
            'valid',
            '[]'::jsonb,
            $7
          )
        `,
        [
          forkVersionId,
          forkTemplateId,
          JSON.stringify(currentVersion.workflow),
          JSON.stringify(currentVersion.requirements ?? []),
          currentVersion.module_codes ?? [],
          currentVersion.required_inputs ?? [],
          actor.id,
        ],
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'automation.template.forked',
      entityType: 'automation_template',
      entityId: forkTemplateId,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      metadata: {
        sourceTemplateId: source.id,
      },
    });

    return this.getTemplate(access, forkTemplateId);
  }

  async relatedTemplates(
    access: AccessContext | null,
    templateId: string,
  ): Promise<readonly AutomationTemplateSummary[]> {
    const detail = await this.getTemplate(access, templateId);

    if (detail.relatedTemplateIds.length === 0) {
      return [];
    }

    const rows = await Promise.all(
      detail.relatedTemplateIds.map((id) =>
        this.getVisibleTemplateRow(access, id),
      ),
    );

    return rows.map((row) => mapTemplateSummary(row, access));
  }

  async listInstalled(
    access: AccessContext,
  ): Promise<readonly InstalledAutomationDetail[]> {
    const workspaceId = access.activeWorkspace?.id;

    if (!workspaceId) {
      return [];
    }

    const result = await this.databaseService.query<InstalledAutomationRow>(
      `
        select
          id,
          workspace_id,
          template_id,
          source_template_version_id,
          title,
          version,
          workflow_state,
          builder_state,
          sync_state,
          compatibility_status,
          available,
          disabled_reason,
          required_inputs,
          requirements,
          missing_connections,
          next_gate,
          workflow,
          runtime_project_id,
          runtime_flow_id,
          sync_hash,
          last_synced_at
        from app.installed_automations
        where workspace_id = $1
          and deleted_at is null
        order by created_at desc
      `,
      [workspaceId],
    );

    return result.rows.map((row) => mapInstalledAutomation(row));
  }

  async getInstalledAutomation(
    access: AccessContext,
    id: string,
  ): Promise<InstalledAutomationDetail> {
    const row = await this.getInstalledAutomationRow(access, id);
    return mapInstalledAutomation(row);
  }

  async forkInstalledAutomationToTemplate(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    input: ForkAutomationTemplateRequest,
    requestMeta: RequestMeta,
  ): Promise<AutomationTemplateDetail> {
    const installed = await this.getInstalledAutomationRow(
      access,
      automationId,
    );
    const workspaceId = access.activeWorkspace?.id;

    if (!workspaceId) {
      throw new AppHttpException(
        'NO_WORKSPACE',
        400,
        'Fork requires an active workspace.',
      );
    }

    const templateId = randomUUID();
    const versionId = randomUUID();
    const templateCode = `installed.${installed.id.slice(0, 8)}`;
    const sourceVersion = await this.databaseService.one<{
      readonly template_id: string;
    }>(
      `
        select template_id
        from app.automation_template_versions
        where id = $1
        limit 1
      `,
      [installed.source_template_version_id],
    );

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          insert into app.automation_templates (
            id,
            workspace_id,
            code,
            title,
            category,
            description,
            scope,
            status,
            readiness,
            required_permissions,
            module_codes,
            publication_status,
            compatibility_status,
            runtime_sync_state,
            available,
            disabled_reason,
            source_template_id,
            created_by_user_id,
            updated_by_user_id
          )
          values (
            $1,
            $2,
            $3,
            $4,
            'workspace_fork',
            'Forked from installed automation.',
            $5,
            'draft',
            'contract_ready',
            '{}'::text[],
            $6::text[],
            'not_requested',
            $7,
            'not_requested',
            true,
            null,
            $8,
            $9,
            $9
          )
        `,
        [
          templateId,
          workspaceId,
          templateCode,
          input.title?.trim() || `${installed.title} draft`,
          input.targetScope ?? 'workspace',
          extractWorkflowModuleCodes(installed.workflow ?? {}),
          installed.compatibility_status,
          sourceVersion?.template_id ?? installed.template_id,
          actor.id,
        ],
      );

      await client.query(
        `
          insert into app.automation_template_versions (
            id,
            template_id,
            version,
            status,
            publication_status,
            workflow,
            requirements,
            module_codes,
            required_inputs,
            validation_status,
            validation_issues,
            created_by_user_id
          )
          values (
            $1,
            $2,
            'v1',
            'draft',
            'not_requested',
            $3::jsonb,
            $4::jsonb,
            $5::text[],
            $6::text[],
            'valid',
            '[]'::jsonb,
            $7
          )
        `,
        [
          versionId,
          templateId,
          JSON.stringify(installed.workflow ?? {}),
          JSON.stringify(installed.requirements ?? []),
          extractWorkflowModuleCodes(installed.workflow ?? {}),
          installed.required_inputs ?? [],
          actor.id,
        ],
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'automation.installed.forked',
      entityType: 'installed_automation',
      entityId: automationId,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      metadata: {
        targetTemplateId: templateId,
      },
    });

    return this.getTemplate(access, templateId);
  }

  async getInstalledAutomationSourceDiff(
    access: AccessContext,
    automationId: string,
  ): Promise<InstalledAutomationSourceDiff> {
    const installed = await this.getInstalledAutomationRow(
      access,
      automationId,
    );
    const currentSourceVersion = await this.databaseService.one<
      TemplateVersionRow & { readonly template_id: string }
    >(
      `
        select
          id,
          template_id,
          version,
          status,
          publication_status,
          workflow,
          requirements,
          module_codes,
          required_inputs,
          validation_status,
          validation_issues,
          created_at,
          published_at
        from app.automation_template_versions
        where id = $1
        limit 1
      `,
      [installed.source_template_version_id],
    );

    if (!currentSourceVersion) {
      throw new AppHttpException(
        'TEMPLATE_NOT_FOUND',
        404,
        'Installed automation source version was not found.',
      );
    }

    const latestVersion = await this.getCurrentTemplateVersion(
      currentSourceVersion.template_id,
    );

    if (!latestVersion) {
      throw new AppHttpException(
        'TEMPLATE_NOT_FOUND',
        404,
        'Installed automation source template was not found.',
      );
    }

    const changedModuleCodes = difference(
      currentSourceVersion.module_codes ?? [],
      latestVersion.module_codes ?? [],
    );
    const changedRequirementCodes = difference(
      (currentSourceVersion.requirements ?? []).map((item) => item.code),
      (latestVersion.requirements ?? []).map((item) => item.code),
    );
    const hasUpdates = latestVersion.id !== currentSourceVersion.id;

    return {
      installedAutomationId: installed.id,
      sourceTemplateId: currentSourceVersion.template_id,
      sourceTemplateVersionId: currentSourceVersion.id,
      targetTemplateVersionId: latestVersion.id,
      hasUpdates,
      changedModuleCodes,
      changedRequirementCodes,
      summary: hasUpdates
        ? `Source template has ${changedModuleCodes.length} module changes and ${changedRequirementCodes.length} requirement changes.`
        : 'Installed automation is already pinned to the latest source version.',
    };
  }

  async applyInstalledAutomationSourceUpdate(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    input: ApplyInstalledAutomationSourceUpdateRequest,
    requestMeta: RequestMeta,
  ): Promise<InstalledAutomationDetail> {
    const installed = await this.getInstalledAutomationRow(
      access,
      automationId,
    );
    const targetVersion = await this.databaseService.one<
      TemplateVersionRow & {
        readonly template_id: string;
        readonly compatibility_status: CompatibilityStatus;
      }
    >(
      `
        select
          atv.id,
          atv.template_id,
          at.compatibility_status,
          atv.version,
          atv.status,
          atv.publication_status,
          atv.workflow,
          atv.requirements,
          atv.module_codes,
          atv.required_inputs,
          atv.validation_status,
          atv.validation_issues,
          atv.created_at,
          atv.published_at
        from app.automation_template_versions atv
        join app.automation_templates at
          on at.id = atv.template_id
        where atv.id = $1
          and at.deleted_at is null
        limit 1
      `,
      [input.targetTemplateVersionId],
    );

    if (!targetVersion || targetVersion.template_id !== installed.template_id) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Target source version does not match the installed automation source template.',
      );
    }

    await this.databaseService.query(
      `
        update app.installed_automations
        set
          source_template_version_id = $1,
          version = $2,
          sync_state = 'pending',
          compatibility_status = $3,
          required_inputs = $4::text[],
          requirements = $5::jsonb,
          missing_connections = $6::text[],
          next_gate = $7,
          workflow = $8::jsonb,
          updated_at = timezone('utc', now())
        where id = $9
      `,
      [
        targetVersion.id,
        targetVersion.version,
        deriveCompatibilityStatus(
          targetVersion.compatibility_status,
          targetVersion.requirements ?? [],
        ),
        targetVersion.required_inputs ?? [],
        JSON.stringify(targetVersion.requirements ?? []),
        (targetVersion.requirements ?? [])
          .filter(
            (requirement) =>
              requirement.kind === 'connection' &&
              requirement.status !== 'ready',
          )
          .map((requirement) => requirement.code.replace(/^connection\./, '')),
        buildNextGate(
          targetVersion.compatibility_status,
          targetVersion.requirements ?? [],
        ),
        JSON.stringify(targetVersion.workflow),
        installed.id,
      ],
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'automation.installed.source_updated',
      entityType: 'installed_automation',
      entityId: installed.id,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      metadata: {
        sourceTemplateVersionId: targetVersion.id,
      },
    });

    return this.getInstalledAutomation(access, installed.id);
  }

  async submitPublication(
    actor: AuthenticatedActor,
    access: AccessContext,
    templateId: string,
    input: SubmitPublicationRequest,
    requestMeta: RequestMeta,
  ): Promise<PublicationRequest> {
    const template = await this.getEditableTemplate(access, templateId);
    const currentVersion = await this.getCurrentTemplateVersion(template.id);
    const workspaceId = access.activeWorkspace?.id;

    if (!workspaceId || !currentVersion) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        409,
        'Template cannot be submitted without an active workspace and current version.',
      );
    }

    const validation = await this.validateWorkflowPayload(
      currentVersion.workflow,
    );

    if (!validation.ok) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Template failed publication checks.',
        {
          issues: validation.issues,
        },
      );
    }

    const publicationRequestId = randomUUID();

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          insert into app.publication_requests (
            id,
            template_id,
            template_version_id,
            workspace_id,
            status,
            review_note
          )
          values ($1, $2, $3, $4, 'submitted', $5)
        `,
        [
          publicationRequestId,
          template.id,
          currentVersion.id,
          workspaceId,
          input.note?.trim() || null,
        ],
      );

      await client.query(
        `
          update app.automation_templates
          set
            publication_status = 'submitted',
            updated_by_user_id = $1,
            updated_at = timezone('utc', now())
          where id = $2
        `,
        [actor.id, template.id],
      );

      await client.query(
        `
          update app.automation_template_versions
          set publication_status = 'submitted'
          where id = $1
        `,
        [currentVersion.id],
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'automation.publication.submitted',
      entityType: 'publication_request',
      entityId: publicationRequestId,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      metadata: {
        templateId: template.id,
        templateVersionId: currentVersion.id,
      },
    });

    return this.getPublicationRequest(access, publicationRequestId);
  }

  async getPublicationRequest(
    access: AccessContext,
    requestId: string,
  ): Promise<PublicationRequest> {
    const workspaceId = access.activeWorkspace?.id;
    const row = await this.databaseService.one<PublicationRequestRow>(
      `
        select
          id,
          template_id,
          template_version_id,
          workspace_id,
          status,
          submitted_at,
          reviewed_at,
          reviewer_user_id,
          review_note,
          public_template_id
        from app.publication_requests
        where id = $1
          and workspace_id = $2
        limit 1
      `,
      [requestId, workspaceId],
    );

    if (!row) {
      throw new AppHttpException(
        'PUBLICATION_REQUEST_NOT_FOUND',
        404,
        'Publication request was not found.',
      );
    }

    return mapPublicationRequest(row);
  }

  async listPublicationRequests(): Promise<readonly PublicationRequest[]> {
    const result = await this.databaseService.query<PublicationRequestRow>(
      `
        select
          id,
          template_id,
          template_version_id,
          workspace_id,
          status,
          submitted_at,
          reviewed_at,
          reviewer_user_id,
          review_note,
          public_template_id
        from app.publication_requests
        order by submitted_at desc
      `,
    );

    return result.rows.map((row) => mapPublicationRequest(row));
  }

  async getModerationPublicationRequest(
    requestId: string,
  ): Promise<PublicationRequest> {
    const row = await this.databaseService.one<PublicationRequestRow>(
      `
        select
          id,
          template_id,
          template_version_id,
          workspace_id,
          status,
          submitted_at,
          reviewed_at,
          reviewer_user_id,
          review_note,
          public_template_id
        from app.publication_requests
        where id = $1
        limit 1
      `,
      [requestId],
    );

    if (!row) {
      throw new AppHttpException(
        'PUBLICATION_REQUEST_NOT_FOUND',
        404,
        'Publication request was not found.',
      );
    }

    return mapPublicationRequest(row);
  }

  async reviewPublicationRequest(
    actor: AuthenticatedActor,
    requestId: string,
    decision: ModerationDecision,
    requestMeta: RequestMeta,
  ): Promise<PublicationRequest> {
    const publicationRequest =
      await this.databaseService.one<PublicationRequestRow>(
        `
        select
          id,
          template_id,
          template_version_id,
          workspace_id,
          status,
          submitted_at,
          reviewed_at,
          reviewer_user_id,
          review_note,
          public_template_id
        from app.publication_requests
        where id = $1
        limit 1
      `,
        [requestId],
      );

    if (!publicationRequest) {
      throw new AppHttpException(
        'PUBLICATION_REQUEST_NOT_FOUND',
        404,
        'Publication request was not found.',
      );
    }

    const sourceTemplate = await this.databaseService.one<TemplateSummaryRow>(
      `
        select
          at.id,
          at.workspace_id,
          at.code,
          at.title,
          at.category,
          at.description,
          at.scope,
          at.status,
          at.readiness,
          at.required_permissions,
          at.module_codes,
          at.publication_status,
          at.compatibility_status,
          at.runtime_sync_state,
          at.available,
          at.disabled_reason,
          at.source_template_id,
          atv.id as version_id,
          atv.version,
          atv.workflow,
          atv.requirements,
          atv.required_inputs,
          atv.validation_status,
          atv.validation_issues
        from app.automation_templates at
        join app.automation_template_versions atv
          on atv.id = $2
        where at.id = $1
          and at.deleted_at is null
        limit 1
      `,
      [publicationRequest.template_id, publicationRequest.template_version_id],
    );

    if (!sourceTemplate) {
      throw new AppHttpException(
        'TEMPLATE_NOT_FOUND',
        404,
        'Template for publication request was not found.',
      );
    }

    let publicTemplateId = publicationRequest.public_template_id;

    await this.databaseService.transaction(async (client) => {
      if (decision.decision === 'approve') {
        publicTemplateId = publicTemplateId ?? randomUUID();
        const publicVersionId = randomUUID();
        const publicCode = buildPublicTemplateCode(
          sourceTemplate.code,
          sourceTemplate.id,
        );

        await client.query(
          `
            insert into app.automation_templates (
              id,
              workspace_id,
              code,
              title,
              category,
              description,
              scope,
              status,
              readiness,
              required_permissions,
              module_codes,
              publication_status,
              compatibility_status,
              runtime_sync_state,
              available,
              disabled_reason,
              source_template_id,
              created_by_user_id,
              updated_by_user_id
            )
            values (
              $1,
              null,
              $2,
              $3,
              $4,
              $5,
              'public',
              'ready',
              $6,
              $7::text[],
              $8::text[],
              'approved',
              $9,
              $10,
              true,
              null,
              $11,
              $12,
              $12
            )
            on conflict (code) do update
            set
              title = excluded.title,
              category = excluded.category,
              description = excluded.description,
              readiness = excluded.readiness,
              required_permissions = excluded.required_permissions,
              module_codes = excluded.module_codes,
              publication_status = excluded.publication_status,
              compatibility_status = excluded.compatibility_status,
              runtime_sync_state = excluded.runtime_sync_state,
              source_template_id = excluded.source_template_id,
              updated_by_user_id = excluded.updated_by_user_id,
              updated_at = timezone('utc', now())
          `,
          [
            publicTemplateId,
            publicCode,
            sourceTemplate.title,
            sourceTemplate.category,
            sourceTemplate.description,
            sourceTemplate.readiness,
            sourceTemplate.required_permissions ?? [],
            sourceTemplate.module_codes ?? [],
            sourceTemplate.compatibility_status,
            sourceTemplate.runtime_sync_state,
            sourceTemplate.id,
            actor.id,
          ],
        );

        await client.query(
          `
            insert into app.automation_template_versions (
              id,
              template_id,
              version,
              status,
              publication_status,
              workflow,
              requirements,
              module_codes,
              required_inputs,
              validation_status,
              validation_issues,
              created_by_user_id,
              published_at
            )
            values (
              $1,
              $2,
              $3,
              'published',
              'approved',
              $4::jsonb,
              $5::jsonb,
              $6::text[],
              $7::text[],
              'valid',
              '[]'::jsonb,
              $8,
              timezone('utc', now())
            )
            on conflict (template_id, version) do update
            set
              status = 'published',
              publication_status = 'approved',
              workflow = excluded.workflow,
              requirements = excluded.requirements,
              module_codes = excluded.module_codes,
              required_inputs = excluded.required_inputs,
              validation_status = 'valid',
              validation_issues = '[]'::jsonb,
              published_at = timezone('utc', now())
          `,
          [
            publicVersionId,
            publicTemplateId,
            sourceTemplate.version ?? 'v1',
            JSON.stringify(sourceTemplate.workflow ?? {}),
            JSON.stringify(sourceTemplate.requirements ?? []),
            sourceTemplate.module_codes ?? [],
            sourceTemplate.required_inputs ?? [],
            actor.id,
          ],
        );
      }

      await client.query(
        `
          update app.publication_requests
          set
            status = $1,
            reviewed_at = timezone('utc', now()),
            reviewer_user_id = $2,
            review_note = $3,
            public_template_id = $4,
            updated_at = timezone('utc', now())
          where id = $5
        `,
        [
          normalizePublicationDecision(decision.decision),
          actor.id,
          decision.note,
          publicTemplateId ?? null,
          publicationRequest.id,
        ],
      );

      await client.query(
        `
          update app.automation_templates
          set
            publication_status = $1,
            updated_by_user_id = $2,
            updated_at = timezone('utc', now())
          where id = $3
        `,
        [
          normalizePublicationDecision(decision.decision),
          actor.id,
          publicationRequest.template_id,
        ],
      );

      await client.query(
        `
          update app.automation_template_versions
          set publication_status = $1
          where id = $2
        `,
        [
          normalizePublicationDecision(decision.decision),
          publicationRequest.template_version_id,
        ],
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: publicationRequest.workspace_id,
      action: 'automation.publication.reviewed',
      entityType: 'publication_request',
      entityId: publicationRequest.id,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      metadata: {
        decision: decision.decision,
        publicTemplateId: publicTemplateId ?? null,
      },
    });

    return this.getModerationPublicationRequest(publicationRequest.id);
  }

  private async getVisibleTemplateRow(
    access: AccessContext | null,
    templateId: string,
  ): Promise<TemplateSummaryRow> {
    const row = await this.databaseService.one<TemplateSummaryRow>(
      `
        select
          at.id,
          at.workspace_id,
          at.code,
          at.title,
          at.category,
          at.description,
          at.scope,
          at.status,
          at.readiness,
          at.required_permissions,
          at.module_codes,
          at.publication_status,
          at.compatibility_status,
          at.runtime_sync_state,
          at.available,
          at.disabled_reason,
          at.source_template_id,
          current_version.id as version_id,
          current_version.version,
          current_version.workflow,
          current_version.requirements,
          current_version.required_inputs,
          current_version.validation_status,
          current_version.validation_issues
        from app.automation_templates at
        left join lateral (
          select
            atv.id,
            atv.version,
            atv.workflow,
            atv.requirements,
            atv.required_inputs,
            atv.validation_status,
            atv.validation_issues
          from app.automation_template_versions atv
          where atv.template_id = at.id
          order by
            case when atv.status = 'published' then 0 else 1 end,
            atv.published_at desc nulls last,
            atv.created_at desc
          limit 1
        ) current_version on true
        where at.id = $1
          and at.deleted_at is null
          and (
            at.scope in ('product', 'public')
            or at.workspace_id = $2
          )
        limit 1
      `,
      [templateId, access?.activeWorkspace?.id ?? null],
    );

    if (!row) {
      throw new AppHttpException(
        'TEMPLATE_NOT_FOUND',
        404,
        'Automation template was not found.',
      );
    }

    return row;
  }

  private async getEditableTemplate(
    access: AccessContext,
    templateId: string,
  ): Promise<TemplateSummaryRow> {
    const template = await this.getVisibleTemplateRow(access, templateId);

    if (
      template.workspace_id !== access.activeWorkspace?.id ||
      (template.scope !== 'workspace' && template.scope !== 'private')
    ) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        403,
        'Template is not editable in the active workspace.',
      );
    }

    return template;
  }

  private async listTemplateVersions(
    templateId: string,
  ): Promise<readonly TemplateVersionRow[]> {
    const result = await this.databaseService.query<TemplateVersionRow>(
      `
        select
          id,
          version,
          status,
          publication_status,
          workflow,
          requirements,
          module_codes,
          required_inputs,
          validation_status,
          validation_issues,
          created_at,
          published_at
        from app.automation_template_versions
        where template_id = $1
        order by
          case when status = 'published' then 0 else 1 end,
          published_at desc nulls last,
          created_at desc
      `,
      [templateId],
    );

    return result.rows;
  }

  private async getCurrentTemplateVersion(
    templateId: string,
  ): Promise<TemplateVersionRow | null> {
    return this.databaseService.one<TemplateVersionRow>(
      `
        select
          id,
          version,
          status,
          publication_status,
          workflow,
          requirements,
          module_codes,
          required_inputs,
          validation_status,
          validation_issues,
          created_at,
          published_at
        from app.automation_template_versions
        where template_id = $1
        order by
          case when status = 'published' then 0 else 1 end,
          published_at desc nulls last,
          created_at desc
        limit 1
      `,
      [templateId],
    );
  }

  private async getInstalledAutomationRow(
    access: AccessContext,
    automationId: string,
  ): Promise<InstalledAutomationRow> {
    const row = await this.databaseService.one<InstalledAutomationRow>(
      `
        select
          id,
          workspace_id,
          template_id,
          source_template_version_id,
          title,
          version,
          workflow_state,
          builder_state,
          sync_state,
          compatibility_status,
          available,
          disabled_reason,
          required_inputs,
          requirements,
          missing_connections,
          next_gate,
          workflow,
          runtime_project_id,
          runtime_flow_id,
          sync_hash,
          last_synced_at
        from app.installed_automations
        where id = $1
          and workspace_id = $2
          and deleted_at is null
        limit 1
      `,
      [automationId, access.activeWorkspace?.id ?? null],
    );

    if (!row) {
      throw new AppHttpException(
        'AUTOMATION_NOT_FOUND',
        404,
        'Installed automation was not found.',
      );
    }

    return row;
  }

  private async validateWorkflowPayload(
    workflow: Record<string, unknown>,
  ): Promise<WorkflowValidationSummary> {
    const result = await this.databaseService.query<ModuleRegistryRow>(
      `
        select
          lm.code,
          current_version.input_schema,
          current_version.output_schema
        from app.legal_modules lm
        join lateral (
          select input_schema, output_schema
          from app.legal_module_versions lmv
          where lmv.module_id = lm.id
          order by
            case when lmv.status = 'published' then 0 else 1 end,
            lmv.published_at desc nulls last,
            lmv.created_at desc
          limit 1
        ) current_version on true
        where lm.deleted_at is null
      `,
    );

    return validateWorkflowDefinition(workflow, {
      modules: result.rows.map((row) => ({
        code: row.code,
        inputBindings: (row.input_schema ?? []).map((entry) => entry.code),
        outputBindings: (row.output_schema ?? []).map((entry) => entry.code),
        requiresApproval: row.code === 'delivery.email-draft',
      })),
    });
  }
}

function mapTemplateSummary(
  row: TemplateSummaryRow,
  access: AccessContext | null,
): AutomationTemplateSummary {
  const missingPermissions = (row.required_permissions ?? []).filter(
    (permission) => !access?.permissions.includes(permission as never),
  );
  const available = row.available && missingPermissions.length === 0;

  return {
    id: row.id,
    code: row.code,
    title: row.title,
    category: row.category,
    status: row.status,
    owner: mapOwner(row.scope),
    scope: row.scope,
    version: row.version ?? 'draft',
    readiness: row.readiness,
    requiredPermissions: (row.required_permissions ??
      []) as AutomationTemplateSummary['requiredPermissions'],
    moduleCodes: row.module_codes ?? [],
    description: row.description,
    publicationStatus: row.publication_status,
    compatibilityStatus: row.compatibility_status,
    runtimeSyncState: row.runtime_sync_state,
    available,
    disabledReason:
      available || missingPermissions.length === 0
        ? row.disabled_reason
        : `Missing workspace permissions: ${missingPermissions.join(', ')}`,
  };
}

function mapTemplateVersion(
  row: TemplateVersionRow,
): AutomationTemplateVersionSummary {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    publicationStatus: row.publication_status,
    validationStatus: row.validation_status,
    validationIssues: row.validation_issues ?? [],
    createdAt: row.created_at,
    publishedAt: row.published_at,
    moduleCodes: row.module_codes ?? [],
    requiredInputs: row.required_inputs ?? [],
  };
}

function mapInstalledAutomation(
  row: InstalledAutomationRow,
): InstalledAutomationDetail {
  const requirementsSummary = {
    ready: (row.requirements ?? []).filter(
      (requirement) => requirement.status === 'ready',
    ).length,
    missing: (row.requirements ?? []).filter(
      (requirement) => requirement.status === 'missing',
    ).length,
    blocked: (row.requirements ?? []).filter(
      (requirement) => requirement.status === 'blocked',
    ).length,
  };
  const canOpenBuilder =
    row.available &&
    row.sync_state === 'synced' &&
    row.builder_state === 'ready' &&
    row.compatibility_status !== 'policy_blocked';
  const canRun =
    canOpenBuilder &&
    (row.missing_connections ?? []).length === 0 &&
    requirementsSummary.missing === 0 &&
    requirementsSummary.blocked === 0;

  return {
    id: row.id,
    title: row.title,
    version: row.version,
    workspaceId: row.workspace_id,
    templateId: row.template_id,
    sourceTemplateVersionId: row.source_template_version_id,
    workflowState: row.workflow_state,
    builderState: row.builder_state,
    syncState: row.sync_state,
    compatibilityStatus: row.compatibility_status,
    available: row.available,
    disabledReason: row.disabled_reason,
    requiredInputs: row.required_inputs ?? [],
    requirements: row.requirements ?? [],
    missingConnections: row.missing_connections ?? [],
    nextGate: row.next_gate,
    runtimeProjectId: row.runtime_project_id,
    runtimeFlowId: row.runtime_flow_id,
    syncHash: row.sync_hash,
    lastSyncedAt: row.last_synced_at,
    requirementsSummary,
    canOpenBuilder,
    canRun,
  };
}

function mapPublicationRequest(row: PublicationRequestRow): PublicationRequest {
  return {
    id: row.id,
    templateId: row.template_id,
    templateVersionId: row.template_version_id,
    workspaceId: row.workspace_id,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewerUserId: row.reviewer_user_id,
    reviewNote: row.review_note,
    publicTemplateId: row.public_template_id,
  };
}

function mapOwner(scope: AutomationTemplateScope): AutomationTemplateOwner {
  if (scope === 'product') {
    return 'lexframe';
  }

  if (scope === 'public') {
    return 'public';
  }

  if (scope === 'workspace') {
    return 'workspace';
  }

  return 'private';
}

function extractWorkflowModuleCodes(
  workflow: Record<string, unknown>,
  fallback: readonly string[] = [],
): readonly string[] {
  const steps: readonly unknown[] = Array.isArray(workflow.steps)
    ? workflow.steps
    : [];
  const moduleCodes = steps
    .map((step) => getStringProperty(step, 'moduleCode'))
    .filter((value): value is string => Boolean(value));

  if (moduleCodes.length === 0) {
    return [...fallback];
  }

  return [...new Set(moduleCodes)];
}

function extractWorkflowInputs(
  workflow: Record<string, unknown>,
): readonly string[] {
  const inputs: readonly unknown[] = Array.isArray(workflow.inputs)
    ? workflow.inputs
    : [];

  return inputs
    .map((entry) => getStringProperty(entry, 'code'))
    .filter((value): value is string => Boolean(value));
}

function getStringProperty(value: unknown, key: string): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const property = record[key];

  return typeof property === 'string' ? property : null;
}

function resolveInstalledRequirements(
  requirements: readonly TemplateRequirement[],
  access: AccessContext,
  input: {
    readonly profileId?: string | null;
    readonly documentIds?: readonly string[];
    readonly connectionIds?: readonly string[];
  },
): readonly TemplateRequirement[] {
  return requirements.map((requirement) => {
    let status = requirement.status;

    if (
      requirement.kind === 'profile' &&
      !input.profileId &&
      !requirement.optional
    ) {
      status = 'missing';
    }

    if (
      requirement.kind === 'document' &&
      !requirement.optional &&
      (!input.documentIds || input.documentIds.length === 0)
    ) {
      status = 'missing';
    }

    if (requirement.kind === 'connection') {
      const connectionCode = requirement.code.replace(/^connection\./, '');

      if (!input.connectionIds?.includes(connectionCode)) {
        status = requirement.optional ? 'missing' : 'blocked';
      }
    }

    if (
      requirement.kind === 'permission' &&
      !access.permissions.includes(requirement.code as never)
    ) {
      status = 'blocked';
    }

    return {
      ...requirement,
      status,
    };
  });
}

function deriveCompatibilityStatus(
  storedStatus: CompatibilityStatus,
  requirements: readonly TemplateRequirement[],
): CompatibilityStatus {
  if (requirements.some((requirement) => requirement.status === 'blocked')) {
    return 'policy_blocked';
  }

  if (requirements.some((requirement) => requirement.status === 'missing')) {
    return 'missing_requirements';
  }

  return storedStatus;
}

function deriveRequirementBlocker(
  requirements: readonly TemplateRequirement[],
): string | null {
  const blocker = requirements.find(
    (requirement) =>
      requirement.status === 'blocked' || requirement.status === 'missing',
  );

  return blocker ? `${blocker.label} is ${blocker.status}.` : null;
}

function buildNextGate(
  compatibilityStatus: CompatibilityStatus,
  requirements: readonly TemplateRequirement[],
): string {
  const blocker = deriveRequirementBlocker(requirements);

  if (blocker) {
    return `Resolve requirement blockers before runtime sync: ${blocker}`;
  }

  if (compatibilityStatus === 'runtime_sync_pending') {
    return 'Runtime projection is not synced yet. Sync the automation before opening the builder or starting a run.';
  }

  if (compatibilityStatus === 'compatible') {
    return 'Requirements are satisfied. Sync runtime to provision the embedded builder and execution loop.';
  }

  return 'Review compatibility blockers before continuing.';
}

function difference(
  left: readonly string[],
  right: readonly string[],
): readonly string[] {
  const leftOnly = left.filter((value) => !right.includes(value));
  const rightOnly = right.filter((value) => !left.includes(value));
  return [...new Set([...leftOnly, ...rightOnly])];
}

function buildPublicTemplateCode(
  code: string,
  sourceTemplateId: string,
): string {
  return `public.${code.replace(/[^a-z0-9._-]+/gi, '-')}.${sourceTemplateId.slice(0, 8)}`;
}

function normalizePublicationDecision(
  decision: ModerationDecision['decision'],
): PublicationRequest['status'] {
  if (decision === 'approve') {
    return 'approved';
  }

  if (decision === 'reject') {
    return 'rejected';
  }

  return 'changes_requested';
}
