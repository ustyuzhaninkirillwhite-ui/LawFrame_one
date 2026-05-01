alter table app.activepieces_workspace_security
  add column if not exists incident_lock_active boolean not null default false;

update app.activepieces_workspace_security
set pieces_filter_type = 'ALLOWED'
where upper(pieces_filter_type) <> 'ALLOWED';

alter table app.activepieces_workspace_security
  alter column token_ttl_seconds set default 120,
  alter column pieces_filter_type set default 'ALLOWED';

alter table app.activepieces_workspace_security
  drop constraint if exists activepieces_workspace_security_token_ttl_seconds_check,
  drop constraint if exists app_activepieces_workspace_security_token_ttl_seconds_check,
  drop constraint if exists activepieces_workspace_security_pieces_filter_type_check,
  drop constraint if exists app_activepieces_workspace_security_pieces_filter_type_check;

alter table app.activepieces_workspace_security
  add constraint activepieces_workspace_security_token_ttl_seconds_check
  check (token_ttl_seconds >= 60 and token_ttl_seconds <= 300),
  add constraint activepieces_workspace_security_pieces_filter_type_check
  check (pieces_filter_type = 'ALLOWED');

alter table app.activepieces_embed_sessions
  add column if not exists session_id uuid null,
  add column if not exists issued_at timestamptz not null default timezone('utc', now()),
  add column if not exists ttl_seconds integer not null default 120,
  add column if not exists initialized_at timestamptz null,
  add column if not exists consumed_at timestamptz null,
  add column if not exists status text not null default 'issued',
  add column if not exists request_hash text null,
  add column if not exists idempotency_key text null,
  add column if not exists project_id text null,
  add column if not exists pieces_policy_hash text null,
  add column if not exists ip_hash text null,
  add column if not exists user_agent_hash text null;

update app.activepieces_embed_sessions
set session_id = id
where session_id is null;

alter table app.activepieces_embed_sessions
  alter column session_id set not null,
  drop constraint if exists activepieces_embed_sessions_status_check,
  drop constraint if exists app_activepieces_embed_sessions_status_check,
  drop constraint if exists activepieces_embed_sessions_ttl_seconds_check,
  drop constraint if exists app_activepieces_embed_sessions_ttl_seconds_check;

alter table app.activepieces_embed_sessions
  add constraint activepieces_embed_sessions_status_check
  check (status in ('issued', 'initialized', 'expired', 'revoked', 'error')),
  add constraint activepieces_embed_sessions_ttl_seconds_check
  check (ttl_seconds >= 60 and ttl_seconds <= 300);

create unique index if not exists idx_activepieces_embed_sessions_session_id
  on app.activepieces_embed_sessions (session_id);

create index if not exists idx_activepieces_embed_sessions_idempotency
  on app.activepieces_embed_sessions (
    workspace_id,
    auth_user_id,
    project_id,
    idempotency_key,
    created_at desc
  )
  where idempotency_key is not null;

create index if not exists idx_activepieces_embed_sessions_status
  on app.activepieces_embed_sessions (workspace_id, status, token_expires_at desc);

alter table app.activepieces_project_bindings
  add column if not exists deterministic_external_project_id text null,
  add column if not exists pieces_filter_type text not null default 'ALLOWED',
  add column if not exists pieces_policy_hash text null;

update app.activepieces_project_bindings
set
  deterministic_external_project_id = coalesce(
    deterministic_external_project_id,
    external_project_id
  ),
  pieces_filter_type = 'ALLOWED',
  status = case
    when status = 'active' then 'provisioned'
    when status = 'archived' then 'suspended'
    else status
  end;

alter table app.activepieces_project_bindings
  drop constraint if exists activepieces_project_bindings_status_check,
  drop constraint if exists app_activepieces_project_bindings_status_check,
  drop constraint if exists activepieces_project_bindings_pieces_filter_type_check,
  drop constraint if exists app_activepieces_project_bindings_pieces_filter_type_check;

alter table app.activepieces_project_bindings
  alter column status set default 'pending',
  alter column pieces_filter_type set default 'ALLOWED';

alter table app.activepieces_project_bindings
  add constraint activepieces_project_bindings_status_check
  check (status in ('pending', 'provisioned', 'suspended', 'error')),
  add constraint activepieces_project_bindings_pieces_filter_type_check
  check (pieces_filter_type = 'ALLOWED');

create index if not exists idx_activepieces_project_bindings_policy
  on app.activepieces_project_bindings (
    workspace_id,
    pieces_policy_hash,
    last_read_back_at desc
  );

alter table app.activepieces_user_bindings
  add column if not exists status text not null default 'provisioned';

alter table app.activepieces_user_bindings
  drop constraint if exists activepieces_user_bindings_status_check,
  drop constraint if exists app_activepieces_user_bindings_status_check;

alter table app.activepieces_user_bindings
  add constraint activepieces_user_bindings_status_check
  check (status in ('pending', 'provisioned', 'suspended', 'error'));

alter table app.automation_runtime_bindings
  add column if not exists lexframe_project_id text null;

create index if not exists idx_automation_runtime_bindings_stage17_5_canvas
  on app.automation_runtime_bindings (
    workspace_id,
    installed_automation_id,
    active,
    status
  );
