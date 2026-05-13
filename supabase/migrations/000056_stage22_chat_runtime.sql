-- Stage 22: chat runtime recovery, message branches and private attachments.
-- Forward-only extension of the Stage 19 chat schema.

insert into storage.buckets (id, name, public)
values ('chat-attachments-private', 'chat-attachments-private', false)
on conflict (id) do update
set public = false;

create table if not exists app.chat_branches (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  thread_id uuid not null references app.chat_threads(id) on delete cascade,
  parent_branch_id uuid null references app.chat_branches(id) on delete set null,
  source_message_id uuid null references app.chat_messages(id) on delete set null,
  title text null,
  ordinal integer not null default 1 check (ordinal > 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (thread_id, ordinal)
);

alter table app.chat_messages
  add column if not exists client_message_id text null,
  add column if not exists branch_id uuid null,
  add column if not exists run_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_messages_branch_id_fkey'
      and conrelid = 'app.chat_messages'::regclass
  ) then
    alter table app.chat_messages
      add constraint chat_messages_branch_id_fkey
      foreign key (branch_id)
      references app.chat_branches(id)
      on delete set null;
  end if;
end $$;

alter table app.chat_stream_jobs
  add column if not exists assistant_message_id uuid null references app.chat_messages(id) on delete set null,
  add column if not exists client_message_id text null,
  add column if not exists error_code text null,
  add column if not exists error_message text null,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table app.chat_stream_jobs
  drop constraint if exists chat_stream_jobs_status_check;
alter table app.chat_stream_jobs
  add constraint chat_stream_jobs_status_check
  check (status in ('started', 'queued', 'thinking', 'streaming', 'completed', 'failed', 'cancelled'));

alter table app.chat_stream_events
  drop constraint if exists chat_stream_events_event_type_check;
alter table app.chat_stream_events
  add constraint chat_stream_events_event_type_check
  check (event_type in ('message_start', 'run_status', 'text_delta', 'tool_call_start', 'tool_call_delta', 'tool_result', 'usage', 'route_snapshot', 'evidence', 'error', 'message_done'));

create table if not exists app.chat_attachments (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  thread_id uuid not null references app.chat_threads(id) on delete cascade,
  message_id uuid null references app.chat_messages(id) on delete set null,
  run_id uuid null references app.chat_stream_jobs(id) on delete set null,
  uploaded_by uuid null references app.profiles(id) on delete set null,
  original_filename text not null,
  safe_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text null,
  storage_bucket text not null default 'chat-attachments-private',
  storage_path text not null,
  status text not null default 'pending_upload' check (status in ('pending_upload', 'uploaded', 'attached', 'deleted', 'failed')),
  validation_error text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null,
  deleted_at timestamptz null,
  unique (storage_bucket, storage_path)
);

create index if not exists idx_chat_branches_thread
  on app.chat_branches (workspace_id, thread_id, status, ordinal);
create index if not exists idx_chat_messages_branch
  on app.chat_messages (workspace_id, thread_id, branch_id, created_at);
create index if not exists idx_chat_messages_client_message
  on app.chat_messages (workspace_id, thread_id, client_message_id)
  where client_message_id is not null;
create index if not exists idx_chat_stream_jobs_recovery
  on app.chat_stream_jobs (workspace_id, thread_id, status, updated_at desc);
create index if not exists idx_chat_attachments_workspace
  on app.chat_attachments (workspace_id, created_at desc);
create index if not exists idx_chat_attachments_thread
  on app.chat_attachments (workspace_id, thread_id, created_at desc);
create index if not exists idx_chat_attachments_message
  on app.chat_attachments (workspace_id, message_id)
  where message_id is not null;
create index if not exists idx_chat_attachments_run
  on app.chat_attachments (workspace_id, run_id)
  where run_id is not null;

alter table app.chat_branches enable row level security;
alter table app.chat_attachments enable row level security;

drop policy if exists chat_branches_workspace_select on app.chat_branches;
create policy chat_branches_workspace_select on app.chat_branches
  for select to authenticated
  using (public.has_workspace_permission(workspace_id, 'chat.view'));
drop policy if exists chat_branches_workspace_insert on app.chat_branches;
create policy chat_branches_workspace_insert on app.chat_branches
  for insert to authenticated
  with check (public.has_workspace_permission(workspace_id, 'chat.create'));
drop policy if exists chat_branches_workspace_update on app.chat_branches;
create policy chat_branches_workspace_update on app.chat_branches
  for update to authenticated
  using (public.has_workspace_permission(workspace_id, 'chat.edit'))
  with check (public.has_workspace_permission(workspace_id, 'chat.edit'));

drop policy if exists chat_attachments_workspace_select on app.chat_attachments;
create policy chat_attachments_workspace_select on app.chat_attachments
  for select to authenticated
  using (public.has_workspace_permission(workspace_id, 'chat.view'));
drop policy if exists chat_attachments_workspace_insert on app.chat_attachments;
create policy chat_attachments_workspace_insert on app.chat_attachments
  for insert to authenticated
  with check (public.has_workspace_permission(workspace_id, 'chat.create'));
drop policy if exists chat_attachments_workspace_update on app.chat_attachments;
create policy chat_attachments_workspace_update on app.chat_attachments
  for update to authenticated
  using (public.has_workspace_permission(workspace_id, 'chat.edit') or public.has_workspace_permission(workspace_id, 'chat.create'))
  with check (public.has_workspace_permission(workspace_id, 'chat.edit') or public.has_workspace_permission(workspace_id, 'chat.create'));

grant select, insert, update on
  app.chat_branches,
  app.chat_attachments
to authenticated;
