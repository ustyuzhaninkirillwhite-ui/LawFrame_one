begin;

select plan(10);

select has_column('audit', 'audit_events', 'session_id', 'audit_events.session_id exists');
select has_column('audit', 'audit_events', 'event_category', 'audit_events.event_category exists');
select has_column('audit', 'audit_events', 'event_hash', 'audit_events.event_hash exists');
select has_table('audit', 'audit_event_anchors', 'audit_event_anchors table exists');
select has_table('app', 'secret_inventory', 'secret_inventory table exists');
select has_table('app', 'secret_usage_events', 'secret_usage_events table exists');
select has_table('app', 'secret_rotation_events', 'secret_rotation_events table exists');
select ok(has_table_privilege('authenticated', 'app.secret_inventory', 'SELECT'), 'authenticated can read secret inventory');
select ok(has_table_privilege('authenticated', 'audit.audit_event_anchors', 'SELECT'), 'authenticated can read audit anchors');
select ok(
  exists(
    select 1
    from pg_policy
    where polrelid = 'app.secret_inventory'::regclass
      and polname = 'secret_inventory_select_security_admin'
  ),
  'secret inventory policy exists'
);

select * from finish();

rollback;
