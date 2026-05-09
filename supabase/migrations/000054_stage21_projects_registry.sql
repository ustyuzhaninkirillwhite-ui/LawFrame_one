create table if not exists app.projects (
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  id text not null,
  name text not null,
  description text not null default '',
  icon text not null default 'P',
  color text not null default '#3B82F6',
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  owner_user_id uuid null references app.profiles(id) on delete set null,
  created_by uuid null references app.profiles(id) on delete set null,
  updated_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, id),
  constraint projects_name_not_blank check (length(trim(name)) > 0),
  constraint projects_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create index if not exists idx_projects_workspace_updated
  on app.projects (workspace_id, updated_at desc);

insert into app.projects (
  workspace_id,
  id,
  name,
  description,
  icon,
  color,
  status,
  owner_user_id,
  created_by,
  updated_by
)
select
  w.id,
  'project_claim_001',
  coalesce(nullif(w.organization_display_name, ''), w.name, 'LexFrame'),
  'Default LexFrame project for existing Stage 17-21 routes.',
  upper(left(coalesce(nullif(w.organization_display_name, ''), w.name, 'LexFrame'), 1)),
  '#3B82F6',
  'active',
  null,
  null,
  null
from app.workspaces w
on conflict (workspace_id, id) do nothing;
