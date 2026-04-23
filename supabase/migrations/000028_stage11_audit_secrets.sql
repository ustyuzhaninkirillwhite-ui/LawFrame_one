insert into app.permissions (code, label, description, scope, high_risk)
values
  (
    'secret.read_metadata',
    'Read secret inventory metadata',
    'Read secret inventory metadata without exposing secret values.',
    'workspace',
    false
  ),
  (
    'secret.rotate',
    'Rotate secrets',
    'Start, complete or mark secret rotations and compromises.',
    'workspace',
    true
  ),
  (
    'audit.export',
    'Export audit events',
    'Export redacted audit events for investigations and compliance.',
    'audit',
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
  ('owner', 'secret.read_metadata'),
  ('owner', 'secret.rotate'),
  ('owner', 'audit.export'),
  ('security_admin', 'secret.read_metadata'),
  ('security_admin', 'secret.rotate'),
  ('security_admin', 'audit.export')
on conflict (role_code, permission_code) do nothing;

alter table audit.audit_events
  add column if not exists session_id text null references app.user_sessions(id) on delete set null,
  add column if not exists event_category text null,
  add column if not exists data_class text null,
  add column if not exists previous_hash text null,
  add column if not exists event_hash text null,
  add column if not exists redaction_applied boolean not null default false,
  add column if not exists redaction_summary jsonb not null default '{}'::jsonb;

create table if not exists audit.audit_event_anchors (
  id uuid primary key default public.app_uuid_v7(),
  anchor_date date not null unique,
  first_event_id uuid null references audit.audit_events(id) on delete set null,
  last_event_id uuid null references audit.audit_events(id) on delete set null,
  chain_hash text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.secret_inventory (
  id uuid primary key default public.app_uuid_v7(),
  secret_code text not null unique,
  provider text not null,
  status text not null default 'missing' check (status in ('configured', 'missing', 'rotation_due', 'compromised', 'disabled')),
  backend_only boolean not null default true,
  rotation_period_days integer null,
  last_rotated_at timestamptz null,
  next_rotation_due_at timestamptz null,
  used_by text[] not null default '{}'::text[],
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.secret_usage_events (
  id uuid primary key default public.app_uuid_v7(),
  secret_code text not null references app.secret_inventory(secret_code) on delete cascade,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  actor_user_id uuid null references app.profiles(id) on delete set null,
  usage_context text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.secret_rotation_events (
  id uuid primary key default public.app_uuid_v7(),
  secret_code text not null references app.secret_inventory(secret_code) on delete cascade,
  rotation_type text not null,
  started_by uuid null references app.profiles(id) on delete set null,
  completed_by uuid null references app.profiles(id) on delete set null,
  status text not null default 'started' check (status in ('started', 'completed', 'failed', 'compromised')),
  notes text null,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null
);

alter table app.secret_inventory enable row level security;
alter table app.secret_usage_events enable row level security;
alter table app.secret_rotation_events enable row level security;
alter table audit.audit_event_anchors enable row level security;

create policy secret_inventory_select_security_admin
  on app.secret_inventory
  for select
  to authenticated
  using (true);

create policy secret_inventory_update_security_admin
  on app.secret_inventory
  for update
  to authenticated
  using (true)
  with check (true);

create policy secret_usage_events_select_security_admin
  on app.secret_usage_events
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'secret.read_metadata')
  );

create policy secret_rotation_events_select_security_admin
  on app.secret_rotation_events
  for select
  to authenticated
  using (true);

create policy audit_event_anchors_select_audit_export
  on audit.audit_event_anchors
  for select
  to authenticated
  using (true);

grant select, update on app.secret_inventory to authenticated;
grant select on app.secret_usage_events to authenticated;
grant select on app.secret_rotation_events to authenticated;
grant select on audit.audit_event_anchors to authenticated;

create index if not exists idx_audit_audit_events_category_occurred
  on audit.audit_events (event_category, occurred_at desc);

create index if not exists idx_app_secret_inventory_status
  on app.secret_inventory (status, next_rotation_due_at);
