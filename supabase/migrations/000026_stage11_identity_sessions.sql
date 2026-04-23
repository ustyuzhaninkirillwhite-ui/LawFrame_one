insert into app.permissions (code, label, description, scope, high_risk)
values
  (
    'session.read',
    'Read security sessions',
    'Read active and revoked session metadata for the current workspace.',
    'workspace',
    false
  ),
  (
    'session.revoke',
    'Revoke security sessions',
    'Revoke active sessions and force reauthentication.',
    'workspace',
    true
  )
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description,
  scope = excluded.scope,
  high_risk = excluded.high_risk;

insert into app.role_permissions (role_code, permission_code)
values
  ('owner', 'session.read'),
  ('owner', 'session.revoke'),
  ('admin', 'session.read'),
  ('security_admin', 'session.read'),
  ('security_admin', 'session.revoke')
on conflict (role_code, permission_code) do nothing;

create table if not exists app.user_sessions (
  id text primary key,
  user_id uuid not null references app.profiles(id) on delete cascade,
  workspace_id uuid null references app.workspaces(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  ip_hash text null,
  user_agent_hash text null,
  device_label text null,
  auth_provider text null,
  mfa_level text null,
  risk_score numeric not null default 0,
  revoked_at timestamptz null,
  revoked_reason text null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists app.workspace_security_settings (
  workspace_id uuid primary key references app.workspaces(id) on delete cascade,
  require_mfa_for_admins boolean not null default true,
  require_mfa_for_all boolean not null default false,
  allowed_email_domains text[] not null default '{}'::text[],
  sso_required boolean not null default false,
  session_max_age_minutes integer not null default 720 check (session_max_age_minutes > 0),
  idle_timeout_minutes integer not null default 60 check (idle_timeout_minutes > 0),
  allow_personal_api_tokens boolean not null default false,
  ai_sensitive_data_allowed boolean not null default false,
  external_delivery_requires_approval boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.reauth_challenges (
  id uuid primary key default public.app_uuid_v7(),
  user_id uuid not null references app.profiles(id) on delete cascade,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  session_id text null references app.user_sessions(id) on delete set null,
  challenge_type text not null check (challenge_type in ('password', 'mfa', 'sso')),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'expired', 'cancelled')),
  token_hash text null,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  verified_at timestamptz null
);

create table if not exists app.session_risk_signals (
  id uuid primary key default public.app_uuid_v7(),
  session_id text not null references app.user_sessions(id) on delete cascade,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  signal_code text not null,
  risk_delta numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

insert into app.workspace_security_settings (workspace_id)
select w.id
from app.workspaces w
on conflict (workspace_id) do nothing;

create index if not exists idx_app_user_sessions_user_last_seen
  on app.user_sessions (user_id, last_seen_at desc);

create index if not exists idx_app_user_sessions_workspace_last_seen
  on app.user_sessions (workspace_id, last_seen_at desc);

create index if not exists idx_app_user_sessions_revoked
  on app.user_sessions (revoked_at)
  where revoked_at is not null;

create index if not exists idx_app_reauth_challenges_user_status
  on app.reauth_challenges (user_id, status, expires_at desc);

create index if not exists idx_app_session_risk_signals_session_created
  on app.session_risk_signals (session_id, created_at desc);
