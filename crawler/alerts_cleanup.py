"""
alerts_cleanup.py — Delete unconfirmed alert subscriptions older than 7 days.

Runs daily via GitHub Actions. Removes rows where status='pending' and
created_at < now() - 7 days. Confirmed subscriptions are never touched here —
only the user can delete those (LGPD right to erasure, via manage link).
"""
import sys
import logging

from database import get_connection

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger(__name__)


def cleanup_pending(days: int = 7) -> int:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL statement_timeout = 0")
            cur.execute(
                """
                DELETE FROM alert_subscriptions
                WHERE status = 'pending'
                  AND created_at < NOW() - (%s * INTERVAL '1 day')
                """,
                (days,),
            )
            deleted = cur.rowcount
        conn.commit()
        return deleted
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        n = cleanup_pending()
        log.info("Deleted %d unconfirmed alert subscriptions older than 7 days.", n)
    except Exception as exc:
        log.error("alerts_cleanup failed: %s", exc)
        sys.exit(1)
