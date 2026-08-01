"""Can artist+title rescue the records whose barcode finds nothing?

The barcode pass leaves a real share unresolved — Amazon sells pressings
Discogs has not catalogued under that code, and some of our EANs are wrong.
Those rows are currently retired with nothing.

The artist+title fallback already exists for records that never had a barcode,
and it deliberately stores only pressing-invariant fields (styles, year),
because a title search identifies the album, not the disc. This measures
whether pointing it at barcode MISSES is worth the extra call.

Writes nothing.

    python discogs_miss_fallback.py --n 60
"""
import argparse
import io
import sys
from collections import Counter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from db_retry import connect_with_retry
from discogs_enrich import (
    Discogs,
    DiscogsUnavailable,
    pressing_invariant,
    verify_match,
)
from lastfm import clean_album_title


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=60)
    ap.add_argument("--seed", type=int, default=31)
    args = ap.parse_args()

    conn = connect_with_retry()
    with conn.cursor() as cur:
        cur.execute(
            """SELECT slug, artista, titulo, ean
               FROM "Disco"
               WHERE disponivel = TRUE AND (format IS NULL OR format = 'vinyl')
                 AND ean ~ '^[0-9]{13}$'
                 AND artista !~* 'artista n[ãa]o identificad'
               ORDER BY md5(slug || %s) LIMIT %s""",
            (str(args.seed), args.n),
        )
        rows = cur.fetchall()

    dg = Discogs()
    stats = Counter()
    rescued: list[str] = []

    for slug, artista, titulo, ean in rows:
        try:
            results = dg.by_barcode(ean)
        except DiscogsUnavailable:
            stats["unavailable"] += 1
            continue
        hit = next((r for r in results
                    if verify_match(artista, titulo, r, from_barcode=True)), None)
        if hit:
            stats["barcode_ok"] += 1
            continue

        stats["barcode_miss"] += 1
        query = clean_album_title(titulo, artista) or titulo
        try:
            alt = dg.by_artist_title(artista, query)
        except DiscogsUnavailable:
            stats["unavailable"] += 1
            continue
        verified = [r for r in alt if verify_match(artista, titulo, r)]
        if not verified:
            stats["fallback_found_nothing"] += 1
            continue
        inv = pressing_invariant(verified)
        if inv:
            stats["fallback_AGREED"] += 1
            rescued.append(
                f"{artista[:18]:20s}| {titulo[:32]:34s} "
                f"{len(verified)} pressings year={inv.get('year') or '-'} "
                f"styles={(inv.get('styles') or '-')[:36]}")
        else:
            stats["fallback_ambiguous"] += 1

    print(f"sampled {len(rows)}")
    for k in sorted(stats):
        print(f"  {k:26s} {stats[k]}")
    miss = stats["barcode_miss"] or 1
    print(f"\n  of {stats['barcode_miss']} barcode misses, "
          f"{stats['fallback_AGREED']} rescued "
          f"({100*stats['fallback_AGREED']/miss:.0f}%)")
    if rescued:
        print("\nRESCUED (styles + original year only — not pressing fields)")
        for r in rescued[:20]:
            print("  " + r)


if __name__ == "__main__":
    main()
