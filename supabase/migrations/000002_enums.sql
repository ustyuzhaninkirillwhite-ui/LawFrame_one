create type workspace_role as enum (
  'owner',
  'admin',
  'lawyer',
  'assistant',
  'viewer',
  'security_admin',
  'billing_admin'
);

create type automation_status as enum ('draft', 'ready', 'blocked');
create type workflow_state as enum ('draft', 'compiled', 'execution_ready');
create type builder_state as enum ('unavailable', 'mock', 'ready');
create type run_status as enum ('queued', 'running', 'waiting_approval', 'completed', 'failed');
create type data_classification as enum (
  'public',
  'internal',
  'confidential',
  'legal_secret',
  'personal_data',
  'client_material'
);

