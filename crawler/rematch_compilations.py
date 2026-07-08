"""
rematch_compilations.py — find & fix Disco rows whose MusicBrainz match is a
compilation/live release-group when a same-titled studio release exists.

Background: mb_enrich ranked matches by primary-type, but a compilation carries
primary-type "Album", so a same-titled best-of (e.g. Iron Maiden's 2004 comp)
could tie the 1980 studio debut on type+score and win. mb_enrich now demotes
secondary-type Compilation/Live/etc; this script repairs rows matched before
that fix.

Per row (Album-type, matched, available):
  1. Look up the current release-group by MBID (1 MB call).
     - If its secondary-types are clean (no Compilation/Live/...), skip.
  2. Otherwise re-run the fixed search_release_group. If it returns a DIFFERENT,
     non-demoted release-group, that's a proposed fix.
  3. --apply: write mb_mbid/date/primary_type/genres, refetch the tracklist,
     and (at end) fire one tag-based cache revalidation.

Dry-run by default: appends proposals to rematch_proposals.csv and never writes.

Checkpointing: every checked Disco id is appended to rematch_checked.txt, so a
re-run with --resume skips them. Safe to Ctrl-C and resume; the ~20k-row scan
takes several hours at MusicBrainz's 1 req/sec limit.

Usage:
    python rematch_compilations.py                 # dry-run, full scan
    python rematch_compilations.py --limit 300     # dry-run, first 300 unchecked
    python rematch_compilations.py --resume         # skip already-checked ids
    python rematch_compilations.py --apply --resume # write fixes + revalidate

Requires DATABASE_URL (+ REVALIDATE_URL/SECRET for --apply cache purge).
"""
import os
import csv
import json
import time
import argparse
import logging
import urllib.request

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from database import get_connection
from lastfm import clean_album_title
from mb_enrich import search_release_group, USER_AGENT, MB_BASE
from mb_tracklist import fetch_tracklist

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

DEMOTE_SECONDARY = {"Compilation", "Live", "Interview", "Remix",
                    "DJ-mix", "Mixtape/Street", "Demo"}

CHECKED_FILE = "rematch_checked.txt"
PROPOSALS_FILE = "rematch_proposals.csv"


def rg_lookup(mbid: str) -> dict | None:
    """Look up one release-group by MBID; returns the raw MB object or None."""
    url = f"{MB_BASE}release-group/{mbid}?fmt=json"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception as exc:
        log.debug("RG lookup failed for %s: %s", mbid, exc)
        return None


def is_demoted(secondary_types) -> bool:
    return bool(set(secondary_types or []) & DEMOTE_SECONDARY)


def load_checked() -> set[str]:
    if not os.path.exists(CHECKED_FILE):
        return set()
    with open(CHECKED_FILE, encoding="utf-8") as f:
        return {line.strip() for line in f if line.strip()}


def parse_args():
    p = argparse.ArgumentParser(description="Re-match compilation mis-matches to studio releases")
    p.add_argument("--delay", type=float, default=1.1, metavar="S",
                   help="Seconds between MB requests — keep >= 1.1 (default: 1.1)")
    p.add_argument("--limit", type=int, default=0, metavar="N",
                   help="Stop after checking N rows (0 = all)")
    p.add_argument("--resume", action="store_true",
                   help="Skip Disco ids already in " + CHECKED_FILE)
    p.add_argument("--apply", action="store_true",
                   help="Write fixes to the DB and revalidate (default: dry-run)")
    return p.parse_args()


def revalidate_prices():
    import requests
    url = os.environ.get("REVALIDATE_URL")
    secret = os.environ.get("REVALIDATE_SECRET")
    if not url or not secret:
        log.warning("REVALIDATE_URL/SECRET not set — skipping cache purge")
        return
    try:
        r = requests.post(url, json={"secret": secret, "tag": "prices"}, timeout=15)
        log.info("Revalidation: HTTP %s %s", r.status_code, r.text[:120])
    except Exception as exc:
        log.warning("Revalidation failed: %s", exc)


def main():
    args = parse_args()
    conn = get_connection()

    checked = load_checked() if args.resume else set()
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, asin, artista, titulo, mb_mbid, mb_first_release_date
               FROM "Disco"
               WHERE mb_mbid IS NOT NULL AND mb_mbid <> ''
                 AND disponivel = TRUE
                 AND mb_primary_type = 'Album'
               ORDER BY id"""
        )
        rows = cur.fetchall()
    rows = [r for r in rows if str(r[0]) not in checked]
    if args.limit:
        rows = rows[: args.limit]
    log.info("Checking %d Album-type rows (%d already checked, %s).",
             len(rows), len(checked), "APPLY" if args.apply else "dry-run")

    proposals_new = not os.path.exists(PROPOSALS_FILE)
    pf = open(PROPOSALS_FILE, "a", newline="", encoding="utf-8")
    pw = csv.writer(pf)
    if proposals_new:
        pw.writerow(["id", "asin", "artista", "titulo", "old_mbid", "old_date",
                     "old_secondary", "new_mbid", "new_date", "new_tracks"])
    chk = open(CHECKED_FILE, "a", encoding="utf-8")

    checked_n = suspect_n = fixed_n = 0
    changed = False
    t0 = time.monotonic()
    try:
        for did, asin, artista, titulo, mbid, old_date in rows:
            cur_rg = rg_lookup(mbid)
            time.sleep(args.delay)
            checked_n += 1
            sec = cur_rg.get("secondary-types") if cur_rg else None

            if cur_rg and is_demoted(sec):
                suspect_n += 1
                album = clean_album_title(titulo, artista)
                hit = search_release_group(artista, album)
                time.sleep(args.delay)  # search is one more MB call
                if hit and hit["mbid"] and hit["mbid"] != mbid:
                    new_lk = rg_lookup(hit["mbid"])
                    time.sleep(args.delay)
                    if new_lk and not is_demoted(new_lk.get("secondary-types")):
                        tl = fetch_tracklist(hit["mbid"])
                        time.sleep(args.delay)
                        pw.writerow([did, asin, artista, titulo, mbid, old_date,
                                     "|".join(sec or []), hit["mbid"],
                                     hit["first_release_date"], len(tl or [])])
                        pf.flush()
                        log.info("FIX %s | %s — %s → %s (%s)", asin, artista,
                                 old_date, hit["first_release_date"], hit["mbid"])
                        if args.apply:
                            with conn.cursor() as cur:
                                cur.execute(
                                    """UPDATE "Disco" SET mb_mbid=%s,
                                       mb_first_release_date=%s, mb_primary_type=%s,
                                       mb_genres=COALESCE(NULLIF(%s,''), mb_genres),
                                       mb_tracklist=%s
                                       WHERE id=%s""",
                                    (hit["mbid"], hit["first_release_date"],
                                     hit["primary_type"], hit["genres"],
                                     json.dumps(tl or [], ensure_ascii=False), did),
                                )
                            conn.commit()
                            changed = True
                        fixed_n += 1

            chk.write(f"{did}\n")
            chk.flush()

            if checked_n % 200 == 0:
                el = time.monotonic() - t0
                log.info("… %d checked, %d compilations, %d fixable, %.0f rows/min",
                         checked_n, suspect_n, fixed_n, checked_n / el * 60 if el else 0)
    finally:
        pf.close()
        chk.close()

    log.info("Done. %d checked, %d compilation-matched, %d %s.",
             checked_n, suspect_n, fixed_n,
             "fixed" if args.apply else "fixable (dry-run)")
    if args.apply and changed:
        revalidate_prices()
    conn.close()


if __name__ == "__main__":
    main()
