create table if not exists app.security_release_gates (
  gate_code text primary key,
  title text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  required boolean not null default true,
  owner text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.security_test_runs (
  id uuid primary key default public.app_uuid_v7(),
  gate_code text not null references app.security_release_gates(gate_code) on delete cascade,
  status text not null check (status in ('passed', 'failed', 'waived')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

insert into app.security_release_gates (gate_code, title, severity, required, owner)
values
  ('rls_coverage', 'All protected tables have RLS and tests', 'critical', true, 'security'),
  ('audit_append_only', 'Audit trail is append-only and exportable', 'critical', true, 'security'),
  ('client_bundle_secret_scan', 'No backend-only secrets leak to the web bundle', 'critical', true, 'platform'),
  ('ai_policy_tests', 'AI routes respect data classification and approval policies', 'high', true, 'ai'),
  ('security_e2e', 'Security-critical UI flows pass automated checks', 'high', true, 'frontend')
on conflict (gate_code) do update
set
  title = excluded.title,
  severity = excluded.severity,
  required = excluded.required,
  owner = excluded.owner;

alter table app.security_release_gates enable row level security;
alter table app.security_test_runs enable row level security;

create policy security_release_gates_select_authenticated
  on app.security_release_gates
  for select
  to authenticated
  using (true);

create policy security_test_runs_select_authenticated
  on app.security_test_runs
  for select
  to authenticated
  using (true);

grant select on app.security_release_gates, app.security_test_runs to authenticated;

create or replace view api.stage11_security_overview as
select
  g.gate_code,
  g.title,
  g.severity,
  g.required,
  g.owner,
  (
    select r.status
    from app.security_test_runs r
    where r.gate_code = g.gate_code
    order by r.created_at desc
    limit 1
  ) as latest_status
from app.security_release_gates g;

grant select on api.stage11_security_overview to authenticated;
