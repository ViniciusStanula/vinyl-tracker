"""When a barcode maps to several releases, do they actually disagree?

Pressing-level fields are dropped whenever a barcode returns more than one
release, because Evangelion "Finally" returns five that differ on country. That
gate costs the field on roughly 40% of records.

But "several releases" is not the same as "several answers". Two entries for
the same pressing — a duplicate, or a minor variant — agree on country, label
and catalogue number, and dropping the field there is pure loss.

This measures, per field, how often the siblings agree. Anything that agrees
nearly always can be taken by consensus instead of being thrown away, the same
way pressing_invariant already does for the barcode-less path.

Writes nothing. Costs one release fetch per sibling, so keep --n modest.

    python discogs_sibling_consensus.py --n 25
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
    clean_catno,
    verify_match,
)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=25)
    ap.add_argument("--seed", type=int, default=41)
    ap.add_argument("--max-siblings", type=int, default=4)
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
    disagreements: list[str] = []

    for slug, artista, titulo, ean in rows:
        try:
            results = dg.by_barcode(ean)
        except DiscogsUnavailable:
            continue
        sibs = [r for r in results
                if verify_match(artista, titulo, r, from_barcode=True)]
        if not sibs:
            continue
        if len(sibs) == 1:
            stats["single_pressing"] += 1
            continue
        if len(sibs) > args.max_siblings:
            stats["too_many_to_fetch"] += 1
            continue

        stats["multi_pressing"] += 1
        vals: dict[str, set] = {"country": set(), "label": set(),
                                "catno": set(), "format": set(), "year": set()}
        try:
            for r in sibs:
                rel = dg.release(r["id"]) or {}
                if not rel:
                    continue
                vals["country"].add((rel.get("country") or "").strip() or None)
                vals["label"].add(
                    next((l.get("name") for l in (rel.get("labels") or [])), None))
                vals["catno"].add(clean_catno(
                    next((l.get("catno") for l in (rel.get("labels") or [])), None)))
                fmt = (rel.get("formats") or [{}])[0]
                vals["format"].add(", ".join(fmt.get("descriptions") or []) or None)
                vals["year"].add((rel.get("released") or "")[:4] or None)
        except DiscogsUnavailable:
            continue

        for field, seen in vals.items():
            real = {v for v in seen if v}
            if len(real) <= 1:
                stats[f"agree_{field}"] += 1
            else:
                stats[f"DIFFER_{field}"] += 1
                if field in ("country", "label"):
                    disagreements.append(
                        f"{field:8s} {titulo[:34]:36s} {sorted(real)[:3]}")

    print(f"sampled {len(rows)}\n")
    print(f"  single pressing (gate not engaged) : {stats['single_pressing']}")
    print(f"  multi pressing  (gate drops data)  : {stats['multi_pressing']}")
    print(f"  too many siblings to fetch         : {stats['too_many_to_fetch']}")
    m = stats["multi_pressing"] or 1
    print("\nAmong multi-pressing records, do the siblings agree?")
    for field in ("country", "label", "catno", "format", "year"):
        a, d = stats[f"agree_{field}"], stats[f"DIFFER_{field}"]
        print(f"  {field:8s} agree {a:3d}  differ {d:3d}   "
              f"-> consensus safe on {100*a/m:.0f}%")
    if disagreements:
        print("\nDISAGREEMENTS")
        for x in disagreements[:12]:
            print("  " + x)


if __name__ == "__main__":
    main()
