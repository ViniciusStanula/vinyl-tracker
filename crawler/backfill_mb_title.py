"""
backfill_mb_title.py — fill Disco.mb_title for rows matched before the column existed.

Without the matched release-group's own title there is no way to audit a match
after the fact. One MB lookup per DISTINCT mbid (~21.9k for ~26.4k rows), then
the title is written to every row sharing that mbid.

MusicBrainz allows ~1 request/sec, so a full run takes several hours. It is
resumable: rows already carrying mb_title are skipped, so re-running continues
where it stopped.

Usage:
    python backfill_mb_title.py                 # run until done
    python backfill_mb_title.py --limit 50      # smoke test
"""
import argparse
import io
import json
import logging
import sys
import time
import urllib.parse
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from db_retry import connect_with_retry

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s  %(levelname)-7s  %(message)s",
                    datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

MB_BASE = "https://musicbrainz.org/ws/2/"
USER_AGENT = "VinylTracker/1.0 ( vinicius.stanula@gmail.com )"


def fetch_title(mbid: str) -> str | None:
    url = f"{MB_BASE}release-group/{urllib.parse.quote(mbid)}?fmt=json"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return (json.loads(resp.read()).get("title") or "").strip() or None
    except Exception as exc:
        log.debug("fetch failed for %s: %s", mbid, exc)
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="stop after N mbids (0 = all)")
    ap.add_argument("--delay", type=float, default=1.1)
    args = ap.parse_args()

    conn = connect_with_retry()
    cur = conn.cursor()
    cur.execute(
        """SELECT DISTINCT mb_mbid FROM "Disco"
           WHERE mb_mbid IS NOT NULL AND mb_mbid <> '' AND mb_title IS NULL"""
    )
    mbids = [r[0] for r in cur.fetchall()]
    if args.limit:
        mbids = mbids[: args.limit]
    log.info("mbids needing a title: %d", len(mbids))

    done = failed = rows_written = 0
    t0 = time.monotonic()
    for i, mbid in enumerate(mbids, 1):
        title = fetch_title(mbid)
        time.sleep(args.delay)
        if not title:
            failed += 1
            continue
        try:
            cur.execute(
                'UPDATE "Disco" SET mb_title = %s WHERE mb_mbid = %s AND mb_title IS NULL',
                (title, mbid),
            )
            rows_written += cur.rowcount
        except Exception as exc:              # connection dropped mid-run
            log.warning("write failed (%s), reconnecting: %s", mbid, exc)
            conn.rollback()
            conn.close()
            conn = connect_with_retry()
            cur = conn.cursor()
            continue
        done += 1
        if i % 100 == 0:
            conn.commit()
            rate = i / max(time.monotonic() - t0, 1)
            eta = (len(mbids) - i) / max(rate, 0.001) / 60
            log.info("%d/%d mbids | %d rows | %d failed | ETA %.0f min",
                     i, len(mbids), rows_written, failed, eta)

    conn.commit()
    conn.close()
    log.info("done: %d titles fetched, %d rows written, %d failed", done, rows_written, failed)


if __name__ == "__main__":
    main()
