insert into app.permissions (code, label, description, scope, high_risk)
values
  ('automation.approve_external', 'Approve external delivery', 'Approve high-risk external delivery actions before execution.', 'automation', true),
  ('connections.manage', 'Manage runtime connections', 'Create, validate and revoke runtime connections.', 'connection', true)
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description,
  scope = excluded.scope,
  high_risk = excluded.high_risk;

insert into app.role_permissions (role_code, permission_code)
values
  ('owner', 'automation.approve_external'),
  ('owner', 'connections.manage'),
  ('admin', 'automation.approve_external'),
  ('admin', 'connections.manage'),
  ('lawyer', 'automation.approve_external'),
  ('lawyer', 'connections.manage'),
  ('security_admin', 'connections.manage')
on conflict (role_code, permission_code) do nothing;
