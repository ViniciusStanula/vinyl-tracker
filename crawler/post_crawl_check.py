#!/usr/bin/env python3
"""
post_crawl_check.py - post-run data-quality monitor (CD incident, 2026-06-11).

Fails loudly (exit 1, which fails the GitHub Actions job) if any row inserted
during the check window is not positively marked vinyl or has a CD-like title.
With the ingestion + DB gates in place this should never fire; if it does, a
gate has a hole and the run must be investigated.
"""
import os
import sys

import psycopg2

WINDOW_HOURS = float(os.environ.get("POST_CRAWL_WINDOW_HOURS", "26"))
# Rows inserted before the allowlist gate deployed are exempt — they predate
# the invariant (format='vinyl' on every new row) and are handled by the
# format sweep instead.
GATE_DEPLOYED_AT = os.environ.get("FORMAT_GATE_EPOCH", "2026-06-12T00:00:00Z")
# Postgres regex (\m / \M are Postgres word boundaries, not Python's).
CD_TITLE_SQL = (
    r"\mcds?\M|\[cd\]|\(cd\)|compact disc|cd duplo|cd triplo"
    r"|audio cd|áudio cd"
)


def main() -> None:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT asin, titulo, format
            FROM "Disco"
            WHERE "createdAt" > NOW() - (%s * INTERVAL '1 hour')
              AND "createdAt" > %s::timestamptz
              AND (format IS DISTINCT FROM 'vinyl' OR titulo ~* %s)
            ORDER BY "createdAt" DESC
            """,
            (WINDOW_HOURS, GATE_DEPLOYED_AT, CD_TITLE_SQL),
        )
        rows = cur.fetchall()
    conn.close()

    if rows:
        print(
            f"POST-CRAWL CHECK FAILED: {len(rows)} suspicious insertion(s) "
            f"in the last {WINDOW_HOURS:.0f}h:"
        )
        for asin, titulo, fmt in rows[:50]:
            print(f"  {asin}  format={fmt}  {(titulo or '')[:70]}")
        sys.exit(1)

    print(f"post-crawl check OK: no non-vinyl insertions in the last {WINDOW_HOURS:.0f}h.")


if __name__ == "__main__":
    main()
