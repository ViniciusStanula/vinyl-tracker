"""
db_retry.py — get_connection() with backoff for the shared Supabase pooler.

The pooler (port 6543) caps clients at 400 across *all* consumers, so admin
scripts run from a laptop compete with production traffic and Vercel builds.
That surfaces as a hard connect failure:

    FATAL: (EMAXCONN) max client connections reached, limit: 400

It clears on its own within seconds-to-minutes, so a one-shot connect turns a
transient into a crashed batch job. Retry instead.
"""
import logging
import time

import psycopg2

from database import get_connection

log = logging.getLogger(__name__)


def connect_with_retry(attempts: int = 8, base_delay: float = 4.0):
    """get_connection() retrying on pooler saturation, with linear backoff."""
    last = None
    for i in range(attempts):
        try:
            return get_connection()
        except Exception as exc:
            last = exc
            if "EMAXCONN" not in str(exc) and "max client connections" not in str(exc):
                raise
            wait = base_delay * (i + 1)
            print(f"  pooler saturated, retry {i + 1}/{attempts} in {wait:.0f}s")
            time.sleep(wait)
    raise last


class ResilientConn:
    """A connection that reopens itself when the pooler drops it.

    This job holds one connection for 30+ hours. Supabase's pooler does not:
    the first full run died after ten minutes with "server closed the
    connection unexpectedly", 134 records in. connect_with_retry covers a
    failure to OPEN a connection (EMAXCONN), which is a different thing —
    nothing was reopening one that went away mid-loop.

    Reads still go through .cursor(); they all happen at startup, before there
    has been time to lose anything. Writes go through .write(), which
    reconnects and replays the statement, because a dropped connection only
    surfaces when the next execute runs.

    autocommit stays on, so a drop can never cost more than the statement in
    flight — every record already written stays written, and the run resumes
    from where it stopped.
    """

    def __init__(self):
        self._open()

    def _open(self) -> None:
        self.conn = connect_with_retry()
        self.conn.autocommit = True

    def cursor(self):
        return self.conn.cursor()

    # Pass-throughs for the rest of the connection interface. autocommit is on,
    # so commit() is a no-op for the write path, but callers still use these:
    # ensure_columns() commits its DDL explicitly, and fetch_artist_urls closes
    # at the end. Each was missing once and crashed a run that had otherwise
    # done all its work — the second one after the class was already scheduled
    # to run daily, where it would have reported failure on a successful run.
    def commit(self) -> None:
        self.conn.commit()

    def rollback(self) -> None:
        self.conn.rollback()

    def close(self) -> None:
        self.conn.close()

    def write(self, sql: str, params: tuple = ()) -> None:
        for attempt in (1, 2, 3):
            try:
                with self.conn.cursor() as cur:
                    cur.execute(sql, params)
                return
            except (psycopg2.OperationalError, psycopg2.InterfaceError) as exc:
                log.warning("DB connection lost (attempt %s), reopening: %s",
                            attempt, str(exc).strip().splitlines()[0])
                time.sleep(2 * attempt)
                self._open()
        raise RuntimeError("database unreachable after 3 reconnects")
