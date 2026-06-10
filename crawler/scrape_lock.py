"""
scrape_lock.py — cross-process guard so two runs don't scrape Amazon at once
───────────────────────────────────────────────────────────────────────────
Step D. An expiry-based row lock in Postgres (table scrape_locks). Chosen over
session/xact advisory locks because the Supabase transaction pooler (port 6543)
does not preserve session-level advisory locks — the backend returns to the pool
between statements and the lock is lost. A row lock works over any pooling mode.

Crash-safe: the lock row carries an expires_at TTL, so if a holder dies the lock
auto-frees once the TTL lapses — no stale lock, no manual cleanup. Acquisition is
a single atomic upsert (ON CONFLICT ... WHERE expires_at < now()).

Used so the continuous main crawl's Phase-1 listing scrape and the daily Last.fm
discovery scrape can't hammer amazon.com.br simultaneously. Non-blocking:
.acquired tells you whether you hold it. Fail-open on infra error so a DB hiccup
never halts the crawler.
"""
from __future__ import annotations

import os
import uuid
import logging

from database import get_connection

log = logging.getLogger(__name__)

LOCK_NAME = os.environ.get("AMAZON_SCRAPE_LOCK_NAME", "amazon_storefront")
# TTL must exceed a normal scrape's duration but bound how long a crashed holder
# blocks others. Main Phase 1 and daily discovery both finish well under this.
LOCK_TTL_S = int(os.environ.get("AMAZON_SCRAPE_LOCK_TTL_S", "2700") or "2700")

_DDL = """
CREATE TABLE IF NOT EXISTS scrape_locks (
    name        TEXT PRIMARY KEY,
    holder      TEXT NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);
"""


def ensure_scrape_lock_table(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(_DDL)
    conn.commit()


class ScrapeLock:
    def __init__(self, name: str = LOCK_NAME, ttl_s: int = LOCK_TTL_S,
                 label: str = "scrape") -> None:
        self.name = name
        self.ttl_s = ttl_s
        self.label = label
        self.token = uuid.uuid4().hex
        self.acquired = False
        self._conn = None

    def __enter__(self) -> "ScrapeLock":
        try:
            self._conn = get_connection()
            ensure_scrape_lock_table(self._conn)
            with self._conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO scrape_locks (name, holder, acquired_at, expires_at)
                    VALUES (%s, %s, now(), now() + (%s * INTERVAL '1 second'))
                    ON CONFLICT (name) DO UPDATE
                        SET holder = EXCLUDED.holder,
                            acquired_at = now(),
                            expires_at = EXCLUDED.expires_at
                        WHERE scrape_locks.expires_at < now()
                    RETURNING holder
                    """,
                    (self.name, self.token, self.ttl_s),
                )
                row = cur.fetchone()
            self._conn.commit()
            self.acquired = bool(row and row[0] == self.token)
            if self.acquired:
                log.info("[scrape-lock] acquired (%s, ttl=%ds).", self.label, self.ttl_s)
            else:
                log.warning("[scrape-lock] held by another run (%s) — yielding storefront work.",
                            self.label)
        except Exception as exc:
            # Fail open: never let a lock hiccup halt scraping.
            log.warning("[scrape-lock] infra error — proceeding without lock: %s", exc)
            self.acquired = True
            self._conn = None
        return self

    def __exit__(self, *exc) -> bool:
        if self._conn is not None:
            try:
                with self._conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM scrape_locks WHERE name = %s AND holder = %s",
                        (self.name, self.token),
                    )
                self._conn.commit()
            except Exception:
                pass
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = None
        return False


__all__ = ["ScrapeLock", "ensure_scrape_lock_table", "LOCK_NAME", "LOCK_TTL_S"]
