"""
discogs_enrich.py — resolve records to an exact Discogs pressing by barcode.

Why this exists
---------------
Everything pressing-level was previously unshippable. mb_mbid is a release
GROUP — the abstract album — so we never knew which physical pressing Amazon
sells. Measured on 12 random matched records: median 4 releases per group, 8 of
12 spanning more than one label, Genesis "Foxtrot" covering 38 pressings across
11 labels. Catalogue number, pressing country and vinyl sides were all dropped
for that reason, and MusicBrainz recognised only 1 of 10 of our barcodes.

A barcode identifies the exact pressing, and Discogs indexes barcodes. Probe on
25 random barcoded records: 21 resolved (84%), all 21 vinyl, 21/21 with country
and label, 19/21 with style tags, and release detail carries "A1"/"B1" track
positions — the vinyl sides we could not get any other way.

What it stores
--------------
    discogs_release_id   int    the matched pressing
    discogs_catno        text   catalogue number (cleaned)
    discogs_country      text   pressing country, real names not XW/XE
    discogs_styles       text   comma-separated, granular ("Hard Bop")
    discogs_tracklist    jsonb  [{position, title, duration}] with A1/B1
    discogs_checked_at   ts     so reruns skip and failures can be retried

Deliberately NOT trusted blindly
--------------------------------
  * results[0] is verified against our artist/title before writing. Barcodes
    are strong evidence but Amazon EANs can be wrong or reused, and writing the
    wrong pressing is the failure this whole approach exists to avoid.
  * Discogs editors put barcodes in the catalogue-number field (seen live:
    Coldplay "Parachutes" -> catno "5021732630865"). Same junk MusicBrainz has;
    same guard.
  * A non-vinyl format result is recorded but never used to overwrite vinyl
    data — it is a signal that the row may be misclassified, not a licence to
    act on it.

Rate limit: unauthenticated ~25 req/min. With DISCOGS_TOKEN set, 60/min.
Two calls per record (search + release detail), so a token roughly halves the
wall clock.

    python discogs_enrich.py --limit 100            # dry run
    python discogs_enrich.py --limit 100 --apply
    python discogs_enrich.py --apply                # full pass, resumable
"""
from __future__ import annotations

import argparse
import io
import json
import logging
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from db_retry import connect_with_retry

log = logging.getLogger(__name__)

API = "https://api.discogs.com"
UA = "GarimpaVinil/1.0 +https://www.garimpavinil.com.br"

# Unauthenticated Discogs allows ~25 requests/minute; a token raises it to 60.
# Two calls per record, so delay is per-call not per-record.
DELAY_ANON = 2.6
DELAY_TOKEN = 1.1


def _norm(s: str) -> str:
    """Casefold, strip accents and punctuation — for match verification only."""
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower().replace("&", "and")
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", s)).strip()


def _tokens(s: str) -> set[str]:
    return {t for t in _norm(s).split() if len(t) > 2}


def clean_catno(v: str | None) -> str | None:
    """Reject the placeholder and barcode-in-the-wrong-field cases.

    Mirrors fetch_release_details.clean_catno: Discogs has the same editor
    habits as MusicBrainz. Seen live: Coldplay "Parachutes" carries catno
    "5021732630865", which is its barcode.
    """
    if not v:
        return None
    s = str(v).strip()
    if s.lower().strip("[]") in ("none", "n/a", "-", "", "not on label"):
        return None
    if s.isdigit() and len(s) in (12, 13):
        return None
    return s


def verify_match(our_artist: str, our_title: str, result: dict) -> bool:
    """True when the Discogs hit plausibly IS our record.

    Discogs search returns "Artist - Title" in one string. Requires the artist
    to be recognisable and at least one meaningful title token to overlap, so a
    reused or mistyped barcode cannot silently attach the wrong pressing.
    """
    combined = _norm(result.get("title") or "")
    if not combined:
        return False

    a_tok = _tokens(our_artist)
    t_tok = _tokens(our_title)
    hay = set(combined.split())

    # "Various Artists" carries no signal; fall back to title agreement alone.
    generic_artist = not a_tok or _norm(our_artist).startswith("various")
    artist_ok = generic_artist or bool(a_tok & hay)
    title_ok = not t_tok or bool(t_tok & hay)
    return artist_ok and title_ok


class Discogs:
    def __init__(self) -> None:
        self.token = os.environ.get("DISCOGS_TOKEN")
        self.delay = DELAY_TOKEN if self.token else DELAY_ANON

    def _get(self, path: str, params: dict | None = None) -> dict | None:
        params = dict(params or {})
        if self.token:
            params["token"] = self.token
        url = f"{API}{path}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        for attempt in (1, 2, 3):
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    return json.loads(r.read())
            except urllib.error.HTTPError as exc:
                if exc.code == 429:  # rate limited — back off and retry
                    time.sleep(self.delay * 4 * attempt)
                    continue
                if exc.code == 404:
                    return None
                log.warning("Discogs HTTP %s on %s", exc.code, path)
                return None
            except Exception as exc:
                log.warning("Discogs error on %s: %s", path, exc)
                time.sleep(self.delay * attempt)
        return None

    def by_barcode(self, barcode: str) -> list[dict]:
        data = self._get("/database/search", {"barcode": barcode})
        time.sleep(self.delay)
        return (data or {}).get("results") or []

    def release(self, release_id: int) -> dict | None:
        data = self._get(f"/releases/{release_id}")
        time.sleep(self.delay)
        return data


def ensure_columns(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """ALTER TABLE "Disco"
                 ADD COLUMN IF NOT EXISTS discogs_release_id  INTEGER,
                 ADD COLUMN IF NOT EXISTS discogs_catno       TEXT,
                 ADD COLUMN IF NOT EXISTS discogs_country     TEXT,
                 ADD COLUMN IF NOT EXISTS discogs_styles      TEXT,
                 ADD COLUMN IF NOT EXISTS discogs_tracklist   JSONB,
                 ADD COLUMN IF NOT EXISTS discogs_checked_at  TIMESTAMPTZ"""
        )
    conn.commit()


def fetch_candidates(conn, limit: int | None) -> list[tuple]:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT slug, artista, titulo, ean
            FROM "Disco"
            WHERE ean ~ '^[0-9]{{13}}$'
              AND disponivel = TRUE
              AND (format IS NULL OR format = 'vinyl')
              AND discogs_checked_at IS NULL
            ORDER BY price_count DESC NULLS LAST
            {'LIMIT %s' if limit else ''}
            """,
            (limit,) if limit else (),
        )
        return cur.fetchall()


def main() -> None:
    # Rebound here rather than at import: doing it at module scope replaces the
    # stdout pytest has already captured, and every test in this file then dies
    # with "I/O operation on closed file" before running.
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    conn = connect_with_retry()
    conn.autocommit = True
    ensure_columns(conn)

    rows = fetch_candidates(conn, args.limit)
    dg = Discogs()
    print(
        f"candidates: {len(rows)} | mode: {'APPLY' if args.apply else 'DRY RUN'} | "
        f"auth: {'token' if dg.token else 'anonymous'} ({dg.delay}s/call)\n"
    )

    resolved = rejected = missed = non_vinyl = 0
    with_sides = with_catno = 0

    for slug, artista, titulo, ean in rows:
        results = dg.by_barcode(ean)
        if not results:
            missed += 1
            if args.apply:
                with conn.cursor() as cur:
                    cur.execute(
                        'UPDATE "Disco" SET discogs_checked_at = NOW() WHERE slug = %s',
                        (slug,),
                    )
            continue

        hit = next((r for r in results if verify_match(artista, titulo, r)), None)
        if hit is None:
            rejected += 1
            print(f"  REJECT {artista[:18]:20s} | {titulo[:30]:32s} -> {results[0].get('title','')[:40]}")
            if args.apply:
                with conn.cursor() as cur:
                    cur.execute(
                        'UPDATE "Disco" SET discogs_checked_at = NOW() WHERE slug = %s',
                        (slug,),
                    )
            continue

        fmts = [f.lower() for f in (hit.get("format") or [])]
        if not any("vinyl" in f for f in fmts):
            # Recorded, not acted on: a non-vinyl hit hints the row may be
            # misclassified, but format changes are a separate, reviewed job.
            non_vinyl += 1

        rel = dg.release(hit["id"]) or {}
        tracklist = [
            {"position": t.get("position"), "title": t.get("title"), "duration": t.get("duration")}
            for t in (rel.get("tracklist") or [])
            if t.get("title")
        ]
        sides = any(re.match(r"^[A-Z]\d", (t.get("position") or "")) for t in tracklist)
        catno = clean_catno(next((l.get("catno") for l in (rel.get("labels") or [])), None))
        country = rel.get("country") or hit.get("country")
        styles = ", ".join(rel.get("styles") or hit.get("style") or []) or None

        resolved += 1
        with_sides += bool(sides)
        with_catno += bool(catno)

        if args.apply:
            with conn.cursor() as cur:
                cur.execute(
                    """UPDATE "Disco"
                       SET discogs_release_id = %s,
                           discogs_catno      = %s,
                           discogs_country    = %s,
                           discogs_styles     = %s,
                           discogs_tracklist  = %s,
                           discogs_checked_at = NOW()
                       WHERE slug = %s""",
                    (
                        hit["id"],
                        catno,
                        country,
                        styles,
                        json.dumps(tracklist, ensure_ascii=False) if tracklist else None,
                        slug,
                    ),
                )
        else:
            print(
                f"  OK  {artista[:16]:18s} | {titulo[:24]:26s} | "
                f"{country or '--':14s} sides={'Y' if sides else 'n'} "
                f"catno={catno or '-'} styles={styles or '-'}"
            )

    total = len(rows) or 1
    print(
        f"\nresolved            : {resolved}  ({100*resolved/total:.0f}%)"
        f"\n  ...with A/B sides : {with_sides}"
        f"\n  ...with catalogue : {with_catno}"
        f"\n  ...non-vinyl hit  : {non_vinyl}  (flagged only, not acted on)"
        f"\nrejected by verify  : {rejected}"
        f"\nbarcode not found   : {missed}"
    )
    if not args.apply:
        print("\nDRY RUN — nothing written.")


if __name__ == "__main__":
    main()
