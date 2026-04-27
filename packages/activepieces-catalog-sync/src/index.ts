import type {
  PieceEntryType,
  PieceInventoryEntry,
  PieceInventoryItem,
  PieceInventoryReport,
  PieceRisk,
} from '@lexframe/activepieces-inventory';

export interface CatalogSyncOptions {
  readonly sourceImageTag: string;
  readonly maxEntriesPerPiece?: number;
}

export interface CatalogSyncSummary {
  readonly pieces: number;
  readonly entries: number;
  readonly actions: number;
  readonly triggers: number;
  readonly blockedEntries: number;
  readonly sourceImageTag: string;
}

export function summarizeCatalogSync(
  report: PieceInventoryReport,
  options: CatalogSyncOptions,
): CatalogSyncSummary {
  const entries = buildEntryRecords(report, options);
  return {
    pieces: report.pieces.length,
    entries: entries.length,
    actions: entries.filter((entry) => entry.entryType === 'action').length,
    triggers: entries.filter((entry) => entry.entryType === 'trigger').length,
    blockedEntries: entries.filter((entry) => entry.status === 'blocked')
      .length,
    sourceImageTag: options.sourceImageTag,
  };
}

export function generateCatalogSyncSql(
  report: PieceInventoryReport,
  options: CatalogSyncOptions,
): string {
  const sourceImageTag = options.sourceImageTag;
  const entries = buildEntryRecords(report, options);
  const lines = [
    'begin;',
    "set local search_path = app, public;",
    '',
    markExistingPiecesMissingSql(),
    markExistingEntriesMissingSql(),
    '',
  ];

  for (const piece of report.pieces) {
    lines.push(pieceUpsertSql(piece, sourceImageTag));
  }

  for (const entry of entries) {
    lines.push(entryUpsertSql(entry));
  }

  lines.push('', 'commit;', '');
  return lines.join('\n');
}

interface EntryRecord {
  readonly piece: PieceInventoryItem;
  readonly entry: PieceInventoryEntry;
  readonly entryType: PieceEntryType;
  readonly entryName: string;
  readonly moduleCode: string;
  readonly displayName: string;
  readonly description: string;
  readonly status: 'active' | 'blocked' | 'deprecated' | 'missing';
  readonly availabilityStatus: string;
  readonly gatingReasonCode: string | null;
  readonly gatingHumanReason: string | null;
  readonly requiredConnectionType: string | null;
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  readonly category: string;
  readonly sourceImageTag: string;
}

function buildEntryRecords(
  report: PieceInventoryReport,
  options: CatalogSyncOptions,
): readonly EntryRecord[] {
  const records: EntryRecord[] = [];
  const seenModuleCodes = new Set<string>();
  const seenEntryKeys = new Set<string>();
  for (const piece of report.pieces) {
    const allEntries = [
      ...piece.actionEntries,
      ...piece.triggerEntries,
    ];
    const entries = options.maxEntriesPerPiece
      ? allEntries.slice(0, options.maxEntriesPerPiece)
      : allEntries;

    for (const entry of entries) {
      const policy = policyFor(piece, entry.type);
      const entryName = uniqueEntryName(piece, entry, seenEntryKeys);
      const moduleCode = uniqueModuleCode(
        `ap.${piece.slug}.${entry.type}.${entryName}`,
        seenModuleCodes,
      );

      records.push({
        piece,
        entry,
        entryType: entry.type,
        entryName,
        moduleCode,
        displayName:
          entry.displayName ??
          `${piece.displayName ?? titleize(piece.slug)}: ${titleize(entry.name)}`,
        description:
          entry.description ??
          piece.description ??
          `Activepieces ${entry.type} from ${piece.packageName}.`,
        status: policy.status,
        availabilityStatus: policy.availabilityStatus,
        gatingReasonCode: policy.gatingReasonCode,
        gatingHumanReason: policy.gatingHumanReason,
        requiredConnectionType: policy.requiredConnectionType,
        riskLevel: policy.riskLevel,
        category: categoryFor(piece),
        sourceImageTag: options.sourceImageTag,
      });
    }
  }

  return records;
}

function uniqueEntryName(
  piece: PieceInventoryItem,
  entry: PieceInventoryEntry,
  seenEntryKeys: Set<string>,
) {
  const base = entry.name || entry.type;
  let candidate = base;
  let suffix = 2;
  while (
    seenEntryKeys.has(
      `${piece.packageName}|${piece.packageVersion}|${entry.type}|${candidate}`,
    )
  ) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  seenEntryKeys.add(
    `${piece.packageName}|${piece.packageVersion}|${entry.type}|${candidate}`,
  );
  return candidate;
}

function uniqueModuleCode(base: string, seenModuleCodes: Set<string>) {
  let candidate = base;
  let suffix = 2;
  while (seenModuleCodes.has(candidate)) {
    candidate = `${base}.${suffix}`;
    suffix += 1;
  }
  seenModuleCodes.add(candidate);
  return candidate;
}

function policyFor(piece: PieceInventoryItem, entryType: PieceEntryType) {
  if (entryType === 'trigger') {
    return {
      status: 'blocked' as const,
      availabilityStatus: 'blocked_by_runtime',
      gatingReasonCode: 'ACTIVEPIECES_TRIGGER_IMPORT_READ_ONLY',
      gatingHumanReason:
        'Activepieces trigger is imported for visibility, but Canvas trigger conversion is not enabled yet.',
      requiredConnectionType: null,
      riskLevel: riskLevelFor(piece.risk),
    };
  }

  if (piece.risk === 'blocked_by_default') {
    return {
      status: 'blocked' as const,
      availabilityStatus: 'blocked_by_data_policy',
      gatingReasonCode: 'ACTIVEPIECES_AI_ROUTE_REQUIRES_LEXFRAME_GATEWAY',
      gatingHumanReason:
        'Direct AI provider pieces must be routed through the LexFrame AI Gateway before use.',
      requiredConnectionType: null,
      riskLevel: 'critical' as const,
    };
  }

  if (piece.risk === 'forbidden_in_production') {
    return {
      status: 'blocked' as const,
      availabilityStatus: 'blocked_by_data_policy',
      gatingReasonCode: 'ACTIVEPIECES_PIECE_FORBIDDEN_IN_PRODUCTION',
      gatingHumanReason:
        'This piece can expose privileged runtime or data-plane credentials and is blocked by default.',
      requiredConnectionType: null,
      riskLevel: 'critical' as const,
    };
  }

  if (piece.exposure === 'admin_only' || piece.exposure === 'advanced_users') {
    return {
      status: 'blocked' as const,
      availabilityStatus: 'blocked_by_role',
      gatingReasonCode: 'ACTIVEPIECES_ADVANCED_OR_ADMIN_ONLY',
      gatingHumanReason:
        'This integration requires an advanced/admin review before it can be added to Canvas.',
      requiredConnectionType: null,
      riskLevel: riskLevelFor(piece.risk),
    };
  }

  if (piece.exposure === 'hidden' || piece.exposure === 'blocked') {
    return {
      status: 'blocked' as const,
      availabilityStatus: 'blocked_by_runtime',
      gatingReasonCode: 'ACTIVEPIECES_PIECE_NEEDS_REVIEW',
      gatingHumanReason:
        'This community piece is visible for catalog completeness but needs provider-specific review.',
      requiredConnectionType: null,
      riskLevel: riskLevelFor(piece.risk),
    };
  }

  if (piece.authType !== 'none') {
    return {
      status: 'active' as const,
      availabilityStatus: 'missing_connection',
      gatingReasonCode: 'ACTIVEPIECES_CONNECTION_REQUIRED',
      gatingHumanReason:
        'Configure a workspace-scoped connection before running this Activepieces action.',
      requiredConnectionType: `${piece.slug}:${piece.authType}`,
      riskLevel: riskLevelFor(piece.risk),
    };
  }

  if (piece.exposure === 'approval_required') {
    return {
      status: 'active' as const,
      availabilityStatus: 'available_with_warnings',
      gatingReasonCode: 'ACTIVEPIECES_APPROVAL_RECOMMENDED',
      gatingHumanReason:
        'External delivery actions should be placed after an approval gate.',
      requiredConnectionType: null,
      riskLevel: riskLevelFor(piece.risk),
    };
  }

  return {
    status: 'active' as const,
    availabilityStatus:
      piece.exposure === 'workspace_policy'
        ? 'available_with_warnings'
        : 'available',
    gatingReasonCode:
      piece.exposure === 'workspace_policy'
        ? 'ACTIVEPIECES_WORKSPACE_POLICY_REQUIRED'
        : null,
    gatingHumanReason:
      piece.exposure === 'workspace_policy'
        ? 'Workspace policy should be reviewed before production use.'
        : null,
    requiredConnectionType: null,
    riskLevel: riskLevelFor(piece.risk),
  };
}

function markExistingPiecesMissingSql() {
  return `
update app.activepieces_piece_registry
set
  status = 'missing',
  last_checked_at = timezone('utc', now()),
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('missing_since_last_catalog_sync', true)
where source = 'activepieces_builtin'
  and coalesce(metadata->>'catalog_sync', '') = 'activepieces-catalog-sync';
`.trim();
}

function markExistingEntriesMissingSql() {
  return `
update app.activepieces_action_registry
set
  status = 'missing',
  availability_status = 'blocked_by_runtime',
  gating_reason_code = 'ACTIVEPIECES_SOURCE_MISSING',
  gating_human_reason = 'This Activepieces entry was present in a previous sync but is missing from the current source image.',
  last_checked_at = timezone('utc', now())
where source = 'activepieces_builtin';
`.trim();
}

function pieceUpsertSql(piece: PieceInventoryItem, sourceImageTag: string) {
  return `
insert into app.activepieces_piece_registry (
  piece_name,
  piece_version,
  display_name,
  source,
  actions,
  triggers,
  props_schema,
  status,
  slug,
  kind,
  categories,
  auth_type,
  risk_class,
  exposure,
  import_mode,
  notes,
  source_path,
  source_hash,
  metadata,
  last_checked_at
)
values (
  ${sqlText(piece.packageName)},
  ${sqlText(piece.packageVersion)},
  ${sqlText(piece.displayName ?? titleize(piece.slug))},
  'activepieces_builtin',
  ${sqlJson(piece.actionEntries)},
  ${sqlJson(piece.triggerEntries)},
  '{}'::jsonb,
  'active',
  ${sqlText(piece.slug)},
  ${sqlText(piece.kind)},
  ${sqlJson(piece.categories)},
  ${sqlText(piece.authType)},
  ${sqlText(piece.risk)},
  ${sqlText(piece.exposure)},
  ${sqlText(piece.importMode)},
  ${sqlJson(piece.notes)},
  ${sqlText(piece.path)},
  ${sqlText(piece.sourceHash)},
  ${sqlJson({
    catalog_sync: 'activepieces-catalog-sync',
    source_image_tag: sourceImageTag,
    source_actions_count: piece.actions,
    source_triggers_count: piece.triggers,
  })},
  timezone('utc', now())
)
on conflict (piece_name, piece_version) do update
set
  display_name = excluded.display_name,
  source = excluded.source,
  actions = excluded.actions,
  triggers = excluded.triggers,
  props_schema = excluded.props_schema,
  status = excluded.status,
  slug = excluded.slug,
  kind = excluded.kind,
  categories = excluded.categories,
  auth_type = excluded.auth_type,
  risk_class = excluded.risk_class,
  exposure = excluded.exposure,
  import_mode = excluded.import_mode,
  notes = excluded.notes,
  source_path = excluded.source_path,
  source_hash = excluded.source_hash,
  metadata = excluded.metadata,
  last_checked_at = excluded.last_checked_at;
`.trim();
}

function entryUpsertSql(record: EntryRecord) {
  return `
insert into app.activepieces_action_registry (
  piece_name,
  piece_version,
  entry_type,
  entry_name,
  module_code,
  display_name,
  description,
  source,
  source_path,
  source_hash,
  props_schema,
  status,
  availability_status,
  gating_reason_code,
  gating_human_reason,
  required_connection_type,
  risk_level,
  category,
  source_image_tag,
  metadata,
  last_checked_at
)
values (
  ${sqlText(record.piece.packageName)},
  ${sqlText(record.piece.packageVersion)},
  ${sqlText(record.entryType)},
  ${sqlText(record.entryName)},
  ${sqlText(record.moduleCode)},
  ${sqlText(record.displayName)},
  ${sqlText(record.description)},
  'activepieces_builtin',
  ${sqlText(`${record.piece.path}/${record.entry.sourcePath}`)},
  ${sqlText(record.entry.sourceHash)},
  '{}'::jsonb,
  ${sqlText(record.status)},
  ${sqlText(record.availabilityStatus)},
  ${sqlText(record.gatingReasonCode)},
  ${sqlText(record.gatingHumanReason)},
  ${sqlText(record.requiredConnectionType)},
  ${sqlText(record.riskLevel)},
  ${sqlText(record.category)},
  ${sqlText(record.sourceImageTag)},
  ${sqlJson({
    auth_type: record.piece.authType,
    piece_display_name: record.piece.displayName,
    piece_risk: record.piece.risk,
    piece_exposure: record.piece.exposure,
    piece_import_mode: record.piece.importMode,
    piece_categories: record.piece.categories,
  })},
  timezone('utc', now())
)
on conflict (module_code) do update
set
  piece_name = excluded.piece_name,
  piece_version = excluded.piece_version,
  entry_type = excluded.entry_type,
  entry_name = excluded.entry_name,
  display_name = excluded.display_name,
  description = excluded.description,
  source = excluded.source,
  source_path = excluded.source_path,
  source_hash = excluded.source_hash,
  props_schema = excluded.props_schema,
  status = excluded.status,
  availability_status = excluded.availability_status,
  gating_reason_code = excluded.gating_reason_code,
  gating_human_reason = excluded.gating_human_reason,
  required_connection_type = excluded.required_connection_type,
  risk_level = excluded.risk_level,
  category = excluded.category,
  source_image_tag = excluded.source_image_tag,
  metadata = excluded.metadata,
  last_checked_at = excluded.last_checked_at;
`.trim();
}

function categoryFor(piece: PieceInventoryItem) {
  const first = piece.categories[0];
  if (first) {
    return first.toLowerCase();
  }
  if (piece.exposure === 'approval_required') {
    return 'communication';
  }
  if (piece.exposure === 'workspace_policy') {
    return 'document_or_data';
  }
  if (piece.exposure === 'admin_only' || piece.exposure === 'advanced_users') {
    return 'advanced';
  }
  return piece.kind;
}

function riskLevelFor(
  risk: PieceRisk,
): 'low' | 'medium' | 'high' | 'critical' {
  switch (risk) {
    case 'safe_by_default':
      return 'low';
    case 'safe_with_workspace_policy':
      return 'medium';
    case 'requires_human_approval':
    case 'requires_admin_role':
    case 'advanced_only':
    case 'unknown':
      return 'high';
    case 'blocked_by_default':
    case 'forbidden_in_production':
      return 'critical';
    default:
      return 'high';
  }
}

function titleize(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sqlText(value: string | null | undefined) {
  return value === null || value === undefined
    ? 'null'
    : `'${value.replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown) {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}
