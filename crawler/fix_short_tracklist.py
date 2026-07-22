"""
fix_short_tracklist.py — repair Disco rows whose mb_tracklist has only 1-2
tracks even though MusicBrainz primary-type is "Album".

Background: mb_tracklist.py fetches `release?release-group={mbid}&limit=1`,
i.e. ONE arbitrary release from the group. When a release-group also contains
a promo single/sampler release, MB can hand back that release instead of the
full album, leaving mb_tracklist with 1-2 short pop-length tracks (e.g.
Nipsey Hussle "Victory Lap" showing 1 track).

Suspect definition: mb_primary_type='Album', tracklist length in (1,2), and
average track length < 6 minutes (long-form/avant-garde albums with
genuinely 1-2 long tracks — Neil Young "Arc", Sleep "Dopesmoker" — are left
alone since a short pop-length average is the actual mismatch signal).

Per suspect row (1 MB call to list releases + 1 more only if a better
release is found):
  1. Browse all releases in the release-group with inc=media (cheap: gives
     track counts without full recordings).
  2. If the release already picked has the max track count, skip (no fix
     available at this release-group).
  3. Otherwise fetch recordings for the release with the most tracks and
     propose it as the replacement tracklist.

Dry-run by default: writes proposals to short_tracklist_proposals.csv.
--apply writes mb_tracklist for the reviewed ids.

Usage:
    python fix_short_tracklist.py                    # dry-run, scan all suspects
    python fix_short_tracklist.py --apply             # write fixes
    python fix_short_tracklist.py --apply --ids-file short_tracklist_proposals.csv
"""
import os
import csv
import json
import time
import argparse
import logging
import statistics
import urllib.request

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from database import get_connection
from mb_tracklist import fetch_tracklist, urllib_quote, MB_BASE, USER_AGENT

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

AVG_LENGTH_THRESHOLD_MS = 360_000  # 6 minutes


def pick_representative(releases: list[dict], old_count: int) -> dict | None:
    """
    Decide whether the stored tracklist is a wrong-release pick, and if so return
    the release that best represents the album.

    Comparing against the release-group's LONGEST release is wrong: a genuinely
    short album (Rainbow's 6-track "Rising") sits in a group that also holds a
    19-track deluxe reissue, and "take the longest" would swap the real LP for
    the boxset. The typical release is a far better reference — a mistakenly
    stored promo single sits well below it, while a short album IS it.

    So: take the median track count across the group's releases; only act when
    the stored count is well under that, and then return the release closest to
    the median rather than the fattest one.
    """
    counts = sorted(r["track_count"] for r in releases if r["track_count"] > 0)
    if not counts:
        return None
    median = statistics.median(counts)
    # Stored count is representative of this release-group — leave it alone.
    if old_count >= median * 0.6:
        return None
    return min(releases, key=lambda r: (abs(r["track_count"] - median), -r["track_count"]))


def fetch_suspects(conn, max_tracks: int):
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, artista, titulo, mb_mbid, mb_tracklist
               FROM "Disco"
               WHERE jsonb_array_length(mb_tracklist::jsonb) BETWEEN 1 AND %s
                 AND mb_primary_type = 'Album'
                 AND disponivel = TRUE""",
            (max_tracks,),
        )
        rows = cur.fetchall()

    suspects = []
    for id_, artista, titulo, mbid, tracklist_raw in rows:
        tracks = json.loads(tracklist_raw)
        lengths = [t.get("length") or 0 for t in tracks]
        avg = sum(lengths) / len(lengths) if lengths else 0
        if avg < AVG_LENGTH_THRESHOLD_MS:
            suspects.append({
                "id": id_, "artista": artista, "titulo": titulo,
                "mbid": mbid, "old_tracklist": tracks, "old_count": len(tracks),
            })
    return suspects


def fetch_release_track_counts(mbid: str) -> list[dict]:
    """Returns [{'release_id', 'track_count'}] for every release in the group."""
    url = (f"{MB_BASE}release?release-group={urllib_quote(mbid)}"
           f"&inc=media&limit=100&fmt=json")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
    except Exception as exc:
        log.debug("release list fetch failed for %s: %s", mbid, exc)
        return []

    results = []
    for rel in data.get("releases", []):
        track_count = sum(m.get("track-count", 0) for m in rel.get("media", []))
        results.append({"release_id": rel["id"], "track_count": track_count})
    return results


def fetch_tracklist_for_release(release_id: str) -> list[dict]:
    url = (f"{MB_BASE}release/{urllib_quote(release_id)}"
           f"?inc=recordings&fmt=json")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
    except Exception as exc:
        log.debug("tracklist fetch failed for release %s: %s", release_id, exc)
        return []

    media = data.get("media", [])
    return [
        {"title": tr["title"], "length": tr.get("length")}
        for m in media for tr in m.get("tracks", []) if tr.get("title")
    ]


def bulk_update_tracklist(conn, updates: list[dict]) -> int:
    if not updates:
        return 0
    with conn.cursor() as cur:
        cur.executemany(
            'UPDATE "Disco" SET mb_tracklist = %(tracklist)s WHERE id = %(id)s',
            updates,
        )
    conn.commit()
    return len(updates)


def parse_args():
    p = argparse.ArgumentParser(description="Fix Disco rows with a too-short mb_tracklist")
    p.add_argument("--apply", action="store_true", help="Write fixes (default: dry-run CSV only)")
    p.add_argument("--delay", type=float, default=1.1, metavar="S")
    p.add_argument("--max-tracks", type=int, default=6, metavar="N",
                   help="Inspect Album rows with up to N tracks (default: 6)")
    p.add_argument("--out", default="short_tracklist_proposals.csv")
    return p.parse_args()


def main():
    args = parse_args()
    conn = get_connection()

    suspects = fetch_suspects(conn, args.max_tracks)
    log.info("Found %d suspect rows (Album type, <=%d tracks, short avg length).",
             len(suspects), args.max_tracks)

    proposals = []
    updates = []

    for s in suspects:
        releases = fetch_release_track_counts(s["mbid"])
        time.sleep(args.delay)
        if not releases:
            continue

        best = pick_representative(releases, s["old_count"])
        if best is None:
            continue  # stored tracklist matches the group's typical release

        new_tracks = fetch_tracklist_for_release(best["release_id"])
        time.sleep(args.delay)
        if len(new_tracks) <= s["old_count"]:
            continue

        proposals.append({
            "id": s["id"], "artista": s["artista"], "titulo": s["titulo"],
            "mbid": s["mbid"], "old_count": s["old_count"],
            "new_count": len(new_tracks), "new_release_id": best["release_id"],
        })
        updates.append({"id": s["id"], "tracklist": json.dumps(new_tracks)})
        log.info("Fix found: %s - %s (%d -> %d tracks)",
                 s["artista"], s["titulo"], s["old_count"], len(new_tracks))

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=[
            "id", "artista", "titulo", "mbid", "old_count", "new_count", "new_release_id"])
        w.writeheader()
        w.writerows(proposals)
    log.info("Wrote %d proposals to %s.", len(proposals), args.out)

    if args.apply:
        n = bulk_update_tracklist(conn, updates)
        log.info("Applied %d tracklist fixes.", n)
    else:
        log.info("Dry-run only. Review %s, then re-run with --apply.", args.out)

    conn.close()


if __name__ == "__main__":
    main()
