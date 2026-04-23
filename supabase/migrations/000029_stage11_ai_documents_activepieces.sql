insert into app.permissions (code, label, description, scope, high_risk)
values
  (
    'ai.policy.read',
    'Read AI provider policies',
    'Read AI provider routes, data class and redaction policies.',
    'ai',
    false
  ),
  (
    'ai.policy.manage',
    'Manage AI provider policies',
    'Update AI routes, ZDR settings and redaction policies.',
    'ai',
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
  ('owner', 'ai.policy.read'),
  ('owner', 'ai.policy.manage'),
  ('security_admin', 'ai.policy.read'),
  ('security_admin', 'ai.policy.manage'),
  ('admin', 'ai.policy.read')
on conflict (role_code, permission_code) do nothing;

create table if not exists app.ai_provider_policies (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  provider text not null,
  model text not null,
  allowed_data_classes text[] not null default '{}'::text[],
  requires_zdr boolean not null default false,
  requires_redaction boolean not null default false,
  store_prompts boolean not null default false,
  max_tokens integer null,
  monthly_budget_cents integer null,
  enabled boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.document_security_labels (
  document_id uuid primary key references app.documents(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  data_class text not null,
  contains_legal_secret boolean not null default false,
  contains_personal_data boolean not null default false,
  download_requires_reason boolean not null default false,
  incident_locked boolean not null default false,
  retention_policy_id uuid null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.activepieces_workspace_security (
  workspace_id uuid primary key references app.workspaces(id) on delete cascade,
  builder_admin_allowed boolean not null default false,
  sandbox_required boolean not null default true,
  event_streaming_enabled boolean not null default false,
  signing_key_configured boolean not null default false,
  token_ttl_seconds integer not null default 300 check (token_ttl_seconds > 0),
  pieces_filter_type text not null default 'allowlist',
  pieces_tags text[] not null default '{}'::text[],
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.document_requires_download_reason(target_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, auth, pg_catalog
as $$
  select coalesce(l.download_requires_reason, false)
  from app.document_security_labels l
  where l.document_id = target_document_id
  limit 1;
$$;

grant execute on function public.document_requires_download_reason(uuid) to authenticated;

insert into app.document_security_labels (
  document_id,
  workspace_id,
  data_class,
  contains_legal_secret,
  contains_personal_data,
  download_requires_reason
)
select
  d.id,
  d.workspace_id,
  d.classification,
  (d.classification = 'legal_secret'),
  (d.classification = 'personal_data'),
  (d.classification in ('legal_secret', 'personal_data', 'client_material'))
from app.documents d
on conflict (document_id) do update
set
  workspace_id = excluded.workspace_id,
  data_class = excluded.data_class,
  contains_legal_secret = excluded.contains_legal_secret,
  contains_personal_data = excluded.contains_personal_data,
  download_requires_reason = excluded.download_requires_reason,
  updated_at = timezone('utc', now());

insert into app.activepieces_workspace_security (workspace_id)
select id from app.workspaces
on conflict (workspace_id) do nothing;

alter table app.ai_provider_policies enable row level security;
alter table app.document_security_labels enable row level security;
alter table app.activepieces_workspace_security enable row level security;

create policy ai_provider_policies_select
  on app.ai_provider_policies
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'ai.policy.read')
  );

create policy ai_provider_policies_manage
  on app.ai_provider_policies
  for all
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'ai.policy.manage')
  )
  with check (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'ai.policy.manage')
  );

create policy document_security_labels_select_member
  on app.document_security_labels
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy activepieces_workspace_security_select_member
  on app.activepieces_workspace_security
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy activepieces_workspace_security_manage_admin
  on app.activepieces_workspace_security
  for update
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'workspace.security.manage'))
  with check (public.has_workspace_permission(workspace_id, 'workspace.security.manage'));

grant select, insert, update, delete on app.ai_provider_policies to authenticated;
grant select on app.document_security_labels to authenticated;
grant select, update on app.activepieces_workspace_security to authenticated;

create index if not exists idx_app_ai_provider_policies_workspace_provider
  on app.ai_provider_policies (workspace_id, provider, enabled);

create index if not exists idx_app_document_security_labels_workspace_class
  on app.document_security_labels (workspace_id, data_class, download_requires_reason);
