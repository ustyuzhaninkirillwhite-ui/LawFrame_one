insert into app.permissions (code, label, description, scope, high_risk)
values
  (
    'incident.read',
    'Read security incidents',
    'Read security alerts and incidents.',
    'workspace',
    false
  ),
  (
    'incident.manage',
    'Manage security incidents',
    'Acknowledge alerts, contain incidents and update incident mode.',
    'workspace',
    true
  ),
  (
    'compliance.read',
    'Read compliance registry',
    'Read processing activities, consent registry and DSRs.',
    'workspace',
    false
  ),
  (
    'compliance.manage',
    'Manage compliance registry',
    'Update processing activities, retention policies and DSR workflows.',
    'workspace',
    true
  ),
  (
    'access_review.manage',
    'Manage access reviews',
    'Create and close access review campaigns and review items.',
    'workspace',
    true
  ),
  (
    'support.bundle.create',
    'Create support bundles',
    'Create redacted support bundles for admins and incidents.',
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
  ('owner', 'incident.read'),
  ('owner', 'incident.manage'),
  ('owner', 'compliance.read'),
  ('owner', 'compliance.manage'),
  ('owner', 'access_review.manage'),
  ('owner', 'support.bundle.create'),
  ('security_admin', 'incident.read'),
  ('security_admin', 'incident.manage'),
  ('security_admin', 'compliance.read'),
  ('security_admin', 'compliance.manage'),
  ('security_admin', 'access_review.manage'),
  ('security_admin', 'support.bundle.create'),
  ('admin', 'incident.read'),
  ('admin', 'compliance.read')
on conflict (role_code, permission_code) do nothing;

create table if not exists app.retention_policies (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  code text not null,
  label text not null,
  retention_days integer not null check (retention_days > 0),
  legal_hold_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, code)
);

create table if not exists app.processing_activities (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  activity_code text not null,
  purpose text not null,
  legal_basis text null,
  data_categories text[] not null default '{}'::text[],
  recipient_categories text[] not null default '{}'::text[],
  retention_policy_id uuid null references app.retention_policies(id) on delete set null,
  owner_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.consent_records (
  id uuid primary key default public.app_uuid_v7(),
  user_id uuid not null references app.profiles(id) on delete cascade,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  consent_code text not null,
  granted boolean not null default false,
  granted_at timestamptz null,
  revoked_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, workspace_id, consent_code)
);

create table if not exists app.dsr_requests (
  id uuid primary key default public.app_uuid_v7(),
  user_id uuid null references app.profiles(id) on delete set null,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  request_type text not null check (request_type in ('export', 'delete', 'access', 'rectification')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'rejected', 'cancelled')),
  created_by uuid null references app.profiles(id) on delete set null,
  assigned_to uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.security_alert_rules (
  id uuid primary key default public.app_uuid_v7(),
  rule_code text not null unique,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null,
  description text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.security_alerts (
  id uuid primary key default public.app_uuid_v7(),
  rule_id uuid null references app.security_alert_rules(id) on delete set null,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  entity_type text null,
  entity_id text null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  title text not null,
  description text not null,
  created_at timestamptz not null default timezone('utc', now()),
  acknowledged_at timestamptz null,
  resolved_at timestamptz null
);

create table if not exists app.security_incidents (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  title text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'contained', 'resolved', 'closed')),
  incident_mode_enabled boolean not null default false,
  created_by uuid null references app.profiles(id) on delete set null,
  assigned_to uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.access_review_campaigns (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  created_by uuid null references app.profiles(id) on delete set null,
  due_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.access_review_items (
  id uuid primary key default public.app_uuid_v7(),
  campaign_id uuid not null references app.access_review_campaigns(id) on delete cascade,
  subject_user_id uuid not null references app.profiles(id) on delete cascade,
  role_code workspace_role null references app.roles(code),
  decision text null check (decision in ('keep', 'revoke', 'escalate')),
  reviewed_by uuid null references app.profiles(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.support_bundle_jobs (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  include_audit boolean not null default true,
  created_by uuid null references app.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.is_incident_locked(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, auth, pg_catalog
as $$
  select exists(
    select 1
    from app.security_incidents i
    where i.workspace_id = target_workspace_id
      and i.incident_mode_enabled = true
      and i.status in ('open', 'contained')
  );
$$;

grant execute on function public.is_incident_locked(uuid) to authenticated;

alter table app.retention_policies enable row level security;
alter table app.processing_activities enable row level security;
alter table app.consent_records enable row level security;
alter table app.dsr_requests enable row level security;
alter table app.security_alert_rules enable row level security;
alter table app.security_alerts enable row level security;
alter table app.security_incidents enable row level security;
alter table app.access_review_campaigns enable row level security;
alter table app.access_review_items enable row level security;
alter table app.support_bundle_jobs enable row level security;

create policy compliance_workspace_select
  on app.processing_activities
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'compliance.read')
  );

create policy compliance_workspace_manage
  on app.processing_activities
  for all
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'compliance.manage')
  )
  with check (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'compliance.manage')
  );

create policy retention_policies_select
  on app.retention_policies
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'compliance.read')
  );

create policy retention_policies_manage
  on app.retention_policies
  for all
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'compliance.manage')
  )
  with check (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'compliance.manage')
  );

create policy consent_records_select_owner_or_compliance
  on app.consent_records
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'compliance.read')
    )
  );

create policy consent_records_update_owner_or_compliance
  on app.consent_records
  for all
  to authenticated
  using (
    user_id = auth.uid()
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'compliance.manage')
    )
  )
  with check (
    user_id = auth.uid()
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'compliance.manage')
    )
  );

create policy dsr_requests_select
  on app.dsr_requests
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'compliance.read')
    )
  );

create policy dsr_requests_manage
  on app.dsr_requests
  for all
  to authenticated
  using (
    user_id = auth.uid()
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'compliance.manage')
    )
  )
  with check (
    user_id = auth.uid()
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'compliance.manage')
    )
  );

create policy security_alert_rules_select
  on app.security_alert_rules
  for select
  to authenticated
  using (true);

create policy security_alerts_select
  on app.security_alerts
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'incident.read')
  );

create policy security_alerts_manage
  on app.security_alerts
  for update
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'incident.manage')
  )
  with check (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'incident.manage')
  );

create policy security_incidents_select
  on app.security_incidents
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'incident.read')
  );

create policy security_incidents_manage
  on app.security_incidents
  for all
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'incident.manage')
  )
  with check (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'incident.manage')
  );

create policy access_review_campaigns_select
  on app.access_review_campaigns
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'access_review.manage'));

create policy access_review_campaigns_manage
  on app.access_review_campaigns
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'access_review.manage'))
  with check (public.has_workspace_permission(workspace_id, 'access_review.manage'));

create policy access_review_items_select
  on app.access_review_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from app.access_review_campaigns c
      where c.id = campaign_id
        and public.has_workspace_permission(c.workspace_id, 'access_review.manage')
    )
  );

create policy access_review_items_manage
  on app.access_review_items
  for all
  to authenticated
  using (
    exists (
      select 1
      from app.access_review_campaigns c
      where c.id = campaign_id
        and public.has_workspace_permission(c.workspace_id, 'access_review.manage')
    )
  )
  with check (
    exists (
      select 1
      from app.access_review_campaigns c
      where c.id = campaign_id
        and public.has_workspace_permission(c.workspace_id, 'access_review.manage')
    )
  );

create policy support_bundle_jobs_select
  on app.support_bundle_jobs
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'support.bundle.create')
  );

create policy support_bundle_jobs_manage
  on app.support_bundle_jobs
  for all
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'support.bundle.create')
  )
  with check (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'support.bundle.create')
  );

grant select, insert, update, delete on app.retention_policies to authenticated;
grant select, insert, update, delete on app.processing_activities to authenticated;
grant select, insert, update, delete on app.consent_records to authenticated;
grant select, insert, update, delete on app.dsr_requests to authenticated;
grant select on app.security_alert_rules to authenticated;
grant select, update on app.security_alerts to authenticated;
grant select, insert, update, delete on app.security_incidents to authenticated;
grant select, insert, update, delete on app.access_review_campaigns to authenticated;
grant select, insert, update, delete on app.access_review_items to authenticated;
grant select, insert, update, delete on app.support_bundle_jobs to authenticated;
