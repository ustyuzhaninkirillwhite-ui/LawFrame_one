insert into app.role_permissions (role_code, permission_code)
values
  ('owner', 'legal_sources.manage'),
  ('owner', 'legal_search.use'),
  ('owner', 'legal_rag.use'),
  ('admin', 'legal_sources.manage'),
  ('admin', 'legal_search.use'),
  ('admin', 'legal_rag.use'),
  ('lawyer', 'legal_sources.manage'),
  ('lawyer', 'legal_search.use'),
  ('lawyer', 'legal_rag.use'),
  ('assistant', 'legal_search.use'),
  ('assistant', 'legal_rag.use')
on conflict (role_code, permission_code) do nothing;
