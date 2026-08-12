"""
repair_rotated_artists.py — repair artist names mangled by the old
normalize_artist(), which rotated on any comma at all.

"Tyler, The Creator" was stored as "The Creator Tyler", "Black Country, New
Road" as "New Road Black Country", "Emerson, Lake & Palmer" as "Lake & Palmer
Emerson". The comma is gone from the stored value, so the damage cannot be
undone by string rules alone — the split point is unrecoverable.

MusicBrainz is the oracle. A rotation is undone by moving a trailing chunk back
to the front, and each candidate is offered to MusicBrainz and accepted only if
it verifies against a real artist's name or one of its aliases. A name nobody
can confirm is left exactly as it is.

Searching for the mangled string directly does not work — MusicBrainz cannot
rank a scrambled phrase — which is why candidates are generated locally first.

DRY RUN BY DEFAULT. Renaming an artist changes its slug, and therefore the URL
of a page that may already be indexed, so the CSV is meant to be read before
anything is written.

Usage:
    python repair_rotated_artists.py --limit 600            # dry run + CSV
    python repair_rotated_artists.py --limit 600 --apply    # write
"""
import argparse
import csv
import logging
import time

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from database import get_connection
from enrich_artist_meta import _mb_get, _accept, RATE_LIMIT

log = logging.getLogger(__name__)

CSV_PATH = "repair_rotated_artists.csv"

# A real inversion moves one or two words. Beyond that the candidates stop
# resembling names and every extra one costs two MusicBrainz calls.
MAX_MOVE = 2


def candidates(name: str) -> list[str]:
    """Undo "A, B" -> "B A" by moving a trailing chunk back to the front."""
    w = name.split()
    if len(w) < 2:
        return []
    return [" ".join(w[-k:] + w[:-k]) for k in range(1, min(MAX_MOVE, len(w) - 1) + 1)]


def verify(candidate: str) -> dict | None:
    """Return the MusicBrainz artist this candidate genuinely names, or None."""
    for query in (f'artist:"{candidate}"', f'alias:"{candidate}"'):
        data = _mb_get("artist", {"query": query, "fmt": "json", "limit": 5})
        time.sleep(RATE_LIMIT)
        for artist in (data or {}).get("artists", []):
            if _accept(artist, candidate):
                return artist
    return None


def load_targets(conn, limit: int, offset: int = 0) -> list[tuple[str, int]]:
    """Artists MusicBrainz could not resolve, worst-affected first."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT c.artista, COUNT(*) AS n
            FROM "Disco" c
            JOIN "ArtistMeta" am ON am.artista = c.artista
            WHERE am.mbid IS NULL
              AND c.disponivel = TRUE
              AND (c.format IS NULL OR c.format = 'vinyl')
              AND c.price_count >= 5
            GROUP BY c.artista
            ORDER BY n DESC, c.artista
            LIMIT %s OFFSET %s
        """, (limit, offset))
        return cur.fetchall()


def apply_from_csv(conn, path: str) -> int:
    """
    Write exactly the rows in a reviewed CSV — no MusicBrainz calls, no
    re-deciding. What was read is what gets written, so a row deleted from the
    file during review is a row that never reaches the database.
    """
    with open(path, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    log.info("Applying %d reviewed repairs from %s.", len(rows), path)
    for r in rows:
        apply_repair(conn, r["old"], r["new"], r["mbid"], r["country"] or None)
        log.info("  %r -> %r (%s discos)", r["old"], r["new"], r["discos"])
    return len(rows)


def apply_repair(conn, old: str, new: str, mbid: str, country: str | None) -> None:
    """Rename the artist on its discos and move its ArtistMeta row across.

    ON CONFLICT covers the case where the correct name already exists as its own
    row — the repaired artist merges into it rather than colliding.
    """
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO "ArtistMeta" (artista, mbid, country, enriched_at)
            VALUES (%s, %s, %s, NOW())
            ON CONFLICT (artista) DO UPDATE SET
                mbid = COALESCE("ArtistMeta".mbid, EXCLUDED.mbid),
                country = COALESCE("ArtistMeta".country, EXCLUDED.country)
        """, (new, mbid, country))
        cur.execute('UPDATE "Disco" SET artista = %s WHERE artista = %s', (new, old))
        cur.execute('DELETE FROM "ArtistMeta" WHERE artista = %s', (old,))
    conn.commit()


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-7s  %(message)s",
                        datefmt="%H:%M:%S")
    p = argparse.ArgumentParser(description="Repair comma-rotated artist names")
    p.add_argument("--limit", type=int, default=600)
    p.add_argument("--offset", type=int, default=0,
                   help="Skip this many artists — for scanning past an earlier run")
    p.add_argument("--apply", action="store_true", help="Write the repairs (default: dry run)")
    p.add_argument("--from-csv", metavar="PATH",
                   help="Write exactly the rows in a reviewed CSV, without re-querying")
    args = p.parse_args()

    conn = get_connection()
    try:
        if args.from_csv:
            if not args.apply:
                log.info("--from-csv is a write; pass --apply to confirm.")
                return
            n = apply_from_csv(conn, args.from_csv)
            log.info("Done — applied %d reviewed repairs.", n)
            return

        targets = load_targets(conn, args.limit, args.offset)
        log.info("Checking %d unresolved artists (%s).", len(targets),
                 "APPLYING" if args.apply else "dry run")

        found = []
        for i, (artista, n) in enumerate(targets, 1):
            for cand in candidates(artista):
                artist = verify(cand)
                if not artist:
                    continue
                new_name = artist.get("name") or cand
                found.append({
                    "old": artista, "new": new_name, "discos": n,
                    "mbid": artist.get("id"), "country": artist.get("country") or "",
                })
                log.info("  REPAIR %r -> %r (%s, %d discos)",
                         artista, new_name, artist.get("country"), n)
                if args.apply:
                    apply_repair(conn, artista, new_name, artist.get("id"), artist.get("country"))
                break
            if i % 50 == 0:
                log.info("  %d/%d checked, %d repairs.", i, len(targets), len(found))

        with open(CSV_PATH, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=["old", "new", "discos", "mbid", "country"])
            w.writeheader()
            w.writerows(found)

        discos = sum(r["discos"] for r in found)
        log.info("Done — %d repairs covering %d discos. CSV: %s", len(found), discos, CSV_PATH)
        if not args.apply and found:
            log.info("Dry run. Review the CSV, then re-run with --apply.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
