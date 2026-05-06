-- Stage 19: Chats, Projects & Legal Knowledge Workspace
-- LexFrame product DB is the source of truth for chat state, context, policy and audit.

insert into app.permissions (code, label, description, category, elevated)
values
  ('chat.view', 'View chats', 'View workspace and project chat threads.', 'chat', false),
  ('chat.create', 'Create chats', 'Create chat threads and messages.', 'chat', false),
  ('chat.edit', 'Edit chats', 'Edit chat threads, messages and stream state.', 'chat', false),
  ('chat.delete', 'Delete chats', 'Delete or redact chat threads.', 'chat', true),
  ('chat.export', 'Export chats', 'Export chat thread content.', 'chat', true),
  ('chat.search', 'Search chats', 'Search chat threads and safe snippets.', 'chat', false),
  ('chat.manage_project_context', 'Manage project chat context', 'Manage project knowledge and chat context items.', 'chat', true),
  ('chat.attach_document', 'Attach documents to chat', 'Attach permitted document versions and legal sources to chat.', 'chat', false),
  ('chat.view_route_snapshot', 'View chat route snapshot', 'View AI route diagnostics without secrets.', 'chat', true),
  ('chat.view_raw_data', 'View raw chat data', 'View raw classified chat content when policy allows.', 'chat', true),
  ('chat.use_legal_secret_context', 'Use legal secret chat context', 'Use legal-secret references through approved context policy.', 'chat', true),
  ('prompt_template.manage', 'Manage prompt templates', 'Manage legal prompt templates.', 'chat', true),
  ('legal_skill.manage', 'Manage legal skills', 'Manage non-executable legal SOP skills.', 'chat', true)
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  elevated = excluded.elevated;

insert into app.role_permissions (role_code, permission_code)
select role_code::workspace_role, permission_code
from (
  values
    ('owner', 'chat.view'),
    ('owner', 'chat.create'),
    ('owner', 'chat.edit'),
    ('owner', 'chat.delete'),
    ('owner', 'chat.export'),
    ('owner', 'chat.search'),
    ('owner', 'chat.manage_project_context'),
    ('owner', 'chat.attach_document'),
    ('owner', 'chat.view_route_snapshot'),
    ('owner', 'chat.view_raw_data'),
    ('owner', 'chat.use_legal_secret_context'),
    ('owner', 'prompt_template.manage'),
    ('owner', 'legal_skill.manage'),
    ('admin', 'chat.view'),
    ('admin', 'chat.create'),
    ('admin', 'chat.edit'),
    ('admin', 'chat.delete'),
    ('admin', 'chat.export'),
    ('admin', 'chat.search'),
    ('admin', 'chat.manage_project_context'),
    ('admin', 'chat.attach_document'),
    ('admin', 'chat.view_route_snapshot'),
    ('admin', 'prompt_template.manage'),
    ('admin', 'legal_skill.manage'),
    ('lawyer', 'chat.view'),
    ('lawyer', 'chat.create'),
    ('lawyer', 'chat.edit'),
    ('lawyer', 'chat.export'),
    ('lawyer', 'chat.search'),
    ('lawyer', 'chat.attach_document'),
    ('assistant', 'chat.view'),
    ('assistant', 'chat.create'),
    ('assistant', 'chat.edit'),
    ('assistant', 'chat.search'),
    ('assistant', 'chat.attach_document'),
    ('viewer', 'chat.view'),
    ('viewer', 'chat.search')
) as grants(role_code, permission_code)
on conflict (role_code, permission_code) do nothing;

create table if not exists app.chat_threads (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  project_id text null,
  kind text not null check (kind in ('general', 'project', 'document_review', 'automation_builder', 'run_support')),
  visibility text not null default 'project' check (visibility in ('private', 'workspace', 'project')),
  status text not null default 'active' check (status in ('active', 'archived', 'deleted')),
  title text not null,
  last_message_preview text null,
  current_branch_id uuid null,
  created_by uuid null references app.profiles(id) on delete set null,
  updated_by uuid null references app.profiles(id) on delete set null,
  trace_id text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz null,
  deleted_at timestamptz null
);

create table if not exists app.chat_thread_members (
  id uuid primary key default public.app_uuid_v7(),
  thread_id uuid not null references app.chat_threads(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  user_id uuid not null references app.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member', 'viewer')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (thread_id, user_id)
);

create table if not exists app.chat_messages (
  id uuid primary key default public.app_uuid_v7(),
  thread_id uuid not null references app.chat_threads(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  project_id text null,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  status text not null check (status in ('pending', 'streaming', 'completed', 'failed', 'cancelled', 'redacted')),
  parent_message_id uuid null references app.chat_messages(id) on delete set null,
  created_by uuid null references app.profiles(id) on delete set null,
  request_id text null,
  trace_id text null,
  classification text not null default 'internal',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.chat_message_parts (
  id uuid primary key default public.app_uuid_v7(),
  message_id uuid not null references app.chat_messages(id) on delete cascade,
  thread_id uuid not null references app.chat_threads(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  type text not null check (type in ('text', 'markdown', 'attachment_ref', 'document_ref', 'legal_source_ref', 'tool_call', 'tool_result', 'evidence', 'route_snapshot', 'error', 'citation', 'context_summary')),
  text text null,
  payload jsonb not null default '{}'::jsonb,
  sequence integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.chat_message_attachments (
  id uuid primary key default public.app_uuid_v7(),
  message_id uuid null references app.chat_messages(id) on delete cascade,
  thread_id uuid not null references app.chat_threads(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  project_id text null,
  source_type text not null check (source_type in ('document_version', 'legal_source', 'automation_snapshot', 'run_artifact', 'chat_summary', 'manual_note', 'profile_snapshot')),
  source_id text not null,
  mode text not null check (mode in ('thread_attachment', 'project_knowledge', 'workspace_knowledge', 'full_context', 'focused_rag', 'summary_only', 'reference_only')),
  classification text not null,
  citation_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.chat_message_tool_calls (
  id uuid primary key default public.app_uuid_v7(),
  message_id uuid not null references app.chat_messages(id) on delete cascade,
  thread_id uuid not null references app.chat_threads(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  tool_name text not null,
  status text not null check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  args_redacted jsonb not null default '{}'::jsonb,
  result_redacted jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.chat_thread_branches (
  id uuid primary key default public.app_uuid_v7(),
  parent_thread_id uuid not null references app.chat_threads(id) on delete cascade,
  source_message_id uuid null references app.chat_messages(id) on delete set null,
  branch_thread_id uuid not null references app.chat_threads(id) on delete cascade,
  branch_mode text not null,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  project_id text null,
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.chat_stream_jobs (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  thread_id uuid not null references app.chat_threads(id) on delete cascade,
  message_id uuid null references app.chat_messages(id) on delete set null,
  status text not null check (status in ('started', 'completed', 'failed', 'cancelled')),
  trace_id text not null,
  request_id text null,
  gateway_evidence_hash text null,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null
);

create table if not exists app.chat_stream_events (
  id uuid primary key default public.app_uuid_v7(),
  stream_job_id uuid not null references app.chat_stream_jobs(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  thread_id uuid not null references app.chat_threads(id) on delete cascade,
  event_type text not null check (event_type in ('message_start', 'text_delta', 'tool_call_start', 'tool_call_delta', 'tool_result', 'usage', 'route_snapshot', 'evidence', 'error', 'message_done')),
  payload jsonb not null default '{}'::jsonb,
  sequence integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.chat_context_items (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  project_id text null,
  thread_id uuid null references app.chat_threads(id) on delete cascade,
  message_id uuid null references app.chat_messages(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  mode text not null,
  classification text not null,
  policy_decision text not null,
  result_hash text null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.chat_search_index (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  project_id text null,
  thread_id uuid not null references app.chat_threads(id) on delete cascade,
  message_id uuid null references app.chat_messages(id) on delete cascade,
  classification text null,
  safe_text text not null,
  search_vector tsvector generated always as (to_tsvector('simple', safe_text)) stored,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.chat_exports (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  thread_id uuid not null references app.chat_threads(id) on delete cascade,
  format text not null default 'json',
  status text not null default 'created',
  content_hash text null,
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.project_knowledge_items (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  project_id text not null,
  source_type text not null,
  source_id text not null,
  mode text not null,
  classification text not null,
  pinned boolean not null default false,
  enabled_for_chat boolean not null default true,
  citation_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.project_instructions (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  project_id text not null,
  version text not null,
  markdown_instructions text not null,
  enabled boolean not null default true,
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.legal_prompt_templates (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  project_id text null,
  command text not null,
  title text not null,
  scope text not null check (scope in ('product', 'workspace', 'project', 'user')),
  variables jsonb not null default '[]'::jsonb,
  output_mode text not null,
  template_markdown text not null,
  version text not null default '1',
  enabled boolean not null default true,
  access_policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.legal_skills (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  project_id text null,
  title text not null,
  scope text not null check (scope in ('product', 'workspace', 'project', 'user')),
  kind text not null,
  markdown_instructions text not null,
  version text not null default '1',
  enabled boolean not null default true,
  access_policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.legal_memory_items (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  project_id text null,
  source_message_id uuid null references app.chat_messages(id) on delete set null,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'disabled')),
  summary text not null,
  summary_hash text null,
  created_by uuid null references app.profiles(id) on delete set null,
  approved_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  approved_at timestamptz null
);

create index if not exists idx_chat_threads_workspace_project
  on app.chat_threads (workspace_id, project_id, status, updated_at desc);
create index if not exists idx_chat_messages_thread
  on app.chat_messages (thread_id, created_at);
create index if not exists idx_chat_message_parts_message
  on app.chat_message_parts (message_id, sequence);
create index if not exists idx_chat_stream_jobs_thread
  on app.chat_stream_jobs (workspace_id, thread_id, status, created_at desc);
create index if not exists idx_chat_stream_events_job
  on app.chat_stream_events (stream_job_id, sequence);
create index if not exists idx_chat_search_vector
  on app.chat_search_index using gin (search_vector);
create index if not exists idx_project_knowledge_project
  on app.project_knowledge_items (workspace_id, project_id, enabled_for_chat, updated_at desc);

alter table app.chat_threads enable row level security;
alter table app.chat_thread_members enable row level security;
alter table app.chat_messages enable row level security;
alter table app.chat_message_parts enable row level security;
alter table app.chat_message_attachments enable row level security;
alter table app.chat_message_tool_calls enable row level security;
alter table app.chat_thread_branches enable row level security;
alter table app.chat_stream_jobs enable row level security;
alter table app.chat_stream_events enable row level security;
alter table app.chat_context_items enable row level security;
alter table app.chat_search_index enable row level security;
alter table app.chat_exports enable row level security;
alter table app.project_knowledge_items enable row level security;
alter table app.project_instructions enable row level security;
alter table app.legal_prompt_templates enable row level security;
alter table app.legal_skills enable row level security;
alter table app.legal_memory_items enable row level security;

drop policy if exists chat_threads_member_select on app.chat_threads;
create policy chat_threads_member_select on app.chat_threads
  for select to authenticated
  using (public.has_workspace_permission(workspace_id, 'chat.view'));
drop policy if exists chat_threads_member_insert on app.chat_threads;
create policy chat_threads_member_insert on app.chat_threads
  for insert to authenticated
  with check (public.has_workspace_permission(workspace_id, 'chat.create'));
drop policy if exists chat_threads_member_update on app.chat_threads;
create policy chat_threads_member_update on app.chat_threads
  for update to authenticated
  using (public.has_workspace_permission(workspace_id, 'chat.edit'))
  with check (public.has_workspace_permission(workspace_id, 'chat.edit'));

drop policy if exists chat_workspace_select on app.chat_messages;
create policy chat_workspace_select on app.chat_messages
  for select to authenticated
  using (public.has_workspace_permission(workspace_id, 'chat.view'));
drop policy if exists chat_workspace_insert on app.chat_messages;
create policy chat_workspace_insert on app.chat_messages
  for insert to authenticated
  with check (public.has_workspace_permission(workspace_id, 'chat.create'));

drop policy if exists chat_parts_workspace_select on app.chat_message_parts;
create policy chat_parts_workspace_select on app.chat_message_parts
  for select to authenticated
  using (public.has_workspace_permission(workspace_id, 'chat.view'));
drop policy if exists chat_parts_workspace_insert on app.chat_message_parts;
create policy chat_parts_workspace_insert on app.chat_message_parts
  for insert to authenticated
  with check (public.has_workspace_permission(workspace_id, 'chat.create'));

drop policy if exists project_knowledge_workspace_select on app.project_knowledge_items;
create policy project_knowledge_workspace_select on app.project_knowledge_items
  for select to authenticated
  using (public.has_workspace_permission(workspace_id, 'chat.view'));
drop policy if exists project_knowledge_workspace_manage on app.project_knowledge_items;
create policy project_knowledge_workspace_manage on app.project_knowledge_items
  for all to authenticated
  using (public.has_workspace_permission(workspace_id, 'chat.manage_project_context'))
  with check (public.has_workspace_permission(workspace_id, 'chat.manage_project_context'));

grant select, insert, update on
  app.chat_threads,
  app.chat_thread_members,
  app.chat_messages,
  app.chat_message_parts,
  app.chat_message_attachments,
  app.chat_message_tool_calls,
  app.chat_thread_branches,
  app.chat_stream_jobs,
  app.chat_stream_events,
  app.chat_context_items,
  app.chat_search_index,
  app.chat_exports,
  app.project_knowledge_items,
  app.project_instructions,
  app.legal_prompt_templates,
  app.legal_skills,
  app.legal_memory_items
to authenticated;
