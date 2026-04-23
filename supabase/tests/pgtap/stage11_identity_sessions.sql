begin;

select plan(8);

select has_table('app', 'user_sessions', 'user_sessions table exists');
select has_table('app', 'workspace_security_settings', 'workspace_security_settings table exists');
select has_table('app', 'reauth_challenges', 'reauth_challenges table exists');
select has_table('app', 'session_risk_signals', 'session_risk_signals table exists');
select col_is_pk('app', 'user_sessions', 'id', 'user_sessions.id is primary key');
select col_is_pk('app', 'workspace_security_settings', 'workspace_id', 'workspace_security_settings.workspace_id is primary key');
select has_index('app', 'user_sessions', 'idx_app_user_sessions_workspace_last_seen', 'workspace session index exists');
select has_table_privilege('authenticated', 'app.user_sessions', 'SELECT', 'authenticated can read user_sessions');

select * from finish();

rollback;
