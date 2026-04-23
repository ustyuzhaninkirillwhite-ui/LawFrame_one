insert into app.permissions (code, label, description, scope, high_risk)
values (
  'dashboard.view',
  'View dashboard',
  'Read dashboard snapshots, notification inbox bootstrap and realtime recovery feeds.',
  'workspace',
  false
)
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description,
  scope = excluded.scope,
  high_risk = excluded.high_risk;

insert into app.role_permissions (role_code, permission_code)
values
  ('owner', 'dashboard.view'),
  ('admin', 'dashboard.view'),
  ('lawyer', 'dashboard.view'),
  ('assistant', 'dashboard.view'),
  ('viewer', 'dashboard.view'),
  ('security_admin', 'dashboard.view')
on conflict (role_code, permission_code) do nothing;

alter table app.notifications
  add column if not exists user_id uuid null references app.profiles(id) on delete set null,
  add column if not exists action_url text null,
  add column if not exists priority text not null default 'normal' check (
    priority in ('low', 'normal', 'high', 'urgent')
  ),
  add column if not exists dedupe_key text null,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists idx_app_notifications_dedupe
  on app.notifications (workspace_id, user_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists idx_app_notifications_user_lookup
  on app.notifications (user_id, read_at, created_at desc);

create index if not exists idx_app_notifications_workspace_user_lookup
  on app.notifications (workspace_id, user_id, created_at desc);

create table if not exists app.notification_preferences (
  id uuid primary key default public.app_uuid_v7(),
  user_id uuid not null references app.profiles(id) on delete cascade,
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  realtime_enabled boolean not null default true,
  quiet_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id)
);

create table if not exists app.device_tokens (
  id uuid primary key default public.app_uuid_v7(),
  user_id uuid not null references app.profiles(id) on delete cascade,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  device_type text not null check (
    device_type in ('web_push', 'ios', 'android')
  ),
  device_token text not null,
  metadata jsonb not null default '{}'::jsonb,
  last_registered_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, device_token)
);

create index if not exists idx_app_device_tokens_workspace
  on app.device_tokens (workspace_id, updated_at desc);

create table if not exists app.realtime_topic_acl (
  id uuid primary key default public.app_uuid_v7(),
  topic text not null unique,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  user_id uuid null references app.profiles(id) on delete cascade,
  run_id uuid null references app.workflow_runs(id) on delete cascade,
  approval_task_id uuid null references app.approval_tasks(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_app_realtime_topic_acl_workspace
  on app.realtime_topic_acl (workspace_id, topic);

create index if not exists idx_app_realtime_topic_acl_user
  on app.realtime_topic_acl (user_id, topic);

create table if not exists app.live_events (
  id uuid primary key default public.app_uuid_v7(),
  sequence_id bigserial not null unique,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  user_id uuid null references app.profiles(id) on delete cascade,
  topic text not null,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  available_at timestamptz not null default timezone('utc', now()),
  published_at timestamptz null,
  status text not null default 'pending' check (
    status in ('pending', 'publishing', 'published', 'failed')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_app_live_events_topic_sequence
  on app.live_events (topic, sequence_id desc);

create index if not exists idx_app_live_events_workspace_sequence
  on app.live_events (workspace_id, sequence_id desc);

create index if not exists idx_app_live_events_user_sequence
  on app.live_events (user_id, sequence_id desc);

create index if not exists idx_app_live_events_status_available
  on app.live_events (status, available_at asc, sequence_id asc);

create or replace function public.sanitize_live_payload(raw_payload jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when raw_payload is null then '{}'::jsonb
    when jsonb_typeof(raw_payload) = 'object' then raw_payload
    else jsonb_build_object('value', raw_payload)
  end;
$$;

alter table app.live_events
  drop constraint if exists live_events_payload_sanitized;

alter table app.live_events
  add constraint live_events_payload_sanitized
  check (payload = public.sanitize_live_payload(payload));

create or replace function public.can_receive_realtime_topic(target_topic text)
returns boolean
language sql
stable
security definer
set search_path = app, public, auth, pg_catalog
as $$
  select exists(
    select 1
    from app.realtime_topic_acl acl
    where acl.topic = target_topic
      and (
        acl.user_id is null
        or acl.user_id = auth.uid()
      )
      and (
        acl.workspace_id is null
        or public.is_workspace_member(acl.workspace_id)
      )
  );
$$;

grant execute on function public.can_receive_realtime_topic(text) to authenticated;

insert into app.realtime_topic_acl (topic, workspace_id)
select
  'workspace:' || w.id::text || ':dashboard',
  w.id
from app.workspaces w
where w.deleted_at is null
on conflict (topic) do update
set
  workspace_id = excluded.workspace_id,
  updated_at = timezone('utc', now());

insert into app.realtime_topic_acl (topic, user_id)
select distinct
  'user:' || wm.auth_user_id::text || ':notifications',
  wm.auth_user_id
from app.workspace_members wm
where wm.status = 'active'
  and wm.deleted_at is null
on conflict (topic) do update
set
  user_id = excluded.user_id,
  updated_at = timezone('utc', now());

insert into app.realtime_topic_acl (topic, workspace_id, run_id)
select
  'run:' || wr.id::text,
  wr.workspace_id,
  wr.id
from app.workflow_runs wr
on conflict (topic) do update
set
  workspace_id = excluded.workspace_id,
  run_id = excluded.run_id,
  updated_at = timezone('utc', now());
