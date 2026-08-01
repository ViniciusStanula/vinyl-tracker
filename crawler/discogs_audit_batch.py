"""Dry-run batches of records against Discogs to harden the enrichment.

Writes nothing. Samples records across categories, runs the real resolution
path, and applies an automated oracle to every result so failure modes surface
without hand-checking each row.

The oracle: after the release fetch, compare the RELEASE's own artist+title
against ours using the strict tokenizer. Search-result verification cannot
catch a bad release fetch, because it reads the search title — that is exactly
how the master-id bug stayed invisible. Comparing the fetched object closes
that loop.

Usage:
    python discogs_audit_batch.py --n 40
    python discogs_audit_batch.py --n 40 --category game
    python discogs_audit_batch.py --n 40 --seed 7
"""
import argparse
import io
import json
import random
import re
import sys
from collections import Counter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from db_retry import connect_with_retry
from discogs_enrich import (
    Discogs,
    _is_latin_comparable,
    _norm,
    _tokens,
    clean_catno,
    verify_match,
)


def ean13_ok(code: str) -> bool:
    """EAN-13 check digit. Junk barcodes are common in the Amazon feed.

    "0000000000208" is syntactically 13 digits and matched the column regex,
    so it was searched: Discogs returned 50 unrelated releases for it.
    """
    if not (code or "").isdigit() or len(code) != 13:
        return False
    digits = [int(c) for c in code]
    check = (10 - sum(d * (3 if i % 2 else 1) for i, d in enumerate(digits[:12])) % 10) % 10
    return check == digits[12]


def low_entropy(code: str) -> bool:
    """Placeholder barcodes: all zeros, repeated digit, sequential runs."""
    return len(set(code)) <= 3


def release_matches_ours(artista: str, titulo: str, rel: dict) -> bool | None:
    """Does the FETCHED release look like our record? None = cannot tell."""
    rel_artists = " ".join(a.get("name", "") for a in (rel.get("artists") or []))
    rel_title = rel.get("title") or ""
    # A release catalogued in Japanese cannot be compared against our romanised
    # title: Pom Poko is stored as 平成狸合戦ぽんぽこ サウンドトラック. Both of
    # the "wrong albums" this oracle first reported were correct matches of
    # exactly that kind.
    # Judge the title alone: the release object often carries a romanised
    # artist ("Joe Hisaishi") over a Japanese title (千と千尋の神隠し), which
    # reads as comparable overall and produced a false "wrong album".
    if not _is_latin_comparable(rel_title):
        return None
    theirs = _tokens(rel_artists) | _tokens(rel_title)
    ours = _tokens(artista) | _tokens(titulo)
    if not ours or not theirs:
        return None
    return bool(ours & theirs)


def sample(conn, n: int, category: str | None, seed: int) -> list[tuple]:
    where = ["disponivel = TRUE", "(format IS NULL OR format = 'vinyl')",
             "ean ~ '^[0-9]{13}$'"]
    params: list = []
    if category:
        where.append("(lastfm_tags ILIKE %s OR titulo ILIKE %s)")
        params += [f"%{category}%", f"%{category}%"]
    with conn.cursor() as cur:
        cur.execute(
            f"""SELECT slug, artista, titulo, ean, lastfm_tags
                FROM "Disco" WHERE {' AND '.join(where)}""",
            params,
        )
        rows = cur.fetchall()
    random.Random(seed).shuffle(rows)
    return rows[:n]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=40)
    ap.add_argument("--category")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    conn = connect_with_retry()
    rows = sample(conn, args.n, args.category, args.seed)
    dg = Discogs()
    print(f"batch: {len(rows)} records | category={args.category or 'any'} "
          f"| seed={args.seed}\n")

    stats = Counter()
    problems: list[str] = []

    for slug, artista, titulo, ean, tags in rows:
        if not ean13_ok(ean):
            stats["bad_checksum"] += 1
        if low_entropy(ean):
            stats["low_entropy_barcode"] += 1
            problems.append(f"JUNK-BARCODE  {ean}  {artista[:20]} | {titulo[:34]}")
            continue

        results = dg.by_barcode(ean)
        if not results:
            stats["no_results"] += 1
            continue
        stats["searched"] += 1
        if len(results) > 15:
            stats["barcode_not_discriminating"] += 1
            problems.append(
                f"BARCODE->{len(results):3d} RESULTS  {ean}  {artista[:20]} | {titulo[:30]}")

        hit = next((r for r in results
                    if verify_match(artista, titulo, r, from_barcode=True)), None)
        if hit is None:
            stats["rejected"] += 1
            if not args.quiet:
                problems.append(
                    f"REJECT        {artista[:20]:22s}| {titulo[:30]:32s}"
                    f"-> {results[0].get('title','')[:34]}")
            continue

        if hit.get("type") != "release":
            stats["NON_RELEASE_HIT"] += 1
            problems.append(f"NON-RELEASE TYPE {hit.get('type')} id={hit.get('id')}")

        rel = dg.release(hit["id"]) or {}
        ok = release_matches_ours(artista, titulo, rel)
        if ok is False:
            stats["WRONG_ALBUM"] += 1
            problems.append(
                f"WRONG ALBUM   {artista[:20]:22s}| {titulo[:30]:32s}"
                f"-> {rel.get('title','')[:34]!r}")
            continue
        if ok is None:
            stats["unverifiable"] += 1

        stats["resolved"] += 1

        siblings = [r for r in results
                    if verify_match(artista, titulo, r, from_barcode=True)]
        if len(siblings) == 1:
            stats["unique_pressing"] += 1
        catno = clean_catno(
            next((l.get("catno") for l in (rel.get("labels") or [])), None))
        stats["has_catno"] += bool(catno)
        stats["has_country"] += bool(rel.get("country"))
        stats["has_styles"] += bool(rel.get("styles"))
        stats["has_year"] += bool(rel.get("master_id"))

        tl = [t for t in (rel.get("tracklist") or [])
              if t.get("title") and (t.get("type_") or "track") == "track"]
        stats["has_tracklist"] += bool(tl)
        stats["has_sides"] += any(
            re.match(r"^[A-Z]", (t.get("position") or "")) for t in tl)
        # Fields we do not collect yet — measure before deciding.
        stats["rel_has_genres"] += bool(rel.get("genres"))
        stats["rel_has_notes"] += bool(rel.get("notes"))
        stats["rel_has_images"] += bool(rel.get("images"))
        stats["rel_has_videos"] += bool(rel.get("videos"))
        stats["rel_has_identifiers"] += bool(rel.get("identifiers"))
        stats["rel_has_formats_desc"] += bool(
            (rel.get("formats") or [{}])[0].get("descriptions"))

    print("PROBLEMS")
    for p in problems[:40]:
        print("  " + p)
    if not problems:
        print("  none")

    print("\nSTATS")
    for k in sorted(stats):
        print(f"  {k:28s} {stats[k]}")
    res = stats["resolved"] or 1
    print(f"\n  resolve rate  : {stats['resolved']}/{len(rows)}")
    for f in ("has_catno", "has_country", "has_styles", "has_tracklist",
              "has_sides", "has_year"):
        print(f"  {f:14s}: {100*stats[f]/res:.0f}% of resolved")


if __name__ == "__main__":
    main()
