insert into app.role_permissions (role_code, permission_code)
select role_code, permission_code
from (
  values
    ('owner'::workspace_role, 'recommendation.manage'),
    ('admin'::workspace_role, 'recommendation.manage')
) as grants(role_code, permission_code)
on conflict (role_code, permission_code) do nothing;
