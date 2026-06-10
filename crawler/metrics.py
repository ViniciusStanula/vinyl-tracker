"""
metrics.py — durable per-run/per-phase crawl metrics (Postgres)
───────────────────────────────────────────────────────────────────────────
Kills bottleneck B7: a log that dies with the runner gives no denominators and
no history. This persists counts + latency + API-budget to Postgres, one row
per (run, phase), so every later change is measured against real numbers that
survive the runner.

Design rules:
- Thread-safe: scraper worker threads record concurrently within a phase.
- One active phase at a time (main() runs phases sequentially).
- DB writes are best-effort: any failure is logged and swallowed so the
  observability layer can NEVER break a crawl.
"""
from __future__ import annotations

import time
import uuid
import logging
import threading
from datetime import datetime, timezone

log = logging.getLogger(__name__)

# Stable id for this process/run; every phase row shares it.
RUN_ID = uuid.uuid4().hex

_DDL = """
CREATE TABLE IF NOT EXISTS crawl_run_metrics (
    id              BIGSERIAL PRIMARY KEY,
    run_id          TEXT        NOT NULL,
    phase           TEXT        NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ NOT NULL,
    wall_s          DOUBLE PRECISION,
    -- storefront (scraper) HTTP
    requests        INTEGER     NOT NULL DEFAULT 0,
    ok              INTEGER     NOT NULL DEFAULT 0,
    blocked_403     INTEGER     NOT NULL DEFAULT 0,
    blocked_429     INTEGER     NOT NULL DEFAULT 0,
    blocked_503     INTEGER     NOT NULL DEFAULT 0,
    captcha         INTEGER     NOT NULL DEFAULT 0,
    skeleton        INTEGER     NOT NULL DEFAULT 0,
    net_errors      INTEGER     NOT NULL DEFAULT 0,
    useful          INTEGER     NOT NULL DEFAULT 0,
    latency_p50_ms  DOUBLE PRECISION,
    latency_p95_ms  DOUBLE PRECISION,
    -- Creators API (refresh path)
    api_calls       INTEGER     NOT NULL DEFAULT 0,
    api_429         INTEGER     NOT NULL DEFAULT 0,
    api_5xx         INTEGER     NOT NULL DEFAULT 0,
    api_retries     INTEGER     NOT NULL DEFAULT 0,
    api_throttle_s  DOUBLE PRECISION NOT NULL DEFAULT 0,
    budget_remaining INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crawl_run_metrics_run_idx ON crawl_run_metrics (run_id);
CREATE INDEX IF NOT EXISTS crawl_run_metrics_phase_time_idx
    ON crawl_run_metrics (phase, created_at DESC);
"""

_COUNTER_KEYS = (
    "requests", "ok", "blocked_403", "blocked_429", "blocked_503",
    "captcha", "skeleton", "net_errors", "useful",
)


def _percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    s = sorted(values)
    if len(s) == 1:
        return s[0]
    k = (len(s) - 1) * pct
    lo = int(k)
    hi = min(lo + 1, len(s) - 1)
    frac = k - lo
    return s[lo] + (s[hi] - s[lo]) * frac


def ensure_metrics_table(conn) -> None:
    """Idempotent table + index creation. Mirrors database.ensure_* pattern."""
    try:
        with conn.cursor() as cur:
            cur.execute(_DDL)
        conn.commit()
        log.info("ensure_metrics_table: crawl_run_metrics ready.")
    except Exception as exc:
        log.warning("ensure_metrics_table failed (metrics disabled this run): %s", exc)
        try:
            conn.rollback()
        except Exception:
            pass


class _Phase:
    __slots__ = ("label", "started_at", "t0", "counts", "latencies",
                 "api_baseline", "budget_remaining")

    def __init__(self, label: str) -> None:
        self.label = label
        self.started_at = datetime.now(timezone.utc)
        self.t0 = time.monotonic()
        self.counts = dict.fromkeys(_COUNTER_KEYS, 0)
        self.latencies: list[float] = []
        self.api_baseline: dict | None = None
        self.budget_remaining: int | None = None


class MetricsCollector:
    """Single active phase; worker threads record into it under a lock."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._phase: _Phase | None = None
        self._api_client = None  # set via attach_api_client

    # ── phase lifecycle ──────────────────────────────────────────────────
    def start_phase(self, label: str) -> None:
        with self._lock:
            self._phase = _Phase(label)
            # Snapshot API stats so the phase row reports only its own delta.
            if self._api_client is not None:
                self._phase.api_baseline = dict(self._api_client.stats)
                try:
                    self._phase.budget_remaining = self._api_client.budget_remaining()
                except Exception:
                    self._phase.budget_remaining = None

    def attach_api_client(self, client) -> None:
        """Register a CreatorsClient so phase rows include its delta + budget."""
        with self._lock:
            self._api_client = client

    def end_phase(self, conn) -> None:
        with self._lock:
            ph = self._phase
            self._phase = None
        if ph is None:
            return
        p50 = _percentile(ph.latencies, 0.50)
        p95 = _percentile(ph.latencies, 0.95)

        api = {"api_calls": 0, "api_429": 0, "api_5xx": 0, "api_retries": 0, "api_throttle_s": 0.0}
        budget = ph.budget_remaining
        if self._api_client is not None:
            cur = self._api_client.stats
            base = ph.api_baseline or {}
            api["api_calls"] = cur.get("requests", 0) - base.get("requests", 0)
            api["api_429"] = cur.get("http_429", 0) - base.get("http_429", 0)
            api["api_5xx"] = cur.get("http_5xx", 0) - base.get("http_5xx", 0)
            api["api_retries"] = cur.get("retries", 0) - base.get("retries", 0)
            api["api_throttle_s"] = cur.get("throttle_wait_s", 0.0) - base.get("throttle_wait_s", 0.0)
            try:
                budget = self._api_client.budget_remaining()
            except Exception:
                pass

        ended_at = datetime.now(timezone.utc)
        wall_s = time.monotonic() - ph.t0
        row = (
            RUN_ID, ph.label, ph.started_at, ended_at, wall_s,
            ph.counts["requests"], ph.counts["ok"], ph.counts["blocked_403"],
            ph.counts["blocked_429"], ph.counts["blocked_503"], ph.counts["captcha"],
            ph.counts["skeleton"], ph.counts["net_errors"], ph.counts["useful"],
            p50, p95,
            api["api_calls"], api["api_429"], api["api_5xx"], api["api_retries"],
            api["api_throttle_s"], budget,
        )
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO crawl_run_metrics (
                        run_id, phase, started_at, ended_at, wall_s,
                        requests, ok, blocked_403, blocked_429, blocked_503,
                        captcha, skeleton, net_errors, useful,
                        latency_p50_ms, latency_p95_ms,
                        api_calls, api_429, api_5xx, api_retries, api_throttle_s,
                        budget_remaining
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    row,
                )
            conn.commit()
            log.info(
                "[metrics] %s — req=%d ok=%d blocked(403/429/503)=%d/%d/%d "
                "captcha=%d skeleton=%d net_err=%d useful=%d p50=%sms p95=%sms "
                "api_calls=%d api_429=%d budget=%s wall=%.0fs",
                ph.label, ph.counts["requests"], ph.counts["ok"],
                ph.counts["blocked_403"], ph.counts["blocked_429"], ph.counts["blocked_503"],
                ph.counts["captcha"], ph.counts["skeleton"], ph.counts["net_errors"],
                ph.counts["useful"],
                round(p50) if p50 else None, round(p95) if p95 else None,
                api["api_calls"], api["api_429"], budget, wall_s,
            )
        except Exception as exc:
            log.warning("[metrics] flush failed for phase %s: %s", ph.label, exc)
            try:
                conn.rollback()
            except Exception:
                pass

    # ── recording (called from worker threads) ──────────────────────────
    def record_http(self, kind: str, latency_ms: float | None = None) -> None:
        """kind: ok | blocked_403 | blocked_429 | blocked_503 | captcha |
        skeleton | net_error. Safe no-op if no phase is active."""
        with self._lock:
            ph = self._phase
            if ph is None:
                return
            ph.counts["requests"] += 1
            if kind == "ok":
                ph.counts["ok"] += 1
            elif kind == "net_error":
                ph.counts["net_errors"] += 1
            elif kind in ("blocked_403", "blocked_429", "blocked_503", "captcha", "skeleton"):
                ph.counts[kind] += 1
            if latency_ms is not None:
                ph.latencies.append(latency_ms)

    def record_useful(self, n: int = 1) -> None:
        with self._lock:
            if self._phase is not None:
                self._phase.counts["useful"] += n


# Module-level singleton used across the crawler.
collector = MetricsCollector()


def blocked_kind(status_code: int) -> str:
    return {403: "blocked_403", 429: "blocked_429", 503: "blocked_503"}.get(
        status_code, "blocked_503"
    )


__all__ = ["collector", "ensure_metrics_table", "RUN_ID", "blocked_kind"]
