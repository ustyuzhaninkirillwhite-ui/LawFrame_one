import type {
  CreateLegalWorkProfileRequest,
  EffectiveProfilePreview,
  EffectiveProfileSnapshotSummary,
  LegalWorkProfileDetail,
  LegalWorkProfileSummary,
  LegalWorkProfileVersionSummary,
  PreviewEffectiveProfileRequest,
  ProfileValidationResult,
  RestoreLegalWorkProfileVersionRequest,
  UpdateLegalWorkProfileDraftRequest,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import {
  deepMerge,
  extractLockedPaths,
  hashJson,
  sortJson,
  type RequestMeta,
} from '../stage7-support/stage7.helpers';

interface ProfileRow {
  readonly id: string;
  readonly workspace_id: string | null;
  readonly owner_user_id: string | null;
  readonly profile_type: LegalWorkProfileSummary['profileType'];
  readonly name: string;
  readonly description: string | null;
  readonly status: LegalWorkProfileSummary['status'];
  readonly current_version_id: string | null;
  readonly created_by_user_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface ProfileVersionRow {
  readonly id: string;
  readonly profile_id: string;
  readonly version: number;
  readonly schema_version: string;
  readonly status: LegalWorkProfileVersionSummary['status'];
  readonly content: Record<string, unknown>;
  readonly content_hash: string;
  readonly change_note: string | null;
  readonly created_by_user_id: string | null;
  readonly published_by_user_id: string | null;
  readonly created_at: string;
  readonly published_at: string | null;
}

interface SnapshotRow {
  readonly id: string;
  readonly workspace_id: string | null;
  readonly user_id: string | null;
  readonly source_profile_version_ids: readonly string[];
  readonly effective_content: Record<string, unknown>;
  readonly effective_hash: string;
  readonly created_for_run_id: string | null;
  readonly created_for_preview_id: string | null;
  readonly created_at: string;
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async getCurrent(
    access: AccessContext | null,
    actorId: string | null,
  ): Promise<LegalWorkProfileDetail | null> {
    const workspaceId = access?.activeWorkspace?.id ?? null;

    if (!workspaceId || !actorId) {
      return null;
    }

    const row = await this.databaseService.one<ProfileRow>(
      `
        select
          p.id,
          p.workspace_id,
          p.owner_user_id,
          p.profile_type,
          p.name,
          p.description,
          p.status,
          p.current_version_id,
          p.created_by_user_id,
          p.created_at,
          p.updated_at
        from app.legal_work_profiles p
        where p.deleted_at is null
          and (
            (p.profile_type = 'personal' and p.owner_user_id = $2 and (p.workspace_id = $1 or p.workspace_id is null))
            or (p.profile_type = 'workspace' and p.workspace_id = $1)
          )
        order by
          case when p.profile_type = 'personal' then 0 else 1 end,
          p.updated_at desc
        limit 1
      `,
      [workspaceId, actorId],
    );

    if (!row) {
      return null;
    }

    return this.getDetail(access, row.id);
  }

  async getDetail(
    access: AccessContext | null,
    profileId: string,
  ): Promise<LegalWorkProfileDetail> {
    const workspaceId = access?.activeWorkspace?.id ?? null;
    const profile = await this.databaseService.one<ProfileRow>(
      `
        select
          id,
          workspace_id,
          owner_user_id,
          profile_type,
          name,
          description,
          status,
          current_version_id,
          created_by_user_id,
          created_at,
          updated_at
        from app.legal_work_profiles
        where id = $1
          and deleted_at is null
          and (
            workspace_id is null
            or workspace_id = $2
          )
        limit 1
      `,
      [profileId, workspaceId],
    );

    if (!profile) {
      throw new AppHttpException(
        'PROFILE_NOT_FOUND',
        404,
        'Legal work profile was not found.',
      );
    }

    const versions = await this.listVersions(profileId);
    const currentVersion = versions.find(
      (entry) => entry.id === profile.current_version_id,
    );
    const validation = this.validateProfileContent(
      currentVersion?.content ?? {},
    );

    return {
      ...mapProfileRow(profile),
      versions,
      validation,
      effectivePreview: null,
    };
  }

  async getEffective(
    access: AccessContext | null,
    actorId: string | null,
  ): Promise<EffectiveProfileSnapshotSummary | null> {
    const workspaceId = access?.activeWorkspace?.id ?? null;

    if (!workspaceId || !actorId) {
      return null;
    }

    const snapshot = await this.computeEffectiveSnapshot({
      workspaceId,
      userId: actorId,
    });

    return snapshot;
  }

  async create(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: CreateLegalWorkProfileRequest,
    meta: RequestMeta,
  ): Promise<LegalWorkProfileDetail> {
    const workspaceId = access.activeWorkspace!.id;
    const content = sortJson(input.content) as Record<string, unknown>;
    const validation = this.validateProfileContent(content);

    return this.databaseService.transaction(async (client) => {
      const profileResult = await client.query<{ id: string }>(
        `
          insert into app.legal_work_profiles (
            workspace_id,
            owner_user_id,
            profile_type,
            name,
            description,
            status,
            created_by_user_id,
            updated_by_user_id
          )
          values ($1, $2, $3, $4, $5, 'draft', $6, $6)
          returning id
        `,
        [
          input.profileType === 'system'
            ? null
            : (input.workspaceId ?? workspaceId),
          input.profileType === 'personal'
            ? (input.ownerUserId ?? actor.id)
            : null,
          input.profileType,
          input.name.trim(),
          input.description ?? null,
          actor.id,
        ],
      );
      const profileId = profileResult.rows[0]!.id;

      const versionResult = await client.query<{ id: string }>(
        `
          insert into app.legal_work_profile_versions (
            profile_id,
            workspace_id,
            version,
            schema_version,
            status,
            content,
            content_hash,
            change_note,
            created_by_user_id
          )
          values ($1, $2, 1, 'stage7.v1', 'draft', $3::jsonb, $4, $5, $6)
          returning id
        `,
        [
          profileId,
          input.profileType === 'system'
            ? null
            : (input.workspaceId ?? workspaceId),
          JSON.stringify(validation.normalizedContent),
          hashJson(validation.normalizedContent),
          input.changeNote ?? null,
          actor.id,
        ],
      );

      await client.query(
        `
          update app.legal_work_profiles
          set current_version_id = $2
          where id = $1
        `,
        [profileId, versionResult.rows[0]!.id],
      );

      await this.auditService.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        workspaceId,
        action: 'profile.created',
        entityType: 'legal_work_profile',
        entityId: profileId,
        result: 'success',
        requestId: meta.requestId,
        traceId: meta.traceId,
        metadata: {
          profileType: input.profileType,
          validationOk: validation.ok,
        },
      });

      return this.getDetail(access, profileId);
    });
  }

  async updateDraft(
    actor: AuthenticatedActor,
    access: AccessContext,
    profileId: string,
    input: UpdateLegalWorkProfileDraftRequest,
    meta: RequestMeta,
  ): Promise<LegalWorkProfileDetail> {
    const profile = await this.getProfileRow(
      profileId,
      access.activeWorkspace!.id,
    );
    const currentVersion = await this.getCurrentVersion(profile);
    const nextContent = sortJson({
      ...(currentVersion?.content ?? {}),
      ...(input.content ?? {}),
    }) as Record<string, unknown>;
    const validation = this.validateProfileContent(nextContent);

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.legal_work_profiles
          set
            name = coalesce($2, name),
            description = coalesce($3, description),
            updated_by_user_id = $4,
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [
          profileId,
          input.name?.trim() ?? null,
          input.description ?? null,
          actor.id,
        ],
      );

      if (!currentVersion || currentVersion.status === 'published') {
        const versionNo = await this.getNextProfileVersionNumber(profileId);
        const insertResult = await client.query<{ id: string }>(
          `
            insert into app.legal_work_profile_versions (
              profile_id,
              workspace_id,
              version,
              schema_version,
              status,
              content,
              content_hash,
              change_note,
              created_by_user_id
            )
            values ($1, $2, $3, 'stage7.v1', 'draft', $4::jsonb, $5, $6, $7)
            returning id
          `,
          [
            profileId,
            profile.workspace_id,
            versionNo,
            JSON.stringify(validation.normalizedContent),
            hashJson(validation.normalizedContent),
            input.changeNote ?? null,
            actor.id,
          ],
        );

        await client.query(
          `
            update app.legal_work_profiles
            set current_version_id = $2
            where id = $1
          `,
          [profileId, insertResult.rows[0]!.id],
        );
      } else {
        await client.query(
          `
            update app.legal_work_profile_versions
            set
              content = $2::jsonb,
              content_hash = $3,
              change_note = coalesce($4, change_note)
            where id = $1
          `,
          [
            currentVersion.id,
            JSON.stringify(validation.normalizedContent),
            hashJson(validation.normalizedContent),
            input.changeNote ?? null,
          ],
        );
      }
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'profile.updated',
      entityType: 'legal_work_profile',
      entityId: profileId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        immutableSource: currentVersion?.status === 'published',
      },
    });

    return this.getDetail(access, profileId);
  }

  async validate(
    access: AccessContext | null,
    profileId: string,
  ): Promise<ProfileValidationResult> {
    const detail = await this.getDetail(access, profileId);
    return detail.validation;
  }

  async publish(
    actor: AuthenticatedActor,
    access: AccessContext,
    profileId: string,
    meta: RequestMeta,
  ): Promise<LegalWorkProfileDetail> {
    const profile = await this.getProfileRow(
      profileId,
      access.activeWorkspace!.id,
    );
    const currentVersion = await this.getCurrentVersion(profile);

    if (!currentVersion) {
      throw new AppHttpException(
        'PROFILE_VERSION_NOT_FOUND',
        409,
        'Current profile version is missing.',
      );
    }

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.legal_work_profile_versions
          set
            status = case when id = $2 then 'published' else status end,
            published_by_user_id = case when id = $2 then $3 else published_by_user_id end,
            published_at = case when id = $2 then timezone('utc', now()) else published_at end
          where profile_id = $1
        `,
        [profileId, currentVersion.id, actor.id],
      );

      await client.query(
        `
          update app.legal_work_profiles
          set
            status = 'active',
            current_version_id = $2,
            updated_by_user_id = $3,
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [profileId, currentVersion.id, actor.id],
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'profile.published',
      entityType: 'legal_work_profile_version',
      entityId: currentVersion.id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        profileId,
      },
    });

    return this.getDetail(access, profileId);
  }

  async restoreVersion(
    actor: AuthenticatedActor,
    access: AccessContext,
    profileId: string,
    input: RestoreLegalWorkProfileVersionRequest,
    meta: RequestMeta,
  ): Promise<LegalWorkProfileDetail> {
    const profile = await this.getProfileRow(
      profileId,
      access.activeWorkspace!.id,
    );
    const version = await this.databaseService.one<ProfileVersionRow>(
      `
        select
          id,
          profile_id,
          version,
          schema_version,
          status,
          content,
          content_hash,
          change_note,
          created_by_user_id,
          published_by_user_id,
          created_at,
          published_at
        from app.legal_work_profile_versions
        where id = $1
          and profile_id = $2
        limit 1
      `,
      [input.versionId, profileId],
    );

    if (!version) {
      throw new AppHttpException(
        'PROFILE_VERSION_NOT_FOUND',
        404,
        'Requested profile version was not found.',
      );
    }

    await this.databaseService.transaction(async (client) => {
      const nextVersion = await this.getNextProfileVersionNumber(profileId);
      const restored = await client.query<{ id: string }>(
        `
          insert into app.legal_work_profile_versions (
            profile_id,
            workspace_id,
            version,
            schema_version,
            status,
            content,
            content_hash,
            change_note,
            created_by_user_id
          )
          values ($1, $2, $3, $4, 'draft', $5::jsonb, $6, $7, $8)
          returning id
        `,
        [
          profileId,
          profile.workspace_id,
          nextVersion,
          version.schema_version,
          JSON.stringify(version.content),
          version.content_hash,
          input.changeNote ?? `Restored from version ${version.version}`,
          actor.id,
        ],
      );

      await client.query(
        `
          update app.legal_work_profiles
          set
            current_version_id = $2,
            status = 'draft',
            updated_by_user_id = $3,
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [profileId, restored.rows[0]!.id, actor.id],
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'profile.restored',
      entityType: 'legal_work_profile',
      entityId: profileId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        sourceVersionId: input.versionId,
      },
    });

    return this.getDetail(access, profileId);
  }

  async previewEffective(
    actor: AuthenticatedActor,
    access: AccessContext,
    profileId: string,
    input: PreviewEffectiveProfileRequest,
    meta: RequestMeta,
  ): Promise<EffectiveProfilePreview> {
    const snapshot = await this.computeEffectiveSnapshot({
      workspaceId: access.activeWorkspace!.id,
      userId: input.userId ?? actor.id,
      requestedProfileId: profileId,
      automationOverrides: input.automationOverrides ?? {},
      previewId: profileId,
    });
    const validation = this.validateProfileContent(snapshot.effectiveContent);

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'profile.snapshot.created',
      entityType: 'effective_profile_snapshot',
      entityId: snapshot.id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        sourceProfileVersionIds: snapshot.sourceProfileVersionIds,
      },
    });

    return {
      previewId: profileId,
      snapshot,
      validation,
    };
  }

  async listVersions(
    profileId: string,
  ): Promise<readonly LegalWorkProfileVersionSummary[]> {
    const result = await this.databaseService.query<ProfileVersionRow>(
      `
        select
          id,
          profile_id,
          version,
          schema_version,
          status,
          content,
          content_hash,
          change_note,
          created_by_user_id,
          published_by_user_id,
          created_at,
          published_at
        from app.legal_work_profile_versions
        where profile_id = $1
        order by version desc
      `,
      [profileId],
    );

    return result.rows.map(mapProfileVersionRow);
  }

  async createEffectiveSnapshotForRun(input: {
    readonly workspaceId: string;
    readonly userId: string | null;
    readonly profileId?: string | null;
    readonly runId?: string | null;
    readonly previewId?: string | null;
    readonly automationOverrides?: Record<string, unknown>;
  }): Promise<EffectiveProfileSnapshotSummary> {
    return this.computeEffectiveSnapshot({
      workspaceId: input.workspaceId,
      userId: input.userId,
      requestedProfileId: input.profileId ?? null,
      runId: input.runId ?? null,
      previewId: input.previewId ?? null,
      automationOverrides: input.automationOverrides ?? {},
    });
  }

  validateProfileContent(
    content: Record<string, unknown>,
  ): ProfileValidationResult {
    const normalizedContent = sortJson(content) as Record<string, unknown>;
    const issues: Array<ProfileValidationResult['issues'][number]> = [];

    if (Object.keys(normalizedContent).length === 0) {
      issues.push({
        code: 'profile_empty',
        path: '$',
        severity: 'warning',
        message: 'Profile content is empty.',
      });
    }

    const lockedPaths = extractLockedPaths(normalizedContent);

    if (lockedPaths.some((entry) => entry.trim().length === 0)) {
      issues.push({
        code: 'invalid_locked_path',
        path: 'meta.lockedPaths',
        severity: 'error',
        message: 'Locked profile paths must be non-empty strings.',
      });
    }

    return {
      ok: !issues.some((issue) => issue.severity === 'error'),
      issues,
      normalizedContent,
    };
  }

  private async computeEffectiveSnapshot(input: {
    readonly workspaceId: string;
    readonly userId: string | null;
    readonly requestedProfileId?: string | null;
    readonly runId?: string | null;
    readonly previewId?: string | null;
    readonly automationOverrides?: Record<string, unknown>;
  }): Promise<EffectiveProfileSnapshotSummary> {
    const candidates = await this.databaseService.query<
      ProfileRow & {
        readonly content: Record<string, unknown> | null;
        readonly version_id: string | null;
      }
    >(
      `
        select
          p.id,
          p.workspace_id,
          p.owner_user_id,
          p.profile_type,
          p.name,
          p.description,
          p.status,
          p.current_version_id,
          p.created_by_user_id,
          p.created_at,
          p.updated_at,
          v.content,
          v.id as version_id
        from app.legal_work_profiles p
        left join app.legal_work_profile_versions v
          on v.id = p.current_version_id
        where p.deleted_at is null
          and (
            p.profile_type = 'system'
            or (p.profile_type = 'workspace' and p.workspace_id = $1)
            or (p.profile_type = 'personal' and p.owner_user_id = $2 and (p.workspace_id = $1 or p.workspace_id is null))
            or p.id = $3
          )
        order by
          case p.profile_type
            when 'system' then 0
            when 'workspace' then 1
            when 'personal' then 2
            else 3
          end,
          p.updated_at asc
      `,
      [input.workspaceId, input.userId, input.requestedProfileId ?? null],
    );

    let merged: Record<string, unknown> = {};
    const sourceProfileVersionIds: string[] = [];

    for (const row of candidates.rows) {
      if (!row.content || !row.version_id) {
        continue;
      }

      const lockedPaths = extractLockedPaths(merged);
      merged = deepMerge(merged, row.content, lockedPaths) as Record<
        string,
        unknown
      >;
      sourceProfileVersionIds.push(row.version_id);
    }

    if (input.automationOverrides) {
      const lockedPaths = extractLockedPaths(merged);
      merged = deepMerge(
        merged,
        input.automationOverrides,
        lockedPaths,
      ) as Record<string, unknown>;
    }

    const normalized = sortJson(merged) as Record<string, unknown>;
    const row = await this.databaseService.one<SnapshotRow>(
      `
        insert into app.effective_profile_snapshots (
          workspace_id,
          user_id,
          source_profile_version_ids,
          effective_content,
          effective_hash,
          created_for_run_id,
          created_for_preview_id
        )
        values ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)
        returning
          id,
          workspace_id,
          user_id,
          source_profile_version_ids,
          effective_content,
          effective_hash,
          created_for_run_id,
          created_for_preview_id,
          created_at
      `,
      [
        input.workspaceId,
        input.userId,
        JSON.stringify(sourceProfileVersionIds),
        JSON.stringify(normalized),
        hashJson(normalized),
        input.runId ?? null,
        input.previewId ?? null,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'PROFILE_SNAPSHOT_CREATE_FAILED',
        500,
        'Failed to create an effective profile snapshot.',
      );
    }

    return mapSnapshotRow(row);
  }

  private async getProfileRow(
    profileId: string,
    workspaceId: string,
  ): Promise<ProfileRow> {
    const row = await this.databaseService.one<ProfileRow>(
      `
        select
          id,
          workspace_id,
          owner_user_id,
          profile_type,
          name,
          description,
          status,
          current_version_id,
          created_by_user_id,
          created_at,
          updated_at
        from app.legal_work_profiles
        where id = $1
          and deleted_at is null
          and (
            workspace_id is null
            or workspace_id = $2
          )
        limit 1
      `,
      [profileId, workspaceId],
    );

    if (!row) {
      throw new AppHttpException(
        'PROFILE_NOT_FOUND',
        404,
        'Legal work profile was not found.',
      );
    }

    return row;
  }

  private async getCurrentVersion(
    profile: ProfileRow,
  ): Promise<ProfileVersionRow | null> {
    if (!profile.current_version_id) {
      return null;
    }

    return this.databaseService.one<ProfileVersionRow>(
      `
        select
          id,
          profile_id,
          version,
          schema_version,
          status,
          content,
          content_hash,
          change_note,
          created_by_user_id,
          published_by_user_id,
          created_at,
          published_at
        from app.legal_work_profile_versions
        where id = $1
        limit 1
      `,
      [profile.current_version_id],
    );
  }

  private async getNextProfileVersionNumber(
    profileId: string,
  ): Promise<number> {
    const row = await this.databaseService.one<{
      readonly next_version: number;
    }>(
      `
        select coalesce(max(version), 0) + 1 as next_version
        from app.legal_work_profile_versions
        where profile_id = $1
      `,
      [profileId],
    );

    return row?.next_version ?? 1;
  }
}

function mapProfileRow(row: ProfileRow): LegalWorkProfileSummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    ownerUserId: row.owner_user_id,
    profileType: row.profile_type,
    name: row.name,
    description: row.description,
    status: row.status,
    currentVersionId: row.current_version_id,
    currentVersionNo: null,
    createdBy: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProfileVersionRow(
  row: ProfileVersionRow,
): LegalWorkProfileVersionSummary {
  return {
    id: row.id,
    profileId: row.profile_id,
    version: row.version,
    schemaVersion: row.schema_version,
    status: row.status,
    content: row.content ?? {},
    contentHash: row.content_hash,
    changeNote: row.change_note,
    createdBy: row.created_by_user_id,
    publishedBy: row.published_by_user_id,
    createdAt: row.created_at,
    publishedAt: row.published_at,
  };
}

function mapSnapshotRow(row: SnapshotRow): EffectiveProfileSnapshotSummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    sourceProfileVersionIds: row.source_profile_version_ids ?? [],
    effectiveContent: row.effective_content ?? {},
    effectiveHash: row.effective_hash,
    createdForRunId: row.created_for_run_id,
    createdForPreviewId: row.created_for_preview_id,
    createdAt: row.created_at,
  };
}
