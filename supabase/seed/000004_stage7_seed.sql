insert into app.permissions (code, label, description, scope, high_risk)
values
  ('profile.publish', 'Publish legal profile', 'Publish immutable legal work profile versions.', 'profile', true),
  ('profile.override_personal', 'Override personal profile', 'Allow personal profile overrides on top of workspace defaults.', 'profile', true),
  ('document.template.read', 'Read document templates', 'Read canonical document template records and mappings.', 'document', false),
  ('document.template.publish', 'Publish document templates', 'Publish draft template versions for production use.', 'document', true),
  ('document.template.map_fields', 'Map template placeholders', 'Configure placeholder bindings and field mappings.', 'document', true),
  ('document.validation.read', 'Read validation reports', 'Read validation reports and issue lists.', 'document', false),
  ('document.validation.resolve', 'Resolve validation issues', 'Resolve validation blockers and trigger rechecks.', 'document', true),
  ('approval.route.manage', 'Manage approval routes', 'Create and update approval routes and steps.', 'approval', true),
  ('approval.task.read', 'Read approval tasks', 'Read approval inbox items and decision context.', 'approval', false),
  ('approval.task.decide', 'Decide approval tasks', 'Approve or reject approval tasks.', 'approval', true)
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description,
  scope = excluded.scope,
  high_risk = excluded.high_risk;

insert into app.role_permissions (role_code, permission_code)
values
  ('owner', 'profile.publish'),
  ('owner', 'profile.override_personal'),
  ('owner', 'document.template.read'),
  ('owner', 'document.template.publish'),
  ('owner', 'document.template.map_fields'),
  ('owner', 'document.validation.read'),
  ('owner', 'document.validation.resolve'),
  ('owner', 'approval.route.manage'),
  ('owner', 'approval.task.read'),
  ('owner', 'approval.task.decide'),
  ('admin', 'profile.publish'),
  ('admin', 'profile.override_personal'),
  ('admin', 'document.template.read'),
  ('admin', 'document.template.publish'),
  ('admin', 'document.template.map_fields'),
  ('admin', 'document.validation.read'),
  ('admin', 'document.validation.resolve'),
  ('admin', 'approval.route.manage'),
  ('admin', 'approval.task.read'),
  ('admin', 'approval.task.decide'),
  ('lawyer', 'profile.publish'),
  ('lawyer', 'profile.override_personal'),
  ('lawyer', 'document.template.read'),
  ('lawyer', 'document.template.publish'),
  ('lawyer', 'document.template.map_fields'),
  ('lawyer', 'document.validation.read'),
  ('lawyer', 'document.validation.resolve'),
  ('lawyer', 'approval.task.read'),
  ('lawyer', 'approval.task.decide'),
  ('assistant', 'document.template.read'),
  ('assistant', 'document.validation.read'),
  ('assistant', 'approval.task.read'),
  ('viewer', 'document.template.read'),
  ('viewer', 'document.validation.read')
on conflict (role_code, permission_code) do nothing;
