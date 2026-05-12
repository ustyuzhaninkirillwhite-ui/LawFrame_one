import type { Stage17CanvasEnsureWireResponse } from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { loadServerEnv } from '@lexframe/config';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { Pool, type PoolClient } from 'pg';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { DatabaseService } from '../database/database.service';
import {
  STAGE17_ALLOWED_PIECE_NAMES,
  STAGE17_AUTOMATION_BRAND,
  STAGE17_PINNED_PIECE_NAMES,
} from './activepieces-piece-catalog';

const STAGE17_TEMPLATE_CODE = 'stage17.activepieces.canvas';
const STAGE17_TEMPLATE_VERSION = 'v17-canvas';
const STAGE17_PLATFORM_ID = 'lfstg17platform000001';
const STAGE17_SYNC_HASH = 'stage21-activepieces-0.82-canvas-v1';
const STAGE17_FLOW_DISPLAY_NAME = 'Сценарий AI-шлюза LexFrame';
const STAGE17_MANUAL_TRIGGER_DISPLAY_NAME = 'Ручной запуск';
const STAGE17_MANUAL_TRIGGER_DESCRIPTION =
  'Запускает сценарий автоматизации вручную.';

type ActivepiecesCatalogMode = 'max' | 'restricted';

interface TemplateRow {
  readonly id: string;
  readonly version_id: string;
}

interface InstalledAutomationRow {
  readonly id: string;
  readonly title: string;
}

interface ActivepiecesPlatformPiecesPolicy {
  readonly mode: ActivepiecesCatalogMode;
  readonly filteredPieceNames: readonly string[];
  readonly filteredPieceBehavior: 'ALLOWED' | 'BLOCKED';
}

@Injectable()
export class ActivepiecesCanvasProvisioningService implements OnModuleDestroy {
  private readonly env = loadServerEnv();
  private apPool: Pool | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async ensureStage17Canvas(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly projectId: string;
    readonly traceId: string | null;
  }): Promise<Stage17CanvasEnsureWireResponse> {
    const workspace = input.access.activeWorkspace;
    if (!workspace) {
      throw new AppHttpException(
        'WORKSPACE_CONTEXT_REQUIRED',
        403,
        'Active workspace is required to provision automation canvas.',
      );
    }

    const template = await this.ensureTemplate(input.actor.id);
    const existing = await this.findInstalledAutomation(workspace.id);
    const recoveredAutomationId =
      existing?.id ??
      (await this.findExistingActivepiecesAutomationId(workspace.id));
    const automationId = recoveredAutomationId ?? randomUUID();
    let ids = buildActivepiecesIds({
      workspaceId: workspace.id,
      actorId: input.actor.id,
      automationId,
    });

    ids = await this.ensureActivepiecesRows({
      actor: input.actor,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      automationId,
      ids,
    });

    await this.ensureProductRows({
      actor: input.actor,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      automationId,
      template,
      routeProjectId: input.projectId,
      ids,
      traceId: input.traceId,
    });

    return {
      status: 'ready',
      readiness_code: 'READY',
      automation_id: automationId,
      project_id: input.projectId,
      route: `/app/projects/${encodeURIComponent(
        input.projectId,
      )}/automations/${encodeURIComponent(automationId)}/automation`,
      activepieces_project_id: ids.projectId,
      activepieces_flow_id: ids.flowId,
      activepieces_flow_version_id: ids.flowVersionId,
    };
  }

  private async ensureTemplate(actorId: string): Promise<TemplateRow> {
    const templateId = randomUUID();
    const versionId = randomUUID();
    const workflow = {
      version: 'stage17',
      source: 'stage17_canvas_runtime_ensure',
      trigger: { type: 'manual' },
      runtime: { provider: 'activepieces' },
    };

    await this.databaseService.query(
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
          created_by_user_id,
          updated_by_user_id
        )
        values (
          $1,
          null,
          $2,
          'Рабочее пространство автоматизаций',
          'automation',
          'Основной сценарий Stage 17 для открытия встроенного конструктора автоматизаций.',
          'product',
          'ready',
          'production_ready',
          array['automation.read']::text[],
          array['automation.canvas']::text[],
          'approved',
          'compatible',
          'synced',
          true,
          null,
          $3,
          $3
        )
        on conflict (code) do update
        set
          title = excluded.title,
          category = excluded.category,
          description = excluded.description,
          status = 'ready',
          readiness = 'production_ready',
          compatibility_status = 'compatible',
          runtime_sync_state = 'synced',
          available = true,
          disabled_reason = null,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_at = timezone('utc', now())
      `,
      [templateId, STAGE17_TEMPLATE_CODE, actorId],
    );

    const row = await this.databaseService.one<TemplateRow>(
      `
        with template as (
          select id
          from app.automation_templates
          where code = $1
          limit 1
        ),
        version as (
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
          select
            $2,
            template.id,
            $3,
            'published',
            'approved',
            $4::jsonb,
            '[]'::jsonb,
            array['automation.canvas']::text[],
            '{}'::text[],
            'valid',
            '[]'::jsonb,
            $5,
            timezone('utc', now())
          from template
          on conflict (template_id, version) do update
          set
            status = 'published',
            publication_status = 'approved',
            workflow = excluded.workflow,
            validation_status = 'valid',
            validation_issues = '[]'::jsonb,
            published_at = timezone('utc', now())
          returning id, template_id
        )
        select template.id, version.id as version_id
        from template
        join version on version.template_id = template.id
      `,
      [
        STAGE17_TEMPLATE_CODE,
        versionId,
        STAGE17_TEMPLATE_VERSION,
        JSON.stringify(workflow),
        actorId,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        500,
        'Stage 17 Canvas template could not be prepared.',
      );
    }

    return row;
  }

  private findInstalledAutomation(
    workspaceId: string,
  ): Promise<InstalledAutomationRow | null> {
    return this.databaseService.one<InstalledAutomationRow>(
      `
        select ia.id, ia.title
        from app.installed_automations ia
        join app.automation_templates at
          on at.id = ia.template_id
        where ia.workspace_id = $1
          and at.code = $2
          and ia.deleted_at is null
        order by ia.created_at desc
        limit 1
      `,
      [workspaceId, STAGE17_TEMPLATE_CODE],
    );
  }

  private async findExistingActivepiecesAutomationId(workspaceId: string) {
    const pool = this.getActivepiecesPool();
    const row = await pool.query<{ readonly externalId: string }>(
      `
        select flow."externalId"
        from project
        join flow on flow."projectId" = project.id
        where project."externalId" = $1
          and flow."externalId" is not null
        order by flow.created asc
        limit 1
      `,
      [`lex_ws_${workspaceId}`],
    );

    return row.rows[0]?.externalId ?? null;
  }

  private async ensureProductRows(input: {
    readonly actor: AuthenticatedActor;
    readonly workspaceId: string;
    readonly workspaceName: string;
    readonly automationId: string;
    readonly template: TemplateRow;
    readonly routeProjectId: string;
    readonly ids: ActivepiecesIds;
    readonly traceId: string | null;
  }) {
    const workflow = {
      version: 'stage17',
      source: 'stage17_canvas_runtime_ensure',
      trigger: { type: 'manual' },
      runtime: {
        provider: 'activepieces',
        projectId: input.ids.projectId,
        flowId: input.ids.flowId,
        flowVersionId: input.ids.flowVersionId,
      },
    };
    const externalProjectId = `lex_ws_${input.workspaceId}`;
    const externalUserId = `lex_user_${input.actor.id}`;

    await this.databaseService.transaction(async (client) => {
      await client.query(
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
            runtime_project_id,
            runtime_flow_id,
            sync_hash,
            last_synced_at,
            created_by_user_id
          )
          values (
            $1,
            $2,
            $3,
            $4,
            'Сценарий автоматизации Stage 17',
            $5,
            'execution_ready',
            'ready',
            'synced',
            'compatible',
            true,
            null,
            '{}'::text[],
            '[]'::jsonb,
            '{}'::text[],
            'ready',
            $6::jsonb,
            $7,
            $8,
            $9,
            timezone('utc', now()),
            $10
          )
          on conflict (id) do update
          set
            template_id = excluded.template_id,
            source_template_version_id = excluded.source_template_version_id,
            title = excluded.title,
            version = excluded.version,
            workflow_state = 'execution_ready',
            builder_state = 'ready',
            sync_state = 'synced',
            compatibility_status = 'compatible',
            available = true,
            disabled_reason = null,
            required_inputs = '{}'::text[],
            requirements = '[]'::jsonb,
            missing_connections = '{}'::text[],
            next_gate = 'ready',
            workflow = excluded.workflow,
            runtime_project_id = excluded.runtime_project_id,
            runtime_flow_id = excluded.runtime_flow_id,
            sync_hash = excluded.sync_hash,
            last_synced_at = timezone('utc', now()),
            production_disabled_at = null,
            production_disabled_reason = null,
            updated_at = timezone('utc', now())
        `,
        [
          input.automationId,
          input.workspaceId,
          input.template.id,
          input.template.version_id,
          STAGE17_TEMPLATE_VERSION,
          JSON.stringify(workflow),
          input.ids.projectId,
          input.ids.flowId,
          STAGE17_SYNC_HASH,
          input.actor.id,
        ],
      );

      await client.query(
        `
          insert into app.activepieces_project_bindings (
            workspace_id,
            external_project_id,
            display_name,
            status,
            last_synced_at,
            created_by_user_id,
            project_id,
            ap_project_id,
            project_display_name,
            last_read_back_at,
            last_session_trace_id,
            pieces_filter_type,
            pieces_policy_hash
          )
          values (
            $1,
            $2,
            $3,
            'provisioned',
            timezone('utc', now()),
            $4,
            $5,
            $6,
            $3,
            timezone('utc', now()),
            $7,
            'ALLOWED',
            $8
          )
          on conflict (workspace_id) do update
          set
            external_project_id = excluded.external_project_id,
            display_name = excluded.display_name,
            status = 'provisioned',
            last_synced_at = timezone('utc', now()),
            project_id = excluded.project_id,
            ap_project_id = excluded.ap_project_id,
            project_display_name = excluded.project_display_name,
            last_read_back_at = timezone('utc', now()),
            last_session_trace_id = excluded.last_session_trace_id,
            pieces_filter_type = 'ALLOWED',
            pieces_policy_hash = excluded.pieces_policy_hash,
            updated_at = timezone('utc', now())
        `,
        [
          input.workspaceId,
          externalProjectId,
          `${input.workspaceName} - рабочее пространство автоматизаций`,
          input.actor.id,
          input.routeProjectId,
          input.ids.projectId,
          input.traceId,
          STAGE17_SYNC_HASH,
        ],
      );

      await client.query(
        `
          insert into app.activepieces_user_bindings (
            workspace_id,
            auth_user_id,
            external_user_id,
            role,
            status,
            user_id,
            ap_role,
            last_token_issued_at,
            ap_user_id,
            last_login_at,
            last_read_back_at,
            last_session_trace_id
          )
          values (
            $1,
            $2,
            $3,
            $4,
            'provisioned',
            $2,
            $4,
            timezone('utc', now()),
            $5,
            timezone('utc', now()),
            timezone('utc', now()),
            $6
          )
          on conflict (workspace_id, auth_user_id) do update
          set
            external_user_id = excluded.external_user_id,
            role = excluded.role,
            status = 'provisioned',
            user_id = excluded.user_id,
            ap_role = excluded.ap_role,
            last_token_issued_at = timezone('utc', now()),
            ap_user_id = excluded.ap_user_id,
            last_login_at = timezone('utc', now()),
            last_read_back_at = timezone('utc', now()),
            last_session_trace_id = excluded.last_session_trace_id,
            updated_at = timezone('utc', now())
        `,
        [
          input.workspaceId,
          input.actor.id,
          externalUserId,
          mapActivepiecesRole(input.actor, input.workspaceId),
          input.ids.userId,
          input.traceId,
        ],
      );

      const runtimeBindingId = await this.upsertRuntimeBinding(client, {
        ...input,
        externalProjectId,
      });
      await this.upsertFlowBinding(client, input, runtimeBindingId);
    });
  }

  private async upsertRuntimeBinding(
    client: PoolClient,
    input: {
      readonly workspaceId: string;
      readonly automationId: string;
      readonly template: TemplateRow;
      readonly routeProjectId: string;
      readonly ids: ActivepiecesIds;
      readonly traceId: string | null;
      readonly externalProjectId: string;
    },
  ) {
    const projection = {
      runtime: 'activepieces',
      projectId: input.ids.projectId,
      flowId: input.ids.flowId,
      flowVersionId: input.ids.flowVersionId,
      redacted: true,
    };
    const row = await client.query<{ readonly id: string }>(
      `
        insert into app.automation_runtime_bindings (
          installed_automation_id,
          workspace_id,
          source_template_version_id,
          external_project_id,
          external_flow_id,
          sync_hash,
          projection_version,
          projection,
          status,
          last_synced_at,
          activepieces_flow_version_id,
          source_workflow_hash,
          runtime_hash,
          last_synced_hash,
          last_checked_at,
          last_synced_workflow_hash,
          last_synced_mapping_hash,
          active,
          activepieces_read_back_status,
          last_read_back_at,
          last_session_trace_id,
          lexframe_project_id,
          ap_published_version_id,
          piece_version_pin
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          'stage17',
          $7::jsonb,
          'synced',
          timezone('utc', now()),
          $8,
          $6,
          $6,
          $6,
          timezone('utc', now()),
          $6,
          $6,
          true,
          'succeeded',
          timezone('utc', now()),
          $9,
          $10,
          null,
          '0.0.5'
        )
        on conflict (installed_automation_id) do update
        set
          external_project_id = excluded.external_project_id,
          external_flow_id = excluded.external_flow_id,
          sync_hash = excluded.sync_hash,
          projection_version = excluded.projection_version,
          projection = excluded.projection,
          status = 'synced',
          last_synced_at = timezone('utc', now()),
          activepieces_flow_version_id = excluded.activepieces_flow_version_id,
          source_workflow_hash = excluded.source_workflow_hash,
          runtime_hash = excluded.runtime_hash,
          last_synced_hash = excluded.last_synced_hash,
          last_checked_at = timezone('utc', now()),
          last_synced_workflow_hash = excluded.last_synced_workflow_hash,
          last_synced_mapping_hash = excluded.last_synced_mapping_hash,
          active = true,
          activepieces_read_back_status = 'succeeded',
          last_read_back_at = timezone('utc', now()),
          last_session_trace_id = excluded.last_session_trace_id,
          lexframe_project_id = excluded.lexframe_project_id,
          piece_version_pin = excluded.piece_version_pin,
          updated_at = timezone('utc', now())
        returning id
      `,
      [
        input.automationId,
        input.workspaceId,
        input.template.version_id,
        input.ids.projectId,
        input.ids.flowId,
        STAGE17_SYNC_HASH,
        JSON.stringify(projection),
        input.ids.flowVersionId,
        input.traceId,
        input.routeProjectId,
      ],
    );

    return row.rows[0]!.id;
  }

  private async upsertFlowBinding(
    client: PoolClient,
    input: {
      readonly workspaceId: string;
      readonly automationId: string;
      readonly ids: ActivepiecesIds;
    },
    runtimeBindingId: string,
  ) {
    await client.query(
      `
        insert into app.activepieces_flow_bindings (
          workspace_id,
          automation_id,
          runtime_binding_id,
          ap_project_id,
          ap_flow_id,
          ap_flow_version_id,
          piece_version_pin,
          source_workflow_hash,
          runtime_hash,
          last_synced_hash,
          sync_status,
          last_synced_at,
          last_read_back_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          '0.0.5',
          $7,
          $7,
          $7,
          'synced',
          timezone('utc', now()),
          timezone('utc', now())
        )
        on conflict (workspace_id, automation_id) do update
        set
          runtime_binding_id = excluded.runtime_binding_id,
          ap_project_id = excluded.ap_project_id,
          ap_flow_id = excluded.ap_flow_id,
          ap_flow_version_id = excluded.ap_flow_version_id,
          piece_version_pin = excluded.piece_version_pin,
          source_workflow_hash = excluded.source_workflow_hash,
          runtime_hash = excluded.runtime_hash,
          last_synced_hash = excluded.last_synced_hash,
          sync_status = 'synced',
          last_synced_at = timezone('utc', now()),
          last_read_back_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
      `,
      [
        input.workspaceId,
        input.automationId,
        runtimeBindingId,
        input.ids.projectId,
        input.ids.flowId,
        input.ids.flowVersionId,
        STAGE17_SYNC_HASH,
      ],
    );
  }

  private async ensureActivepiecesRows(input: {
    readonly actor: AuthenticatedActor;
    readonly workspaceId: string;
    readonly workspaceName: string;
    readonly automationId: string;
    readonly ids: ActivepiecesIds;
  }): Promise<ActivepiecesIds> {
    const pool = this.getActivepiecesPool();
    const client = await pool.connect();
    const nowExpression =
      'to_char(timezone(\'utc\', now()), \'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"\')';
    const [firstName, ...lastNameParts] = splitDisplayName(
      input.actor.fullName,
    );

    try {
      await client.query('begin');
      const ids = await this.resolveActivepiecesIds(client, input);
      const platformPiecesPolicy = this.buildActivepiecesPlatformPiecesPolicy();
      await client.query(
        `
          insert into user_identity (
            id,
            email,
            password,
            "trackEvents",
            "newsLetter",
            verified,
            "firstName",
            "lastName",
            "tokenVersion",
            provider
          )
          values (
            $1::varchar,
            case
              when exists (
                select 1
                from user_identity
                where email = $2::varchar
                  and id <> $1::varchar
              )
              then $5::varchar
              else $2::varchar
            end,
            'managed-by-lexframe-jwt',
            false,
            false,
            true,
            $3,
            $4,
            'stage17',
            'EMAIL'
          )
          on conflict (id) do update
          set
            email = case
              when exists (
                select 1
                from user_identity
                where email = $2::varchar
                  and id <> $1::varchar
              )
              then $5::varchar
              else $2::varchar
            end,
            verified = true,
            "firstName" = excluded."firstName",
            "lastName" = excluded."lastName",
            updated = now()
        `,
        [
          ids.identityId,
          input.actor.email,
          firstName,
          lastNameParts.join(' ') || 'Stage17',
          `${ids.identityId}@local.lexframe`,
        ],
      );

      await client.query(
        `
          insert into "user" (
            id,
            status,
            "externalId",
            "platformId",
            "platformRole",
            "identityId"
          )
          values ($1, 'ACTIVE', $2, null, 'ADMIN', $3)
          on conflict (id) do update
          set
            status = 'ACTIVE',
            "externalId" = excluded."externalId",
            "platformRole" = 'ADMIN',
            "identityId" = excluded."identityId",
          updated = now()
        `,
        [ids.userId, `lex_user_${input.actor.id}`, ids.identityId],
      );

      if (
        await this.hasActivepiecesColumn(client, 'platform', 'showPoweredBy')
      ) {
        await client.query(
          `
          insert into platform (
            id,
            "ownerId",
            name,
            "primaryColor",
            "logoIconUrl",
            "fullLogoUrl",
            "favIconUrl",
            "showPoweredBy",
            "cloudAuthEnabled",
            "embeddingEnabled",
            "filteredPieceNames",
            "filteredPieceBehavior",
            "environmentsEnabled",
            "defaultLocale",
            "allowedAuthDomains",
            "enforceAllowedAuthDomains",
            "ssoEnabled",
            "emailAuthEnabled",
            "federatedAuthProviders",
            "auditLogEnabled",
            "customDomainsEnabled",
            "customAppearanceEnabled",
            "manageProjectsEnabled",
            "managePiecesEnabled",
            "manageTemplatesEnabled",
            "apiKeysEnabled",
            "projectRolesEnabled",
            "flowIssuesEnabled",
            "alertsEnabled",
            "analyticsEnabled",
            "licenseKey",
            smtp,
            "pinnedPieces",
            "globalConnectionsEnabled",
            "customRolesEnabled",
            "copilotSettings"
          )
          values (
            $1,
            $2,
            $3,
            $10,
            $4,
            $5,
            $6,
            false,
            false,
            true,
            $7::varchar[],
            $8::text,
            false,
            'ru',
            array[]::varchar[],
            false,
            false,
            false,
            '{}'::jsonb,
            true,
            false,
            true,
            true,
            false,
            false,
            true,
            false,
            true,
            true,
            false,
            null,
            null,
            $9::varchar[],
            false,
            false,
            '{"providers":{}}'::jsonb
          )
          on conflict (id) do update
          set
            "ownerId" = excluded."ownerId",
            name = excluded.name,
            "primaryColor" = excluded."primaryColor",
            "logoIconUrl" = excluded."logoIconUrl",
            "fullLogoUrl" = excluded."fullLogoUrl",
            "favIconUrl" = excluded."favIconUrl",
            "showPoweredBy" = false,
            "embeddingEnabled" = true,
            "filteredPieceNames" = excluded."filteredPieceNames",
            "filteredPieceBehavior" = excluded."filteredPieceBehavior",
            "defaultLocale" = 'ru',
            "pinnedPieces" = excluded."pinnedPieces",
            "copilotSettings" = excluded."copilotSettings",
            updated = now()
        `,
          [
            STAGE17_PLATFORM_ID,
            ids.userId,
            STAGE17_AUTOMATION_BRAND.platformName,
            STAGE17_AUTOMATION_BRAND.logoIconUrl,
            STAGE17_AUTOMATION_BRAND.fullLogoUrl,
            STAGE17_AUTOMATION_BRAND.favIconUrl,
            platformPiecesPolicy.filteredPieceNames,
            platformPiecesPolicy.filteredPieceBehavior,
            [...STAGE17_PINNED_PIECE_NAMES],
            STAGE17_AUTOMATION_BRAND.primaryColor,
          ],
        );
      } else {
        await this.upsertModernPlatform(client, {
          ownerId: ids.userId,
          platformPiecesPolicy,
        });
      }

      await this.ensureManualTriggerPiece(client);

      await client.query(
        `
          update "user"
          set "platformId" = $1,
              updated = now()
          where id = $2
        `,
        [STAGE17_PLATFORM_ID, ids.userId],
      );

      if (await this.hasActivepiecesColumn(client, 'project', 'notifyStatus')) {
        await client.query(
          `
          insert into project (
            id,
            "ownerId",
            "displayName",
            "notifyStatus",
            "platformId",
            "externalId",
            "releasesEnabled"
          )
          values ($1, $2, $3, 'ALWAYS', $4, $5, false)
          on conflict (id) do update
          set
            "ownerId" = excluded."ownerId",
            "displayName" = excluded."displayName",
            "notifyStatus" = 'ALWAYS',
            "platformId" = excluded."platformId",
            "externalId" = excluded."externalId",
            updated = now()
        `,
          [
            ids.projectId,
            ids.userId,
            `${input.workspaceName} - автоматизации`,
            STAGE17_PLATFORM_ID,
            `lex_ws_${input.workspaceId}`,
          ],
        );
      } else {
        await this.upsertModernProject(client, {
          projectId: ids.projectId,
          ownerId: ids.userId,
          workspaceId: input.workspaceId,
          workspaceName: input.workspaceName,
        });
      }

      if (
        await this.hasActivepiecesColumn(
          client,
          'project_plan',
          'stripeCustomerId',
        )
      ) {
        await client.query(
          `
          insert into project_plan (
            id,
            "projectId",
            name,
            "stripeCustomerId",
            "stripeSubscriptionId",
            tasks,
            "subscriptionStartDatetime"
          )
          values ($1, $2, 'FREE', $3, $4, 100000, now())
          on conflict (id) do update
          set
            "projectId" = excluded."projectId",
            name = excluded.name,
            "stripeCustomerId" = excluded."stripeCustomerId",
            "stripeSubscriptionId" = excluded."stripeSubscriptionId",
            tasks = excluded.tasks,
            updated = now()
        `,
          [
            ids.planId,
            ids.projectId,
            `lexframe_customer_${ids.planId}`,
            `lexframe_subscription_${ids.planId}`,
          ],
        );
      } else {
        await this.upsertModernProjectPlan(client, ids);
      }

      if (await this.hasActivepiecesColumn(client, 'flow', 'schedule')) {
        await client.query(
          `
          insert into flow (
            id,
            "projectId",
            "folderId",
            status,
            schedule,
            "publishedVersionId",
            "externalId"
          )
          values ($1, $2, null, 'DISABLED', null, null, $3)
          on conflict (id) do update
          set
            "projectId" = excluded."projectId",
            status = 'DISABLED',
            "externalId" = excluded."externalId",
            updated = now()
        `,
          [ids.flowId, ids.projectId, input.automationId],
        );
      } else {
        await this.upsertModernFlow(client, {
          flowId: ids.flowId,
          projectId: ids.projectId,
          automationId: input.automationId,
        });
      }

      if (
        await this.hasActivepiecesColumn(
          client,
          'flow_version',
          'connectionIds',
        )
      ) {
        await this.upsertModernFlowVersion(client, {
          flowVersionId: ids.flowVersionId,
          flowId: ids.flowId,
          userId: ids.userId,
          nowExpression,
        });
      } else {
        await client.query(
          `
          insert into flow_version (
            id,
            "flowId",
            "displayName",
            trigger,
            valid,
            state,
            "updatedBy",
            "schemaVersion"
          )
          values (
            $1,
            $2,
            $4::text,
            jsonb_build_object(
              'name', 'trigger',
              'valid', true,
              'displayName', $5::text,
              'type', 'PIECE_TRIGGER',
              'settings', jsonb_build_object(
                'pieceName', '@activepieces/piece-manual-trigger',
                'pieceVersion', '0.0.5',
                'pieceType', 'OFFICIAL',
                'packageType', 'REGISTRY',
                'triggerName', 'manual_trigger',
                'input', '{}'::jsonb,
                'inputUiInfo', '{}'::jsonb,
                'propertySettings', '{}'::jsonb
              ),
              'lastUpdatedDate', ${nowExpression}
            ),
            true,
            'DRAFT',
            $3,
            '20'
          )
          on conflict (id) do update
          set
            "displayName" = excluded."displayName",
            trigger = excluded.trigger,
            valid = true,
            state = 'DRAFT',
            "updatedBy" = excluded."updatedBy",
            "schemaVersion" = excluded."schemaVersion",
            updated = now()
        `,
          [
            ids.flowVersionId,
            ids.flowId,
            ids.userId,
            STAGE17_FLOW_DISPLAY_NAME,
            STAGE17_MANUAL_TRIGGER_DISPLAY_NAME,
          ],
        );
      }

      await client.query('commit');
      return ids;
    } catch (error) {
      await client.query('rollback');
      throw new AppHttpException(
        'ACTIVEPIECES_RUNTIME_UNAVAILABLE',
        503,
        'Automation canvas provisioning failed.',
        redactActivepiecesProvisioningError(error),
      );
    } finally {
      client.release();
    }
  }

  private buildActivepiecesPlatformPiecesPolicy(): ActivepiecesPlatformPiecesPolicy {
    if (this.env.ACTIVEPIECES_CATALOG_MODE === 'restricted') {
      return {
        mode: 'restricted',
        filteredPieceNames: [...STAGE17_ALLOWED_PIECE_NAMES],
        filteredPieceBehavior: 'ALLOWED',
      };
    }

    return {
      mode: 'max',
      filteredPieceNames: [],
      filteredPieceBehavior: 'BLOCKED',
    };
  }

  private async hasActivepiecesColumn(
    client: PoolClient,
    tableName: string,
    columnName: string,
  ) {
    const result = await client.query<{ readonly exists: boolean }>(
      `
        select exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = $1
            and column_name = $2
        ) as exists
      `,
      [tableName, columnName],
    );

    return result.rows[0]?.exists === true;
  }

  private async upsertModernPlatform(
    client: PoolClient,
    input: {
      readonly ownerId: string;
      readonly platformPiecesPolicy: ActivepiecesPlatformPiecesPolicy;
    },
  ) {
    await client.query(
      `
        insert into platform (
          id,
          "ownerId",
          name,
          "primaryColor",
          "logoIconUrl",
          "fullLogoUrl",
          "favIconUrl",
          "cloudAuthEnabled",
          "filteredPieceNames",
          "filteredPieceBehavior",
          "allowedAuthDomains",
          "enforceAllowedAuthDomains",
          "emailAuthEnabled",
          "federatedAuthProviders",
          "pinnedPieces"
        )
        values (
          $1,
          $2,
          $3,
          $10,
          $4,
          $5,
          $6,
          false,
          $7::varchar[],
          $8::text,
          array[]::varchar[],
          false,
          false,
          '{}'::jsonb,
          $9::varchar[]
        )
        on conflict (id) do update
        set
          "ownerId" = excluded."ownerId",
          name = excluded.name,
          "primaryColor" = excluded."primaryColor",
          "logoIconUrl" = excluded."logoIconUrl",
          "fullLogoUrl" = excluded."fullLogoUrl",
          "favIconUrl" = excluded."favIconUrl",
          "cloudAuthEnabled" = false,
          "filteredPieceNames" = excluded."filteredPieceNames",
          "filteredPieceBehavior" = excluded."filteredPieceBehavior",
          "allowedAuthDomains" = excluded."allowedAuthDomains",
          "enforceAllowedAuthDomains" = false,
          "emailAuthEnabled" = false,
          "federatedAuthProviders" = excluded."federatedAuthProviders",
          "pinnedPieces" = excluded."pinnedPieces",
          updated = now()
      `,
      [
        STAGE17_PLATFORM_ID,
        input.ownerId,
        STAGE17_AUTOMATION_BRAND.platformName,
        STAGE17_AUTOMATION_BRAND.logoIconUrl,
        STAGE17_AUTOMATION_BRAND.fullLogoUrl,
        STAGE17_AUTOMATION_BRAND.favIconUrl,
        input.platformPiecesPolicy.filteredPieceNames,
        input.platformPiecesPolicy.filteredPieceBehavior,
        [...STAGE17_PINNED_PIECE_NAMES],
        STAGE17_AUTOMATION_BRAND.primaryColor,
      ],
    );
  }

  private async upsertModernProject(
    client: PoolClient,
    input: {
      readonly projectId: string;
      readonly ownerId: string;
      readonly workspaceId: string;
      readonly workspaceName: string;
    },
  ) {
    await client.query(
      `
        insert into project (
          id,
          "ownerId",
          "displayName",
          "platformId",
          "externalId",
          "releasesEnabled",
          icon,
          type
        )
        values ($1, $2, $3, $4, $5, false, '{"color":"BLUE"}'::jsonb, 'PERSONAL')
        on conflict (id) do update
        set
          "ownerId" = excluded."ownerId",
          "displayName" = excluded."displayName",
          "platformId" = excluded."platformId",
          "externalId" = excluded."externalId",
          "releasesEnabled" = false,
          icon = excluded.icon,
          type = excluded.type,
          updated = now()
      `,
      [
        input.projectId,
        input.ownerId,
        `${input.workspaceName} - Р°РІС‚РѕРјР°С‚РёР·Р°С†РёРё`,
        STAGE17_PLATFORM_ID,
        `lex_ws_${input.workspaceId}`,
      ],
    );
  }

  private async upsertModernProjectPlan(
    client: PoolClient,
    ids: ActivepiecesIds,
  ) {
    await client.query(
      `
        insert into project_plan (
          id,
          "projectId",
          name,
          pieces,
          "piecesFilterType",
          locked
        )
        values ($1, $2, 'FREE', array[]::varchar[], 'NONE', false)
        on conflict (id) do update
        set
          "projectId" = excluded."projectId",
          name = excluded.name,
          pieces = excluded.pieces,
          "piecesFilterType" = excluded."piecesFilterType",
          locked = false,
          updated = now()
      `,
      [ids.planId, ids.projectId],
    );
  }

  private async upsertModernFlow(
    client: PoolClient,
    input: {
      readonly flowId: string;
      readonly projectId: string;
      readonly automationId: string;
    },
  ) {
    await client.query(
      `
        insert into flow (
          id,
          "projectId",
          "folderId",
          status,
          "publishedVersionId",
          "externalId",
          metadata,
          "operationStatus"
        )
        values ($1, $2, null, 'DISABLED', null, $3, null, 'NONE')
        on conflict (id) do update
        set
          "projectId" = excluded."projectId",
          status = 'DISABLED',
          "externalId" = excluded."externalId",
          "operationStatus" = 'NONE',
          updated = now()
      `,
      [input.flowId, input.projectId, input.automationId],
    );
  }

  private async upsertModernFlowVersion(
    client: PoolClient,
    input: {
      readonly flowVersionId: string;
      readonly flowId: string;
      readonly userId: string;
      readonly nowExpression: string;
    },
  ) {
    await client.query(
      `
        insert into flow_version (
          id,
          "flowId",
          "displayName",
          trigger,
          valid,
          state,
          "updatedBy",
          "schemaVersion",
          "connectionIds",
          "agentIds",
          notes
        )
        values (
          $1,
          $2,
          $4::text,
          jsonb_build_object(
            'name', 'trigger',
            'valid', true,
            'displayName', $5::text,
            'type', 'PIECE_TRIGGER',
            'settings', jsonb_build_object(
              'pieceName', '@activepieces/piece-manual-trigger',
              'pieceVersion', '0.0.5',
              'pieceType', 'OFFICIAL',
                'packageType', 'REGISTRY',
                'triggerName', 'manual_trigger',
                'input', '{}'::jsonb,
                'inputUiInfo', '{}'::jsonb,
                'propertySettings', '{}'::jsonb
              ),
            'lastUpdatedDate', ${input.nowExpression}
          ),
          true,
          'DRAFT',
          $3,
          '20',
          array[]::varchar[],
          array[]::varchar[],
          '[]'::jsonb
        )
        on conflict (id) do update
        set
          "displayName" = excluded."displayName",
          trigger = excluded.trigger,
          valid = true,
          state = 'DRAFT',
          "updatedBy" = excluded."updatedBy",
          "schemaVersion" = excluded."schemaVersion",
          "connectionIds" = excluded."connectionIds",
          "agentIds" = excluded."agentIds",
          notes = excluded.notes,
          updated = now()
      `,
      [
        input.flowVersionId,
        input.flowId,
        input.userId,
        STAGE17_FLOW_DISPLAY_NAME,
        STAGE17_MANUAL_TRIGGER_DISPLAY_NAME,
      ],
    );
  }

  private async resolveActivepiecesIds(
    client: PoolClient,
    input: {
      readonly actor: AuthenticatedActor;
      readonly workspaceId: string;
      readonly automationId: string;
      readonly ids: ActivepiecesIds;
    },
  ): Promise<ActivepiecesIds> {
    const externalUserId = `lex_user_${input.actor.id}`;
    const externalProjectId = `lex_ws_${input.workspaceId}`;
    const user = await client.query<{
      readonly id: string;
      readonly identityId: string | null;
    }>(
      `
        select id, "identityId"
        from "user"
        where "externalId" = $1
        order by case when "platformId" = $2 then 0 else 1 end, created asc
        limit 1
      `,
      [externalUserId, STAGE17_PLATFORM_ID],
    );
    const project = await client.query<{ readonly id: string }>(
      `
        select id
        from project
        where "externalId" = $1
        order by case when "platformId" = $2 then 0 else 1 end, created asc
        limit 1
      `,
      [externalProjectId, STAGE17_PLATFORM_ID],
    );
    const existingProjectId = project.rows[0]?.id ?? null;
    const resolvedProjectId =
      existingProjectId && isValidActivepiecesId(existingProjectId)
        ? existingProjectId
        : input.ids.projectId;
    const flow = await client.query<{ readonly id: string }>(
      `
        select id
        from flow
        where "externalId" = $1
        order by created asc
        limit 1
      `,
      [input.automationId],
    );
    const existingFlowId = flow.rows[0]?.id ?? null;
    const resolvedFlowId =
      existingFlowId && isValidActivepiecesId(existingFlowId)
        ? existingFlowId
        : input.ids.flowId;
    const flowVersion = await client.query<{ readonly id: string }>(
      `
        select id
        from flow_version
        where "flowId" = $1
        order by updated desc, created desc
        limit 1
      `,
      [resolvedFlowId],
    );
    const plan = await client.query<{ readonly id: string }>(
      `
        select id
        from project_plan
        where "projectId" = $1
        order by created asc
        limit 1
      `,
      [resolvedProjectId],
    );

    const existingUser = user.rows[0] ?? null;
    const existingUserId = existingUser?.id ?? null;
    const resolvedUserId =
      existingUserId && isValidActivepiecesId(existingUserId)
        ? existingUserId
        : input.ids.userId;
    const resolvedIdentityId =
      existingUserId &&
      isValidActivepiecesId(existingUserId) &&
      existingUser?.identityId
        ? existingUser.identityId
        : input.ids.identityId;

    await detachLegacyExternalIds(client, {
      externalUserId,
      externalProjectId,
      automationId: input.automationId,
      userId: existingUser?.id ?? null,
      projectId: existingProjectId,
      flowId: existingFlowId,
    });

    return {
      identityId: resolvedIdentityId,
      userId: resolvedUserId,
      projectId: resolvedProjectId,
      flowId: resolvedFlowId,
      flowVersionId: flowVersion.rows[0]?.id ?? input.ids.flowVersionId,
      planId: plan.rows[0]?.id ?? input.ids.planId,
    };
  }

  private async ensureManualTriggerPiece(client: PoolClient) {
    await client.query(
      `
        insert into piece_metadata (
          id,
          name,
          "displayName",
          "logoUrl",
          description,
          version,
          "minimumSupportedRelease",
          "maximumSupportedRelease",
          actions,
          triggers,
          auth,
          "pieceType",
          "packageType",
          "archiveId",
          "platformId",
          categories,
          authors,
          "projectUsage"
        )
        values (
          'lfstg17piece000000001',
          '@activepieces/piece-manual-trigger',
          $1::text,
          '/lexframe-automation-icon.svg',
          $2::text,
          '0.0.5',
          '0.0.0',
          '999.999.999',
          '{}'::json,
          json_build_object(
            'manual_trigger', json_build_object(
              'name', 'manual_trigger',
              'displayName', $1::text,
              'description', $2::text,
              'props', '{}'::json,
              'type', 'MANUAL',
              'sampleData', '{}'::json,
              'testStrategy', 'SIMULATION'
            )
          ),
          null,
          'OFFICIAL',
          'REGISTRY',
          null,
          null,
          array['CORE']::varchar[],
          array['LexFrame Stage17']::varchar[],
          0
        )
        on conflict (id) do update
        set
          name = excluded.name,
          "displayName" = excluded."displayName",
          "logoUrl" = excluded."logoUrl",
          description = excluded.description,
          triggers = excluded.triggers,
          updated = now()
      `,
      [STAGE17_MANUAL_TRIGGER_DISPLAY_NAME, STAGE17_MANUAL_TRIGGER_DESCRIPTION],
    );
  }

  private getActivepiecesPool() {
    if (this.apPool) {
      return this.apPool;
    }

    this.apPool = new Pool({
      host: this.env.ACTIVEPIECES_POSTGRES_HOST,
      port: this.env.ACTIVEPIECES_POSTGRES_PORT,
      database: this.env.ACTIVEPIECES_POSTGRES_DATABASE,
      user: this.env.ACTIVEPIECES_POSTGRES_USERNAME,
      password: readSecret(
        this.env.ACTIVEPIECES_POSTGRES_PASSWORD,
        this.env.ACTIVEPIECES_POSTGRES_PASSWORD_FILE,
      ),
    });
    return this.apPool;
  }

  async onModuleDestroy() {
    await this.apPool?.end();
  }
}

export function redactActivepiecesProvisioningError(error: unknown) {
  return {
    reasonCode: classifyActivepiecesProvisioningError(error),
    safeToShow: true,
  };
}

function classifyActivepiecesProvisioningError(error: unknown) {
  const message = coerceProvisioningErrorMessage(error);
  if (/duplicate key|unique constraint/i.test(message)) {
    return 'AP_PROVISIONING_CONFLICT';
  }
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connection|network/i.test(message)) {
    return 'AP_RUNTIME_UNREACHABLE';
  }
  return 'AP_PROVISIONING_FAILED';
}

function coerceProvisioningErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (
    typeof error === 'number' ||
    typeof error === 'boolean' ||
    typeof error === 'bigint'
  ) {
    return String(error);
  }
  return '';
}

interface ActivepiecesIds {
  readonly identityId: string;
  readonly userId: string;
  readonly projectId: string;
  readonly flowId: string;
  readonly flowVersionId: string;
  readonly planId: string;
}

function buildActivepiecesIds(input: {
  readonly workspaceId: string;
  readonly actorId: string;
  readonly automationId: string;
}): ActivepiecesIds {
  return {
    identityId: idFrom('lfi', input.actorId),
    userId: idFrom('lfu', input.actorId),
    projectId: idFrom('lfp', input.workspaceId),
    flowId: idFrom('lff', input.automationId),
    flowVersionId: idFrom('lfv', input.automationId),
    planId: idFrom('lpl', input.workspaceId),
  };
}

function idFrom(prefix: string, value: string) {
  return `${prefix}${createHash('sha256').update(value).digest('hex')}`.slice(
    0,
    21,
  );
}

function isValidActivepiecesId(value: string | null | undefined): boolean {
  return (
    typeof value === 'string' &&
    /^[0-9a-zA-Z]{21}$/.test(value) &&
    !value.startsWith('lfstg17')
  );
}

async function detachLegacyExternalIds(
  client: PoolClient,
  input: {
    readonly externalUserId: string;
    readonly externalProjectId: string;
    readonly automationId: string;
    readonly userId: string | null;
    readonly projectId: string | null;
    readonly flowId: string | null;
  },
) {
  if (input.userId && !isValidActivepiecesId(input.userId)) {
    await client.query(
      `
        update "user"
        set "externalId" = $2,
            updated = now()
        where id = $1
          and "externalId" = $3
      `,
      [
        input.userId,
        `${input.externalUserId}:legacy:${input.userId}`,
        input.externalUserId,
      ],
    );
  }

  if (input.projectId && !isValidActivepiecesId(input.projectId)) {
    await client.query(
      `
        update project
        set "externalId" = $2,
            updated = now()
        where id = $1
          and "externalId" = $3
      `,
      [
        input.projectId,
        `${input.externalProjectId}:legacy:${input.projectId}`,
        input.externalProjectId,
      ],
    );
  }

  if (input.flowId && !isValidActivepiecesId(input.flowId)) {
    await client.query(
      `
        update flow
        set "externalId" = $2,
            updated = now()
        where id = $1
          and "externalId" = $3
      `,
      [
        input.flowId,
        `${input.automationId}:legacy:${input.flowId}`,
        input.automationId,
      ],
    );
  }
}

function readSecret(envValue: string, filePath: string) {
  if (filePath && existsSync(filePath)) {
    return readFileSync(filePath, 'utf8').trim();
  }
  return envValue;
}

function splitDisplayName(value: string | null) {
  const fallback = ['LexFrame', 'Stage17'];
  const parts = value?.trim().split(/\s+/).filter(Boolean);
  return parts && parts.length > 0 ? parts : fallback;
}

function mapActivepiecesRole(actor: AuthenticatedActor, workspaceId: string) {
  void actor;
  void workspaceId;
  return 'ADMIN';
}
