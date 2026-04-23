alter table app.workflow_runs
  drop constraint if exists workflow_runs_status_check;

alter table app.workflow_runs
  add constraint workflow_runs_status_check
  check (
    status in (
      'queued',
      'created',
      'precheck_failed',
      'ready_to_start',
      'starting',
      'running',
      'waiting_approval',
      'waiting_delivery_approval',
      'delivering',
      'completed',
      'completed_with_warnings',
      'failed',
      'cancel_requested',
      'cancelled',
      'retrying',
      'expired'
    )
  );

alter table app.workflow_runs
  drop constraint if exists workflow_runs_approval_state_check;

alter table app.workflow_runs
  add constraint workflow_runs_approval_state_check
  check (
    approval_state in (
      'not_required',
      'pending',
      'approved',
      'rejected',
      'changes_requested'
    )
  );

alter table app.workflow_runs
  add column if not exists error_message text null,
  add column if not exists last_transition_at timestamptz not null default timezone('utc', now()),
  add column if not exists cancellation_reason text null;

alter table app.workflow_run_steps
  drop constraint if exists workflow_run_steps_status_check;

alter table app.workflow_run_steps
  add constraint workflow_run_steps_status_check
  check (
    status in (
      'queued',
      'pending',
      'skipped',
      'running',
      'waiting_approval',
      'waiting_external_callback',
      'completed',
      'failed',
      'failed_retryable',
      'failed_permanent',
      'cancelled'
    )
  );

alter table app.workflow_run_steps
  add column if not exists error_message text null,
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists last_event_at timestamptz null;

alter table app.activepieces_run_bindings
  drop constraint if exists activepieces_run_bindings_status_check;

alter table app.activepieces_run_bindings
  add constraint activepieces_run_bindings_status_check
  check (
    status in (
      'queued',
      'created',
      'starting',
      'running',
      'waiting_approval',
      'waiting_delivery_approval',
      'delivering',
      'completed',
      'completed_with_warnings',
      'failed',
      'cancel_requested',
      'cancelled',
      'retrying',
      'expired'
    )
  );

alter table app.activepieces_run_bindings
  add column if not exists reconciliation_status text not null default 'pending' check (
    reconciliation_status in ('pending', 'in_sync', 'drift_detected', 'failed')
  ),
  add column if not exists reconciliation_cursor text null,
  add column if not exists last_error_code text null,
  add column if not exists last_error_message text null,
  add column if not exists last_event_at timestamptz null;

alter table app.activepieces_callback_receipts
  drop constraint if exists activepieces_callback_receipts_callback_type_check;

alter table app.activepieces_callback_receipts
  add constraint activepieces_callback_receipts_callback_type_check
  check (
    callback_type in (
      'step_event',
      'run_event',
      'artifact',
      'approval_gate',
      'delivery_gate'
    )
  );

alter table app.approval_tasks
  drop constraint if exists approval_tasks_status_check;

alter table app.approval_tasks
  add constraint approval_tasks_status_check
  check (
    status in (
      'pending',
      'approved',
      'rejected',
      'changes_requested',
      'expired',
      'cancelled',
      'superseded'
    )
  );

alter table app.approval_tasks
  add column if not exists approval_kind text not null default 'run_approval' check (
    approval_kind in ('run_approval', 'delivery_approval', 'document_finalization')
  ),
  add column if not exists delivery_request_id uuid null,
  add column if not exists requested_changes_count integer not null default 0 check (requested_changes_count >= 0),
  add column if not exists expires_at timestamptz null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists app.workflow_run_inputs (
  id uuid primary key default public.app_uuid_v7(),
  workflow_run_id uuid not null references app.workflow_runs(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  profile_id uuid null references app.legal_work_profiles(id) on delete set null,
  requested_mode text not null default 'full_run' check (requested_mode in ('full_run')),
  input_payload jsonb not null default '{}'::jsonb,
  preflight_report jsonb not null default '{}'::jsonb,
  idempotency_key text null,
  requested_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (workflow_run_id)
);

create table if not exists app.run_step_events (
  id uuid primary key default public.app_uuid_v7(),
  workflow_run_id uuid not null references app.workflow_runs(id) on delete cascade,
  workflow_run_step_id uuid null references app.workflow_run_steps(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  step_code text not null,
  module_code text null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  error_code text null,
  occurred_at timestamptz not null,
  idempotency_key text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (idempotency_key)
);

create table if not exists app.approval_decisions (
  id uuid primary key default public.app_uuid_v7(),
  approval_task_id uuid not null references app.approval_tasks(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  workflow_run_id uuid null references app.workflow_runs(id) on delete set null,
  decision text not null check (
    decision in ('approved', 'rejected', 'changes_requested', 'expired', 'cancelled')
  ),
  comment text null,
  actor_user_id uuid null references app.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.delivery_requests (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  workflow_run_id uuid not null references app.workflow_runs(id) on delete cascade,
  approval_task_id uuid null references app.approval_tasks(id) on delete set null,
  channel text not null check (channel in ('email')),
  title text not null,
  status text not null default 'draft' check (
    status in (
      'draft',
      'waiting_approval',
      'approved',
      'queued',
      'sending',
      'sent',
      'failed_retryable',
      'failed_permanent',
      'cancelled'
    )
  ),
  subject text not null,
  body text not null,
  body_hash text not null,
  recipient_emails jsonb not null default '[]'::jsonb,
  artifact_ids jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  requires_approval boolean not null default true,
  approved_at timestamptz null,
  approved_by_user_id uuid null references app.profiles(id) on delete set null,
  sent_at timestamptz null,
  cancelled_at timestamptz null,
  last_error_code text null,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.delivery_attempts (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  delivery_request_id uuid not null references app.delivery_requests(id) on delete cascade,
  status text not null check (
    status in ('queued', 'sending', 'sent', 'failed_retryable', 'failed_permanent')
  ),
  provider text not null default 'email-mock',
  attempt_no integer not null default 1 check (attempt_no > 0),
  payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_code text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.delivery_events (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  delivery_request_id uuid not null references app.delivery_requests(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.domain_outbox_events (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  aggregate_type text not null,
  aggregate_id text not null,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (
    status in ('pending', 'processed', 'failed')
  ),
  available_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.notifications (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  severity text not null default 'info' check (
    severity in ('info', 'success', 'warning', 'error')
  ),
  entity_type text null,
  entity_id text null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table app.approval_tasks
  drop constraint if exists approval_tasks_delivery_request_id_fkey;

alter table app.approval_tasks
  add constraint approval_tasks_delivery_request_id_fkey
  foreign key (delivery_request_id)
  references app.delivery_requests(id)
  on delete set null;

create index if not exists idx_app_workflow_runs_status
  on app.workflow_runs (workspace_id, status, created_at desc);

create index if not exists idx_app_workflow_run_steps_status
  on app.workflow_run_steps (workflow_run_id, status, position asc);

create index if not exists idx_app_workflow_run_inputs_lookup
  on app.workflow_run_inputs (workflow_run_id, created_at desc);

create index if not exists idx_app_run_step_events_lookup
  on app.run_step_events (workflow_run_id, occurred_at desc);

create index if not exists idx_app_approval_decisions_lookup
  on app.approval_decisions (approval_task_id, created_at desc);

create index if not exists idx_app_delivery_requests_lookup
  on app.delivery_requests (workflow_run_id, created_at desc);

create index if not exists idx_app_delivery_requests_status
  on app.delivery_requests (workspace_id, status, updated_at desc);

create index if not exists idx_app_delivery_attempts_lookup
  on app.delivery_attempts (delivery_request_id, created_at desc);

create index if not exists idx_app_delivery_events_lookup
  on app.delivery_events (delivery_request_id, created_at desc);

create index if not exists idx_app_domain_outbox_events_status
  on app.domain_outbox_events (status, available_at asc);

create index if not exists idx_app_notifications_lookup
  on app.notifications (workspace_id, read_at, created_at desc);
