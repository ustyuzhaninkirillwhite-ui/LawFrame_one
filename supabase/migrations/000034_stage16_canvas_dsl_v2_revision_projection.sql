alter table app.automation_canvas_drafts
  add column if not exists revision_counter integer not null default 0;

alter table app.installed_automations
  add column if not exists workflow_revision integer not null default 0;

alter table app.automation_canvas_operations
  add column if not exists before_revision integer null,
  add column if not exists after_revision integer null;

alter table app.automation_canvas_operations drop constraint if exists automation_canvas_operations_operation_type_check;
alter table app.automation_canvas_operations
  add constraint automation_canvas_operations_operation_type_check
  check (
    operation_type in (
      'ADD_NODE',
      'UPDATE_NODE',
      'MOVE_NODE',
      'DELETE_NODE',
      'UPDATE_NODE_CONFIG',
      'ADD_EDGE',
      'DELETE_EDGE',
      'UPDATE_EDGE',
      'UPDATE_CONDITION',
      'UPDATE_WORKFLOW_POLICY',
      'UPDATE_NODE_POLICY',
      'UPDATE_LAYOUT',
      'UPSERT_WORKFLOW_INPUT',
      'DELETE_WORKFLOW_INPUT',
      'UPSERT_WORKFLOW_OUTPUT',
      'DELETE_WORKFLOW_OUTPUT',
      'UPSERT_INPUT_BINDING',
      'DELETE_INPUT_BINDING',
      'PIN_SAMPLE_DATA',
      'UNPIN_SAMPLE_DATA'
    )
  );

alter table app.automation_canvas_sample_data
  add column if not exists expires_at timestamptz null;

alter table app.automation_canvas_pinned_data
  add column if not exists expires_at timestamptz null;

create index if not exists idx_app_canvas_sample_data_expiry
  on app.automation_canvas_sample_data (expires_at)
  where expires_at is not null;

create index if not exists idx_app_canvas_pinned_data_expiry
  on app.automation_canvas_pinned_data (expires_at)
  where expires_at is not null;
