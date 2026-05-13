create table if not exists app.project_web_search_results (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  project_id text not null,
  provider text not null default 'tavily',
  query text not null,
  title text not null,
  url text not null,
  url_hash text not null,
  snippet text not null default '',
  score numeric null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint project_web_search_provider_check check (provider in ('tavily')),
  constraint project_web_search_url_hash_unique unique (workspace_id, project_id, provider, url_hash)
);

create index if not exists idx_project_web_search_project_created
  on app.project_web_search_results (workspace_id, project_id, created_at desc);

create index if not exists idx_project_web_search_project_url_hash
  on app.project_web_search_results (workspace_id, project_id, url_hash);

create index if not exists idx_project_web_search_project_provider
  on app.project_web_search_results (workspace_id, project_id, provider);

alter table app.project_web_search_results enable row level security;

drop policy if exists project_web_search_workspace_select on app.project_web_search_results;
create policy project_web_search_workspace_select on app.project_web_search_results
  for select to authenticated
  using (public.has_workspace_permission(workspace_id, 'chat.view'));

drop policy if exists project_web_search_workspace_manage on app.project_web_search_results;
create policy project_web_search_workspace_manage on app.project_web_search_results
  for all to authenticated
  using (public.has_workspace_permission(workspace_id, 'chat.manage_project_context'))
  with check (public.has_workspace_permission(workspace_id, 'chat.manage_project_context'));

grant select, insert, update, delete on app.project_web_search_results to authenticated;
