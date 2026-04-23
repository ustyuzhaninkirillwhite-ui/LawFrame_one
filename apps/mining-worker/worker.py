from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock, Thread
from typing import Any

import clickhouse_connect
import psycopg
from confluent_kafka import Producer


@dataclass(frozen=True)
class WorkerConfig:
    postgres_dsn: str
    redpanda_brokers: str
    clickhouse_url: str
    ngram_window_days: int
    variant_window_days: int
    team_model_window_days: int
    synthetic_session_timeout_minutes: int
    poll_interval_seconds: int
    health_port: int


@dataclass
class WorkerRuntimeState:
    started_at_monotonic: float
    last_cycle_started_at: str | None = None
    last_cycle_completed_at: str | None = None
    last_error: str | None = None
    successful_cycles: int = 0
    failed_cycles: int = 0
    last_cycle_latency_ms: int | None = None

    def snapshot(self) -> dict[str, Any]:
        return {
            "startedAt": utc_now(),
            "uptimeSeconds": int(time.monotonic() - self.started_at_monotonic),
            "lastCycleStartedAt": self.last_cycle_started_at,
            "lastCycleCompletedAt": self.last_cycle_completed_at,
            "lastError": self.last_error,
            "successfulCycles": self.successful_cycles,
            "failedCycles": self.failed_cycles,
            "lastCycleLatencyMs": self.last_cycle_latency_ms,
        }


def load_config() -> WorkerConfig:
    return WorkerConfig(
        postgres_dsn=os.environ["POSTGRES_DSN"],
        redpanda_brokers=os.environ["REDPANDA_BROKERS"],
        clickhouse_url=os.environ["CLICKHOUSE_URL"],
        ngram_window_days=int(os.environ.get("STAGE9_NGRAM_WINDOW_DAYS", "14")),
        variant_window_days=int(os.environ.get("STAGE9_VARIANT_WINDOW_DAYS", "30")),
        team_model_window_days=int(
            os.environ.get("STAGE9_TEAM_MODEL_WINDOW_DAYS", "90")
        ),
        synthetic_session_timeout_minutes=int(
            os.environ.get("STAGE9_SYNTHETIC_SESSION_TIMEOUT_MINUTES", "30")
        ),
        poll_interval_seconds=int(
            os.environ.get("STAGE9_LOOP_INTERVAL_SECONDS", "15")
        ),
        health_port=int(os.environ.get("HEALTH_PORT", "8090")),
    )


class Stage9MiningWorker:
    def __init__(self, config: WorkerConfig, runtime_state: WorkerRuntimeStore) -> None:
        self.config = config
        self.runtime_state = runtime_state
        self.producer = Producer({"bootstrap.servers": config.redpanda_brokers})
        self.clickhouse = clickhouse_connect.get_client(
            host=config.clickhouse_url.replace("http://", "").split(":")[0],
            port=int(config.clickhouse_url.rsplit(":", 1)[1]),
        )

    def run_forever(self) -> None:
        while True:
            started_at = time.monotonic()
            self.runtime_state.mark_cycle_started()

            try:
                with psycopg.connect(self.config.postgres_dsn) as connection:
                    connection.autocommit = False
                    self.publish_pending_events(connection)
                    self.materialize_clickhouse(connection)
                    self.refresh_process_case_cache(connection)
                    self.refresh_pattern_cache(connection)
                    self.refresh_quality_metrics(connection)

                self.runtime_state.mark_cycle_completed(
                    latency_ms=int((time.monotonic() - started_at) * 1000)
                )
            except Exception as error:  # pragma: no cover - operational path
                self.runtime_state.mark_cycle_failed(
                    message=str(error),
                    latency_ms=int((time.monotonic() - started_at) * 1000),
                )

            time.sleep(self.config.poll_interval_seconds)

    def publish_pending_events(self, connection: psycopg.Connection[Any]) -> None:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select
                  id,
                  event_id,
                  workspace_id::text,
                  actor_user_id::text,
                  session_id,
                  trace_id,
                  event_name,
                  event_group,
                  activity_code,
                  schema_version,
                  source,
                  privacy_class,
                  risk_level,
                  process_instance_id,
                  run_id,
                  resource_type,
                  resource_id,
                  event_time,
                  properties,
                  payload_hash,
                  client_event_id
                from app.product_event_outbox
                where status = 'pending'
                  and available_at <= timezone('utc', now())
                order by event_time asc
                limit 100
                """
            )
            rows = cursor.fetchall()

            for row in rows:
                payload = {
                    "event_id": str(row[1]),
                    "workspace_id": row[2],
                    "actor_user_id": row[3],
                    "session_id": row[4],
                    "trace_id": row[5],
                    "event_name": row[6],
                    "event_group": row[7],
                    "activity_code": row[8],
                    "schema_version": row[9],
                    "source": row[10],
                    "privacy_class": row[11],
                    "risk_level": row[12],
                    "process_instance_id": row[13],
                    "run_id": row[14],
                    "resource_type": row[15],
                    "resource_id": row[16],
                    "event_time": row[17].astimezone(timezone.utc).isoformat(),
                    "properties": row[18],
                    "payload_hash": row[19],
                    "client_event_id": row[20],
                }
                self.producer.produce(
                    "lexframe.product-events.raw",
                    key=payload["event_id"],
                    value=json.dumps(payload, default=str).encode("utf-8"),
                )

                cursor.execute(
                    """
                    update app.product_event_outbox
                    set
                      status = 'published',
                      attempt_count = attempt_count + 1,
                      updated_at = timezone('utc', now())
                    where id = %s
                    """,
                    (row[0],),
                )

        self.producer.flush(5)
        connection.commit()

    def materialize_clickhouse(self, connection: psycopg.Connection[Any]) -> None:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select
                  event_id::text,
                  workspace_id::text,
                  actor_user_id::text,
                  session_id,
                  trace_id,
                  event_name,
                  event_group,
                  activity_code,
                  schema_version,
                  source,
                  privacy_class,
                  risk_level,
                  process_instance_id,
                  run_id,
                  resource_type,
                  resource_id,
                  event_time,
                  properties::text,
                  payload_hash,
                  client_event_id
                from app.product_event_outbox
                where status = 'published'
                order by event_time asc
                limit 200
                """
            )
            rows = cursor.fetchall()

            if not rows:
                return

            self.clickhouse.insert(
                "analytics.raw_product_events",
                rows,
                column_names=[
                    "event_id",
                    "workspace_id",
                    "actor_user_id",
                    "session_id",
                    "trace_id",
                    "event_name",
                    "event_group",
                    "activity_code",
                    "schema_version",
                    "source",
                    "privacy_class",
                    "risk_level",
                    "process_instance_id",
                    "run_id",
                    "resource_type",
                    "resource_id",
                    "event_time",
                    "properties",
                    "payload_hash",
                    "client_event_id",
                ],
            )

            cursor.execute(
                """
                update app.product_event_outbox
                set
                  status = 'mirrored_posthog',
                  updated_at = timezone('utc', now())
                where status = 'published'
                """
            )

        connection.commit()

    def refresh_process_case_cache(self, connection: psycopg.Connection[Any]) -> None:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                delete from app.process_case_snapshots
                where created_at < timezone('utc', now()) - interval '2 days'
                """
            )
        connection.commit()

    def refresh_pattern_cache(self, connection: psycopg.Connection[Any]) -> None:
        generated_at = datetime.now(timezone.utc)
        with connection.cursor() as cursor:
            cursor.execute(
                """
                insert into app.recommendation_quality_snapshots (
                  workspace_id,
                  metrics,
                  mining_lag_minutes,
                  quarantine_rate_percent,
                  missing_trace_rate_percent,
                  captured_at
                )
                select
                  w.id,
                  '[]'::jsonb,
                  0,
                  0,
                  0,
                  %s
                from app.workspaces w
                on conflict do nothing
                """,
                (generated_at,),
            )
        connection.commit()

    def refresh_quality_metrics(self, connection: psycopg.Connection[Any]) -> None:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                update app.recommendation_quality_snapshots
                set captured_at = timezone('utc', now())
                where captured_at < timezone('utc', now()) - interval '1 hour'
                """
            )
        connection.commit()


class WorkerRuntimeStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._state = WorkerRuntimeState(started_at_monotonic=time.monotonic())

    def mark_cycle_started(self) -> None:
        with self._lock:
            self._state.last_cycle_started_at = utc_now()

    def mark_cycle_completed(self, latency_ms: int) -> None:
        with self._lock:
            self._state.last_cycle_completed_at = utc_now()
            self._state.last_cycle_latency_ms = latency_ms
            self._state.last_error = None
            self._state.successful_cycles += 1

    def mark_cycle_failed(self, message: str, latency_ms: int) -> None:
        with self._lock:
            self._state.last_cycle_latency_ms = latency_ms
            self._state.last_error = message
            self._state.failed_cycles += 1

    def get_live_payload(self) -> dict[str, Any]:
        with self._lock:
            return {
                "status": "ok",
                "service": "mining-worker",
                **self._state.snapshot(),
            }

    def get_ready_payload(self, config: WorkerConfig) -> dict[str, Any]:
        with self._lock:
            snapshot = self._state.snapshot()
            last_completed = self._state.last_cycle_completed_at

            if last_completed is None:
                status = "degraded"
                summary = "Worker has not completed a mining cycle yet."
            else:
                last_completed_at = datetime.fromisoformat(
                    last_completed.replace("Z", "+00:00")
                )
                age_seconds = (
                    datetime.now(timezone.utc) - last_completed_at
                ).total_seconds()
                stale = age_seconds > config.poll_interval_seconds * 3
                if stale or self._state.last_error is not None:
                    status = "blocked"
                    summary = self._state.last_error or "Mining cycle heartbeat is stale."
                else:
                    status = "ok"
                    summary = "Worker cycle heartbeat is healthy."

            return {
                "status": status,
                "service": "mining-worker",
                "summary": summary,
                "dependencies": [
                    {
                        "code": "postgres",
                        "status": "healthy" if snapshot["lastCycleCompletedAt"] else "degraded",
                    },
                    {
                        "code": "redpanda",
                        "status": "healthy" if snapshot["successfulCycles"] > 0 else "degraded",
                    },
                    {
                        "code": "clickhouse",
                        "status": "healthy" if snapshot["successfulCycles"] > 0 else "degraded",
                    },
                ],
                **snapshot,
            }

    def render_metrics(self, config: WorkerConfig) -> str:
        ready_payload = self.get_ready_payload(config)
        status_value = {
            "ok": 2,
            "degraded": 1,
            "blocked": 0,
        }[ready_payload["status"]]

        return "\n".join(
            [
                "# HELP lexframe_mining_worker_status Worker readiness where ok=2, degraded=1, blocked=0.",
                "# TYPE lexframe_mining_worker_status gauge",
                f'lexframe_mining_worker_status{{service="mining-worker"}} {status_value}',
                "# HELP lexframe_mining_worker_successful_cycles Total successful worker cycles.",
                "# TYPE lexframe_mining_worker_successful_cycles counter",
                f'lexframe_mining_worker_successful_cycles{{service="mining-worker"}} {ready_payload["successfulCycles"]}',
                "# HELP lexframe_mining_worker_failed_cycles Total failed worker cycles.",
                "# TYPE lexframe_mining_worker_failed_cycles counter",
                f'lexframe_mining_worker_failed_cycles{{service="mining-worker"}} {ready_payload["failedCycles"]}',
                "",
            ]
        )


def start_health_server(config: WorkerConfig, runtime_state: WorkerRuntimeStore) -> Thread:
    class HealthHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/health/live":
                self._send_json(runtime_state.get_live_payload())
                return

            if self.path == "/health/ready":
                self._send_json(runtime_state.get_ready_payload(config))
                return

            if self.path == "/metrics":
                payload = runtime_state.render_metrics(config).encode("utf-8")
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return

            self.send_response(HTTPStatus.NOT_FOUND)
            self.end_headers()

        def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
            return

        def _send_json(self, payload: dict[str, Any]) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    server = ThreadingHTTPServer(("0.0.0.0", config.health_port), HealthHandler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return thread


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    config = load_config()
    runtime_state = WorkerRuntimeStore()
    start_health_server(config, runtime_state)
    Stage9MiningWorker(config, runtime_state).run_forever()
