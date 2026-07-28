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
