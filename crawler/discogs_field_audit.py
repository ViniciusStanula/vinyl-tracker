"""What a Discogs release carries that we do not store yet.

The matcher audit answers "did we find the right record". This answers "having
found it, what are we leaving on the table" — barcode/GTIN confirmation, the
ficha tecnica (2xLP, 180g, Gatefold, Reissue), label, genres.

Writes nothing.

    python discogs_field_audit.py --n 30
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


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=30)
    ap.add_argument("--seed", type=int, default=11)
    args = ap.parse_args()

    conn = connect_with_retry()
    with conn.cursor() as cur:
        cur.execute(
            """SELECT slug, artista, titulo, ean, mb_label
               FROM "Disco"
               WHERE disponivel = TRUE AND (format IS NULL OR format = 'vinyl')
                 AND ean ~ '^[0-9]{13}$'
               ORDER BY md5(slug || %s) LIMIT %s""",
            (str(args.seed), args.n),
        )
        rows = cur.fetchall()

    dg = Discogs()
    have = Counter()
    ean_agree = ean_differ = ean_absent = 0
    label_agree = label_differ = label_only_dg = 0
    descs = Counter()
    genres = Counter()
    examples: list[str] = []

    for slug, artista, titulo, ean, mb_label in rows:
        try:
            results = dg.by_barcode(ean)
            hit = next((r for r in results
                        if verify_match(artista, titulo, r, from_barcode=True)), None)
            if not hit:
                continue
            rel = dg.release(hit["id"]) or {}
        except DiscogsUnavailable:
            continue
        if not rel:
            continue
        have["resolved"] += 1

        # --- barcode / GTIN confirmation -----------------------------------
        codes = {
            (i.get("value") or "").replace(" ", "").replace("-", "")
            for i in (rel.get("identifiers") or [])
            if (i.get("type") or "").lower() == "barcode"
        }
        if not codes:
            ean_absent += 1
        elif ean in codes:
            ean_agree += 1
        else:
            ean_differ += 1
            examples.append(f"EAN DIFFERS  ours={ean} discogs={sorted(codes)[:2]} "
                            f"{titulo[:34]}")

        # --- ficha tecnica --------------------------------------------------
        fmt = (rel.get("formats") or [{}])[0]
        for d in fmt.get("descriptions") or []:
            descs[d] += 1
        if fmt.get("qty") and str(fmt["qty"]).isdigit() and int(fmt["qty"]) > 1:
            have["multi_disc"] += 1
        if fmt.get("text"):
            have["format_text"] += 1  # "180 Gram", "Blue Translucent"

        # --- label ----------------------------------------------------------
        dg_label = next((l.get("name") for l in (rel.get("labels") or [])), None)
        if dg_label and mb_label:
            if dg_label.lower().strip() == (mb_label or "").lower().strip():
                label_agree += 1
            else:
                label_differ += 1
        elif dg_label and not mb_label:
            label_only_dg += 1

        for g in rel.get("genres") or []:
            genres[g] += 1
        have["has_notes"] += bool(rel.get("notes"))
        have["has_images"] += bool(rel.get("images"))
        have["has_released"] += bool(rel.get("released"))
        have["has_country"] += bool(rel.get("country"))

    n = have["resolved"] or 1
    print(f"resolved {have['resolved']}/{len(rows)}\n")
    print("BARCODE / GTIN")
    print(f"  discogs confirms our EAN : {ean_agree} ({100*ean_agree/n:.0f}%)")
    print(f"  discogs has a DIFFERENT  : {ean_differ}")
    print(f"  release lists no barcode : {ean_absent}")
    print("\nLABEL (we display mb_label today)")
    print(f"  agrees with MusicBrainz  : {label_agree}")
    print(f"  differs                  : {label_differ}")
    print(f"  discogs has one, MB none : {label_only_dg}")
    print("\nFICHA TECNICA — format descriptions available")
    for d, c in descs.most_common(18):
        print(f"  {c:4d}  {d}")
    print(f"\n  multi-disc sets detected : {have['multi_disc']}")
    print(f"  format free-text (180 Gram, colour): {have['format_text']}")
    print("\nGENRES (broader than styles)")
    for g, c in genres.most_common(10):
        print(f"  {c:4d}  {g}")
    print("\nOTHER")
    for k in ("has_released", "has_country", "has_notes", "has_images"):
        print(f"  {k:14s} {have[k]} ({100*have[k]/n:.0f}%)")
    if examples:
        print("\nEXAMPLES")
        for e in examples[:10]:
            print("  " + e)


if __name__ == "__main__":
    main()
