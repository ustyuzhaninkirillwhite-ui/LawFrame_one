create database if not exists analytics;

create table if not exists analytics.raw_product_events (
  event_id UUID,
  workspace_id String,
  actor_user_id Nullable(String),
  session_id Nullable(String),
  trace_id Nullable(String),
  event_name String,
  event_group LowCardinality(String),
  activity_code LowCardinality(String),
  schema_version LowCardinality(String),
  source LowCardinality(String),
  privacy_class LowCardinality(String),
  risk_level LowCardinality(String),
  process_instance_id Nullable(String),
  run_id Nullable(String),
  resource_type Nullable(String),
  resource_id Nullable(String),
  event_time DateTime64(3, 'UTC'),
  properties String,
  payload_hash String,
  client_event_id Nullable(String),
  ingested_at DateTime64(3, 'UTC') default now64(3)
)
engine = MergeTree
partition by toYYYYMM(event_time)
order by (workspace_id, event_time, event_id)
ttl event_time + toIntervalDay(180);

create table if not exists analytics.normalized_events (
  event_id UUID,
  workspace_id String,
  case_key String,
  activity_code LowCardinality(String),
  actor_user_id Nullable(String),
  trace_id Nullable(String),
  session_id Nullable(String),
  process_instance_id Nullable(String),
  run_id Nullable(String),
  event_time DateTime64(3, 'UTC'),
  properties String,
  normalized_at DateTime64(3, 'UTC') default now64(3)
)
engine = MergeTree
partition by toYYYYMM(event_time)
order by (workspace_id, case_key, event_time, event_id)
ttl event_time + toIntervalDay(180);

create table if not exists analytics.process_cases (
  workspace_id String,
  case_key String,
  scope LowCardinality(String),
  pattern_id Nullable(String),
  started_at DateTime64(3, 'UTC'),
  finished_at Nullable(DateTime64(3, 'UTC')),
  duration_ms Nullable(UInt64),
  event_count UInt32,
  actor_count UInt32,
  status LowCardinality(String),
  activity_sequence Array(String),
  updated_at DateTime64(3, 'UTC') default now64(3)
)
engine = ReplacingMergeTree(updated_at)
partition by toYYYYMM(started_at)
order by (workspace_id, case_key);

create table if not exists analytics.process_case_events (
  workspace_id String,
  case_key String,
  event_id UUID,
  activity_code LowCardinality(String),
  actor_user_id Nullable(String),
  event_time DateTime64(3, 'UTC')
)
engine = MergeTree
partition by toYYYYMM(event_time)
order by (workspace_id, case_key, event_time, event_id);

create table if not exists analytics.pattern_candidates (
  workspace_id String,
  pattern_id String,
  scope LowCardinality(String),
  title String,
  strategy LowCardinality(String),
  activity_sequence Array(String),
  case_count UInt32,
  distinct_user_count UInt32,
  repeat_count UInt32,
  period_days UInt32,
  risk_level LowCardinality(String),
  explainability_summary String,
  overlap_status LowCardinality(String),
  status LowCardinality(String),
  module_mapping String,
  generated_at DateTime64(3, 'UTC') default now64(3)
)
engine = ReplacingMergeTree(generated_at)
partition by toYYYYMM(generated_at)
order by (workspace_id, pattern_id);

create table if not exists analytics.pattern_stats (
  workspace_id String,
  metric_name LowCardinality(String),
  metric_value Float64,
  metric_unit LowCardinality(String),
  metric_window LowCardinality(String),
  warning UInt8,
  captured_at DateTime64(3, 'UTC') default now64(3)
)
engine = MergeTree
partition by toYYYYMM(captured_at)
order by (workspace_id, captured_at, metric_name);
