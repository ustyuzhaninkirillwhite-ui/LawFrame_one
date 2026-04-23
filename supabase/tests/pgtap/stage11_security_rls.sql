begin;

select plan(7);

select has_table('app', 'data_access_profiles', 'data_access_profiles table exists');
select ok(
  exists(
    select 1
    from pg_proc
    where proname = 'is_session_owner'
  ),
  'is_session_owner helper exists'
);
select ok(
  exists(
    select 1
    from pg_policy
    where polrelid = 'app.user_sessions'::regclass
      and polname = 'user_sessions_select_owner_or_security_admin'
  ),
  'user_sessions select policy exists'
);
select ok(
  exists(
    select 1
    from pg_policy
    where polrelid = 'app.workspace_security_settings'::regclass
      and polname = 'workspace_security_settings_update_security_admin'
  ),
  'workspace security settings manage policy exists'
);
select ok(
  exists(
    select 1
    from pg_policy
    where polrelid = 'app.data_access_profiles'::regclass
      and polname = 'data_access_profiles_select_security_admin'
  ),
  'data access profiles policy exists'
);
select ok(has_table_privilege('authenticated', 'app.data_access_profiles', 'SELECT'), 'authenticated can read data_access_profiles');
select ok(has_function_privilege('authenticated', 'public.is_session_owner(text)', 'EXECUTE'), 'authenticated can execute is_session_owner');

select * from finish();

rollback;
