begin;

select plan(26);

select has_table('app', 'live_events', 'live events table exists');
select has_table('app', 'realtime_topic_acl', 'realtime topic acl table exists');
select has_table('app', 'notification_preferences', 'notification preferences table exists');
select has_table('app', 'device_tokens', 'device tokens table exists');

select col_type_is('app', 'live_events', 'sequence_id', 'bigint', 'live events stores monotonic sequence id');
select col_type_is('app', 'notifications', 'user_id', 'uuid', 'notifications stores target user id');
select col_type_is('app', 'notifications', 'priority', 'text', 'notifications stores priority');
select col_type_is('app', 'notifications', 'action_url', 'text', 'notifications stores action url');
select col_type_is('app', 'device_tokens', 'device_token', 'text', 'device tokens stores device token');

select ok(
  (select relrowsecurity from pg_class where oid = 'app.live_events'::regclass),
  'live_events RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'app.device_tokens'::regclass),
  'device_tokens RLS is enabled'
);
select ok(
  exists(select 1 from pg_policy where polrelid = 'app.live_events'::regclass and polname = 'live_events_select_member'),
  'live events select policy exists'
);
select ok(
  exists(select 1 from pg_policy where polrelid = 'app.notification_preferences'::regclass and polname = 'notification_preferences_manage_owner'),
  'notification preferences manage policy exists'
);

select ok(
  exists(select 1 from pg_indexes where schemaname = 'app' and indexname = 'idx_app_live_events_status_available'),
  'live events pending index exists'
);
select ok(
  exists(select 1 from pg_indexes where schemaname = 'app' and indexname = 'idx_app_notifications_dedupe'),
  'notification dedupe index exists'
);
select ok(
  exists(select 1 from pg_indexes where schemaname = 'app' and indexname = 'idx_app_realtime_topic_acl_user'),
  'realtime topic acl user index exists'
);

select results_eq(
  $$ select count(*)::int from app.permissions where code = 'dashboard.view' $$,
  $$ values (1) $$,
  'dashboard.view permission is seeded'
);

select ok(
  exists(select 1 from app.role_permissions where role_code = 'owner' and permission_code = 'dashboard.view'),
  'owner receives dashboard.view'
);
select ok(
  exists(select 1 from app.role_permissions where role_code = 'viewer' and permission_code = 'dashboard.view'),
  'viewer receives dashboard.view'
);
select ok(
  exists(select 1 from app.role_permissions where role_code = 'security_admin' and permission_code = 'dashboard.view'),
  'security admin receives dashboard.view'
);
select ok(
  not exists(select 1 from app.role_permissions where role_code = 'billing_admin' and permission_code = 'dashboard.view'),
  'billing admin does not receive dashboard.view'
);

select ok(
  has_table_privilege('authenticated', 'app.live_events', 'SELECT'),
  'authenticated can read live events'
);
select ok(
  has_table_privilege('authenticated', 'app.device_tokens', 'INSERT'),
  'authenticated can register device tokens'
);
select ok(
  has_function_privilege('authenticated', 'public.can_receive_realtime_topic(text)', 'EXECUTE'),
  'authenticated can execute realtime topic acl helper'
);

select ok(
  exists(select 1 from app.realtime_topic_acl where topic like 'workspace:%:dashboard'),
  'workspace dashboard topics are backfilled'
);
select ok(
  exists(select 1 from app.realtime_topic_acl where topic like 'user:%:notifications'),
  'user notification topics are backfilled'
);

select * from finish();

rollback;
