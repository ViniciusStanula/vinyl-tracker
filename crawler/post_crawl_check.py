#!/usr/bin/env python3
"""
post_crawl_check.py - post-run data-quality monitor (CD incident, 2026-06-11).

Two severities:

  FATAL (exit 1, fails the GitHub Actions job) — a row inserted in the window
    that is NOT positively marked vinyl (format IS DISTINCT FROM 'vinyl'). This
    is the real leak class from the June incident: the ingestion allowlist must
    never let a non-vinyl format through.

  WARNING (logged, exit 0) — a format='vinyl' row whose TITLE looks like a CD
    with no vinyl keyword. This is almost always Amazon's injected distributor
    title ("The Orchard - Album [CD]") on a page whose selected format swatch is
    vinyl; detect_format reads that swatch and is authoritative, so these are
    legitimate vinyl. The title alone cannot distinguish them from a true CD
    leak, so it must not gate CI — it is surfaced for human review instead.
"""
import os
import sys

from database import get_connection

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
# Vinyl signals in a title — if present alongside "CD", the row is a bundle,
# not a false insertion. Matches the same signals as domain._VINYL_TITLE_RE.
# The "with CD" markers (W/CD, +CD, com CD, bonus CD) denote a vinyl product
# shipped with a bonus CD — a legitimate vinyl bundle, not CD contamination.
VINYL_TITLE_SQL = (
    r"vinil|vinyl|\mlp\M|\mlps\M|gatefold|180\s*g|picture.disc"
    r"|disco.de.vinil|single.de.vinil|7\"|10\"|12\"|33.?rpm|45.?rpm"
    r"|w/\s*cd|with\s*cd|\+\s*cd|com\s*cd|bonus\s*cd"
)


def main() -> None:
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                asin,
                titulo,
                format,
                -- fatal: not positively marked vinyl (real leak class).
                (format IS DISTINCT FROM 'vinyl') AS is_fatal
            FROM "Disco"
            WHERE "createdAt" > NOW() - (%s * INTERVAL '1 hour')
              AND "createdAt" > %s::timestamptz
              AND (
                format IS DISTINCT FROM 'vinyl'
                OR (
                  -- vinyl row with CD title signal but NO vinyl title signal:
                  -- injected distributor title, swatch-confirmed vinyl. Warn only.
                  titulo ~* %s AND NOT titulo ~* %s
                )
              )
            ORDER BY "createdAt" DESC
            """,
            (WINDOW_HOURS, GATE_DEPLOYED_AT, CD_TITLE_SQL, VINYL_TITLE_SQL),
        )
        rows = cur.fetchall()
    conn.close()

    fatal = [(a, t, f) for a, t, f, is_fatal in rows if is_fatal]
    warn = [(a, t, f) for a, t, f, is_fatal in rows if not is_fatal]

    if warn:
        print(
            f"post-crawl WARNING: {len(warn)} vinyl row(s) with a CD-like title "
            f"in the last {WINDOW_HOURS:.0f}h (likely injected distributor titles "
            f"— format swatch already vetted these as vinyl):"
        )
        for asin, titulo, fmt in warn[:50]:
            print(f"  {asin}  format={fmt}  {(titulo or '')[:70]}")

    if fatal:
        print(
            f"POST-CRAWL CHECK FAILED: {len(fatal)} non-vinyl insertion(s) "
            f"in the last {WINDOW_HOURS:.0f}h:"
        )
        for asin, titulo, fmt in fatal[:50]:
            print(f"  {asin}  format={fmt}  {(titulo or '')[:70]}")
        sys.exit(1)

    print(f"post-crawl check OK: no non-vinyl insertions in the last {WINDOW_HOURS:.0f}h.")


if __name__ == "__main__":
    main()
