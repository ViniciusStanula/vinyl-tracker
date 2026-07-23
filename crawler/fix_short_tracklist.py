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


def pick_representative(releases: list[dict], old_count: int, two_sided: bool = False) -> dict | None:
    """
    Decide whether the stored tracklist is a wrong-release pick, and if so return
    the release that best represents THIS record.

    We catalogue vinyl, so the vinyl pressing is the right reference — not the
    longest release, and not the median across every format. Both of those get
    it wrong in opposite directions:

      Rainbow "Rising" — all six 12" Vinyl releases carry 6 tracks; the 19-track
      versions are CD/Digital deluxe editions. "Longest" would swap the real LP
      for a boxset, and the all-format median (6..19) would too.

      No-Man "Schoolyard Ghosts" — the 2LP vinyl is 11 tracks while CD deluxes
      run to 27, so the all-format median (15.5) overshoots the actual record.

    So: restrict to vinyl releases when the group has any, else fall back to the
    median across all formats (e.g. Ne-Yo's "In My Own Words" has no vinyl
    release in MusicBrainz at all). Only act when the stored count sits well
    below that reference, then return the release closest to it.
    """
    candidates = [r for r in releases if r["is_vinyl"] and r["track_count"] > 0]
    if not candidates:
        candidates = [r for r in releases if r["track_count"] > 0]
    if not candidates:
        return None

    target = statistics.median(sorted(r["track_count"] for r in candidates))

    if two_sided:
        # Audit mode: the stored tracklist can also be too LONG — a CD deluxe
        # picked where the vinyl pressing is shorter. Flag either direction.
        if target * 0.6 <= old_count <= target * 1.4:
            return None
    elif old_count >= target * 0.6:
        # Stored count already matches the reference pressing — leave it alone.
        return None

    return min(candidates, key=lambda r: (abs(r["track_count"] - target), -r["track_count"]))


def fetch_suspects(conn, max_tracks: int, ids: list[str] | None = None):
    """
    Candidate rows to re-check. Normally Album rows with few tracks and a short
    average length; with `ids`, exactly those rows regardless of either gate —
    used to re-audit rows written by an earlier, wronger heuristic.
    """
    with conn.cursor() as cur:
        if ids:
            cur.execute(
                """SELECT id, artista, titulo, mb_mbid, mb_tracklist
                   FROM "Disco"
                   WHERE id = ANY(%s) AND mb_tracklist IS NOT NULL""",
                (ids,),
            )
        else:
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
        if ids or avg < AVG_LENGTH_THRESHOLD_MS:
            suspects.append({
                "id": id_, "artista": artista, "titulo": titulo,
                "mbid": mbid, "old_tracklist": tracks, "old_count": len(tracks),
            })
    return suspects


def fetch_release_track_counts(mbid: str) -> list[dict]:
    """Returns [{'release_id', 'track_count', 'is_vinyl'}] for every release in the group."""
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
        media = rel.get("media", [])
        track_count = sum(m.get("track-count", 0) for m in media)
        # MB spells vinyl formats as '12" Vinyl', '7" Vinyl', 'Vinyl', 'LP'.
        is_vinyl = any(
            "vinyl" in str(m.get("format") or "").lower()
            or str(m.get("format") or "").upper() == "LP"
            for m in media
        )
        results.append({"release_id": rel["id"], "track_count": track_count, "is_vinyl": is_vinyl})
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
    p.add_argument("--ids-file", metavar="PATH",
                   help="Re-audit exactly these Disco ids (CSV with an 'id' column, or "
                        "one id per line), ignoring the track-count/length gates and "
                        "flagging tracklists that are too long as well as too short")
    p.add_argument("--out", default="short_tracklist_proposals.csv")
    return p.parse_args()


def read_ids(path: str) -> list[str]:
    """Accepts a CSV with an 'id' column, or a plain one-id-per-line file."""
    with open(path, newline="", encoding="utf-8") as f:
        head = f.readline()
        f.seek(0)
        if "id" in head.split(","):
            return [r["id"].strip() for r in csv.DictReader(f) if r.get("id", "").strip()]
        return [ln.strip() for ln in f if ln.strip()]


def main():
    args = parse_args()
    conn = get_connection()

    ids = read_ids(args.ids_file) if args.ids_file else None
    suspects = fetch_suspects(conn, args.max_tracks, ids)
    if ids:
        log.info("Re-auditing %d rows from %s (two-sided: too long or too short).",
                 len(suspects), args.ids_file)
    else:
        log.info("Found %d suspect rows (Album type, <=%d tracks, short avg length).",
                 len(suspects), args.max_tracks)

    proposals = []
    updates = []

    for s in suspects:
        releases = fetch_release_track_counts(s["mbid"])
        time.sleep(args.delay)
        if not releases:
            continue

        best = pick_representative(releases, s["old_count"], two_sided=bool(ids))
        if best is None:
            continue  # stored tracklist matches the reference pressing

        new_tracks = fetch_tracklist_for_release(best["release_id"])
        time.sleep(args.delay)
        if not new_tracks or len(new_tracks) == s["old_count"]:
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
