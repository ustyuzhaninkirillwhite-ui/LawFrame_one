begin;

select plan(5);

select has_table('app', 'security_release_gates', 'security_release_gates table exists');
select has_table('app', 'security_test_runs', 'security_test_runs table exists');
select ok(
  exists(
    select 1
    from pg_views
    where schemaname = 'api'
      and viewname = 'stage11_security_overview'
  ),
  'stage11 security overview view exists'
);
select ok(has_table_privilege('authenticated', 'app.security_release_gates', 'SELECT'), 'authenticated can read security release gates');
select ok(has_table_privilege('authenticated', 'api.stage11_security_overview', 'SELECT'), 'authenticated can read stage11 overview view');

select * from finish();

rollback;
