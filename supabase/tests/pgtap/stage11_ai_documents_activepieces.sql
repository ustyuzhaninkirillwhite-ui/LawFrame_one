begin;

select plan(9);

select has_table('app', 'ai_provider_policies', 'ai_provider_policies table exists');
select has_table('app', 'document_security_labels', 'document_security_labels table exists');
select has_table('app', 'activepieces_workspace_security', 'activepieces_workspace_security table exists');
select ok(
  exists(
    select 1
    from pg_policy
    where polrelid = 'app.ai_provider_policies'::regclass
      and polname = 'ai_provider_policies_manage'
  ),
  'ai provider policy manage rule exists'
);
select ok(
  exists(
    select 1
    from pg_policy
    where polrelid = 'app.document_security_labels'::regclass
      and polname = 'document_security_labels_select_member'
  ),
  'document security label policy exists'
);
select ok(has_table_privilege('authenticated', 'app.ai_provider_policies', 'SELECT'), 'authenticated can read ai provider policies');
select ok(has_table_privilege('authenticated', 'app.document_security_labels', 'SELECT'), 'authenticated can read document security labels');
select ok(has_table_privilege('authenticated', 'app.activepieces_workspace_security', 'SELECT'), 'authenticated can read activepieces workspace security');
select ok(has_function_privilege('authenticated', 'public.document_requires_download_reason(uuid)', 'EXECUTE'), 'authenticated can execute document reason helper');

select * from finish();

rollback;
