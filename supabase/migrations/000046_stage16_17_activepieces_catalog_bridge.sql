alter table app.activepieces_piece_registry
  add column if not exists slug text null,
  add column if not exists kind text null,
  add column if not exists categories jsonb not null default '[]'::jsonb,
  add column if not exists auth_type text not null default 'unknown',
  add column if not exists risk_class text not null default 'unknown',
  add column if not exists exposure text not null default 'hidden',
  add column if not exists import_mode text not null default 'library_import',
  add column if not exists notes jsonb not null default '[]'::jsonb,
  add column if not exists source_path text null,
  add column if not exists source_hash text null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists app.activepieces_action_registry (
  id uuid primary key default public.app_uuid_v7(),
  piece_name text not null,
  piece_version text not null,
  entry_type text not null check (entry_type in ('action', 'trigger')),
  entry_name text not null,
  module_code text not null unique,
  display_name text not null,
  description text not null,
  source text not null check (
    source in ('lexframe_private', 'activepieces_builtin', 'external')
  ),
  source_path text null,
  source_hash text null,
  props_schema jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (
    status in ('active', 'deprecated', 'blocked', 'missing')
  ),
  availability_status text not null default 'available' check (
    availability_status in (
      'available',
      'available_with_warnings',
      'missing_required_input',
      'missing_connection',
      'missing_profile',
      'missing_template',
      'blocked_by_role',
      'blocked_by_plan',
      'blocked_by_data_policy',
      'blocked_by_runtime',
      'deprecated',
      'retired',
      'incompatible_with_canvas_context'
    )
  ),
  gating_reason_code text null,
  gating_human_reason text null,
  required_connection_type text null,
  risk_level text not null default 'medium' check (
    risk_level in ('low', 'medium', 'high', 'critical')
  ),
  category text not null default 'activepieces',
  source_image_tag text null,
  metadata jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (piece_name, piece_version, entry_type, entry_name)
);

create index if not exists idx_activepieces_action_registry_status
  on app.activepieces_action_registry (status, availability_status, category);

create index if not exists idx_activepieces_action_registry_piece
  on app.activepieces_action_registry (piece_name, piece_version);

create index if not exists idx_activepieces_action_registry_search
  on app.activepieces_action_registry
  using gin (
    to_tsvector(
      'simple',
      coalesce(module_code, '') || ' ' ||
      coalesce(display_name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(piece_name, '')
    )
  );

alter table app.activepieces_action_registry enable row level security;

drop policy if exists activepieces_action_registry_select_member on app.activepieces_action_registry;
create policy activepieces_action_registry_select_member
  on app.activepieces_action_registry
  for select
  to authenticated
  using (true);

drop policy if exists activepieces_action_registry_manage_sync on app.activepieces_action_registry;
create policy activepieces_action_registry_manage_sync
  on app.activepieces_action_registry
  for all
  to authenticated
  using (false)
  with check (false);

grant select, insert, update on app.activepieces_action_registry to authenticated;
