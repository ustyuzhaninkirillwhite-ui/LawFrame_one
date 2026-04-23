begin;

select plan(13);

select has_table('app', 'retention_policies', 'retention_policies table exists');
select has_table('app', 'processing_activities', 'processing_activities table exists');
select has_table('app', 'consent_records', 'consent_records table exists');
select has_table('app', 'dsr_requests', 'dsr_requests table exists');
select has_table('app', 'security_alert_rules', 'security_alert_rules table exists');
select has_table('app', 'security_alerts', 'security_alerts table exists');
select has_table('app', 'security_incidents', 'security_incidents table exists');
select has_table('app', 'access_review_campaigns', 'access_review_campaigns table exists');
select has_table('app', 'access_review_items', 'access_review_items table exists');
select has_table('app', 'support_bundle_jobs', 'support_bundle_jobs table exists');
select ok(has_table_privilege('authenticated', 'app.security_incidents', 'SELECT'), 'authenticated can read security incidents');
select ok(has_table_privilege('authenticated', 'app.processing_activities', 'SELECT'), 'authenticated can read processing activities');
select ok(has_function_privilege('authenticated', 'public.is_incident_locked(uuid)', 'EXECUTE'), 'authenticated can execute incident lock helper');

select * from finish();

rollback;
