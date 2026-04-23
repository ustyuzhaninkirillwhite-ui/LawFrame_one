create table if not exists app.roles (
  code workspace_role primary key,
  label text not null,
  description text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.permissions (
  code text primary key,
  label text not null,
  description text not null,
  scope text not null check (
    scope in (
      'workspace',
      'profile',
      'document',
      'automation',
      'activepieces',
      'recommendation',
      'billing',
      'audit'
    )
  ),
  high_risk boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.role_permissions (
  role_code workspace_role not null references app.roles(code) on delete cascade,
  permission_code text not null references app.permissions(code) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (role_code, permission_code)
);

create table if not exists app.workspaces (
  id uuid primary key default public.app_uuid_v7(),
  slug text not null unique,
  name text not null,
  status text not null default 'active' check (
    status in ('active', 'archived', 'suspended')
  ),
  created_by_user_id uuid null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null
);

create table if not exists app.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text null,
  default_workspace_id uuid null references app.workspaces(id) on delete set null,
  onboarding_status text not null default 'new' check (
    onboarding_status in ('new', 'email_unconfirmed', 'ready')
  ),
  locale text not null default 'ru',
  timezone text not null default 'Europe/Berlin',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null
);

create table if not exists app.workspace_members (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  auth_user_id uuid not null references app.profiles(id) on delete cascade,
  role_code workspace_role not null references app.roles(code),
  status text not null default 'active' check (
    status in ('active', 'removed')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_active_at timestamptz null,
  deleted_at timestamptz null,
  unique (workspace_id, auth_user_id)
);

create table if not exists app.workspace_invitations (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  email text not null,
  role_code workspace_role not null references app.roles(code),
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'revoked', 'expired')
  ),
  invitation_token_hash text not null unique,
  expires_at timestamptz not null,
  created_by_user_id uuid not null references app.profiles(id) on delete cascade,
  accepted_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null
);

create table if not exists audit.audit_events (
  id uuid primary key default public.app_uuid_v7(),
  occurred_at timestamptz not null default timezone('utc', now()),
  actor_user_id uuid null references app.profiles(id) on delete set null,
  actor_email text null,
  workspace_id uuid null references app.workspaces(id) on delete set null,
  action text not null,
  entity_type text null,
  entity_id text null,
  result text not null check (
    result in ('success', 'denied', 'error')
  ),
  reason_code text null,
  request_id text null,
  trace_id text null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_app_profiles_default_workspace
  on app.profiles (default_workspace_id)
  where deleted_at is null;

create index if not exists idx_app_workspace_members_user_workspace
  on app.workspace_members (auth_user_id, workspace_id)
  where deleted_at is null;

create index if not exists idx_app_workspace_members_workspace_role
  on app.workspace_members (workspace_id, role_code)
  where deleted_at is null;

create index if not exists idx_app_workspace_invitations_workspace_status
  on app.workspace_invitations (workspace_id, status)
  where deleted_at is null;

create index if not exists idx_app_workspace_invitations_email
  on app.workspace_invitations (email)
  where deleted_at is null;

create index if not exists idx_app_permissions_scope
  on app.permissions (scope);

create index if not exists idx_audit_audit_events_workspace_occurred
  on audit.audit_events (workspace_id, occurred_at desc);
