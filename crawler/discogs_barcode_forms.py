"""Do barcode misses recover when searched in another form?

Discogs stores a UPC-A as 12 digits, while our column pads it to 13 with a
leading zero: our 0602448996183 is their 602448996183. Editors also type them
with spaces and hyphens. If the index is literal about that, a share of our
"not found" results are the same record under a different spelling of the code.

Writes nothing. Reports recovery rate per form so the enrichment only pays for
the fallbacks that actually earn their calls.

    python discogs_barcode_forms.py --n 40
"""
import argparse
import io
import sys
from collections import Counter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from db_retry import connect_with_retry
from discogs_enrich import Discogs, DiscogsUnavailable, verify_match


def forms(ean: str) -> list[tuple[str, str]]:
    """Alternate spellings of one barcode, most likely first."""
    out = [("as-stored", ean)]
    if ean.startswith("0"):
        out.append(("upc12", ean[1:]))
    else:
        out.append(("ean13-padded", "0" + ean))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=40)
    ap.add_argument("--seed", type=int, default=21)
    args = ap.parse_args()

    conn = connect_with_retry()
    with conn.cursor() as cur:
        cur.execute(
            """SELECT slug, artista, titulo, ean
               FROM "Disco"
               WHERE disponivel = TRUE AND (format IS NULL OR format = 'vinyl')
                 AND ean ~ '^[0-9]{13}$'
               ORDER BY md5(slug || %s) LIMIT %s""",
            (str(args.seed), args.n),
        )
        rows = cur.fetchall()

    dg = Discogs()
    stats = Counter()
    recovered: list[str] = []

    for slug, artista, titulo, ean in rows:
        found_on = None
        for name, code in forms(ean):
            try:
                results = dg.by_barcode(code)
            except DiscogsUnavailable:
                stats["unavailable"] += 1
                break
            if not results:
                continue
            hit = next((r for r in results
                        if verify_match(artista, titulo, r, from_barcode=True)), None)
            if hit:
                found_on = name
                break
        if found_on is None:
            stats["still_missing"] += 1
            continue
        stats[f"found_on_{found_on}"] += 1
        if found_on != "as-stored":
            recovered.append(f"{found_on:14s} {ean} -> {titulo[:44]}")

    print(f"sampled {len(rows)}")
    for k in sorted(stats):
        print(f"  {k:24s} {stats[k]}")
    base = stats["found_on_as-stored"]
    extra = sum(v for k, v in stats.items()
                if k.startswith("found_on_") and k != "found_on_as-stored")
    print(f"\n  baseline (as stored)  : {base}/{len(rows)}")
    print(f"  recovered by a retry  : {extra}")
    if recovered:
        print("\nRECOVERED")
        for r in recovered[:20]:
            print("  " + r)


if __name__ == "__main__":
    main()
