create schema if not exists app;
create schema if not exists api;
create schema if not exists audit;
create schema if not exists private;

revoke all on schema app from anon, authenticated;
revoke all on schema audit from anon, authenticated;
revoke all on schema private from anon, authenticated;

grant usage on schema app to authenticated;
grant usage on schema api to authenticated;
grant usage on schema audit to authenticated;
