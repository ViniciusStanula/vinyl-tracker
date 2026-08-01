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
from lastfm import clean_album_title

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


def _is_latin_comparable(s: str) -> bool:
    """True when a string has enough Latin letters to compare against ours.

    Discogs catalogues many releases under their native script: Joe Hisaishi's
    "La Folia" is listed as "久石譲* / ヴィヴァルディ* - ラ・フォリア". Our
    catalogue stores the romanised name, so token comparison finds no overlap
    and rejects a correct match. That silently discarded every Japanese,
    Korean, Cyrillic and Greek pressing — a real share of the anime and game
    soundtracks in this catalogue.
    """
    letters = [c for c in s if c.isalpha()]
    if not letters:
        return False
    latin = sum(1 for c in letters if c.isascii())
    return latin / len(letters) >= 0.3


def verify_match(
    our_artist: str, our_title: str, result: dict, *, from_barcode: bool = False
) -> bool:
    """True when the Discogs hit plausibly IS our record.

    Discogs search returns "Artist - Title" in one string. Requires the artist
    to be recognisable and at least one meaningful title token to overlap, so a
    reused or mistyped barcode cannot silently attach the wrong pressing.

    from_barcode=True relaxes one case: a Discogs title in a non-Latin script
    cannot be compared against our romanised one, so the barcode carries the
    match alone. Narrow on purpose — every wrong match seen in testing had a
    Latin title, where the check still applies (Duck Fight Goose -> Boy & Bear,
    Steve Davis -> Magdalena Bay).

    The artist+title fallback must pass from_barcode=False. It has no barcode
    to fall back on, so relaxing there would accept any release whose title
    happens to be in another script.
    """
    raw = result.get("title") or ""
    combined = _norm(raw)
    if not combined:
        return False

    if from_barcode and not _is_latin_comparable(raw):
        return True

    a_tok = _tokens(our_artist)
    t_tok = _tokens(our_title)
    hay = set(combined.split())

    # "Various Artists" carries no signal; fall back to title agreement alone.
    generic_artist = not a_tok or _norm(our_artist).startswith("various")
    artist_ok = generic_artist or bool(a_tok & hay)
    title_ok = not t_tok or bool(t_tok & hay)
    return artist_ok and title_ok


def pressing_invariant(results: list[dict]) -> dict:
    """Fields every matching vinyl pressing agrees on, and nothing else.

    Records with no barcode (Amazon simply has none for many listings) can
    still be found by artist + title, but that returns the album rather than a
    pressing. Utada "One Last Kiss" comes back as six releases — Europe, Japan
    x2, US x3 — differing in colour, catalogue number and country.

    What does NOT differ across those six: styles (J-pop, Theme, Anison) and
    the year. Those are properties of the album, not of the disc, so they are
    safe to take. Country, catalogue number and side layout are pressing-level
    and are deliberately never returned here — that is the same distinction
    that stopped us shipping MusicBrainz catalogue numbers.

    Returns {} unless at least two pressings agree, so a single ambiguous hit
    cannot masquerade as consensus.
    """
    vinyl = [
        r for r in results
        if any("vinyl" in str(f).lower() for f in (r.get("format") or []))
    ]
    if len(vinyl) < 2:
        return {}

    out: dict = {}

    style_sets = [frozenset(r.get("style") or []) for r in vinyl if r.get("style")]
    if style_sets and len(set(style_sets)) == 1 and style_sets[0]:
        out["styles"] = ", ".join(sorted(style_sets[0]))

    years = {r.get("year") for r in vinyl if r.get("year")}
    if len(years) == 1:
        y = years.pop()
        try:
            y = int(y)
        except (TypeError, ValueError):
            y = None
        if y and 1900 < y < 2100:
            out["year"] = y

    return out


class Discogs:
    """Discogs client.

    Two credential shapes are accepted, both lifting the rate limit from ~25 to
    60 requests/minute:

      DISCOGS_TOKEN            personal access token
      DISCOGS_KEY + _SECRET    OAuth consumer credentials, sent as an
                               app-level Authorization header. Discogs allows
                               these directly for requests that need no user
                               context, so no OAuth handshake is required.

    Credentials go in the Authorization header rather than the query string so
    they never land in a logged or retried URL.
    """

    def __init__(self) -> None:
        self.token = os.environ.get("DISCOGS_TOKEN")
        self.key = os.environ.get("DISCOGS_KEY")
        self.secret = os.environ.get("DISCOGS_SECRET")
        self.authed = bool(self.token or (self.key and self.secret))
        self.delay = DELAY_TOKEN if self.authed else DELAY_ANON

    def _auth_header(self) -> dict:
        if self.token:
            return {"Authorization": f"Discogs token={self.token}"}
        if self.key and self.secret:
            return {"Authorization": f"Discogs key={self.key}, secret={self.secret}"}
        return {}

    def _get(self, path: str, params: dict | None = None) -> dict | None:
        params = dict(params or {})
        url = f"{API}{path}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={"User-Agent": UA, **self._auth_header()})
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

    def by_artist_title(self, artist: str, title: str) -> list[dict]:
        data = self._get(
            "/database/search",
            {"artist": artist, "release_title": title, "format": "Vinyl"},
        )
        time.sleep(self.delay)
        return (data or {}).get("results") or []

    def release(self, release_id: int) -> dict | None:
        data = self._get(f"/releases/{release_id}")
        time.sleep(self.delay)
        return data

    def master_year(self, master_id: int) -> int | None:
        """Original release year of the album, not of this pressing.

        A release carries the year the vinyl was manufactured; the master
        carries the year the album first came out. Janis "Janis" is pressing
        2023 / master 1975, Ready To Die is 2023 / 1994. Only the master is
        usable for /decada.
        """
        data = self._get(f"/masters/{master_id}")
        time.sleep(self.delay)
        year = (data or {}).get("year")
        return int(year) if isinstance(year, int) and 1900 < year < 2100 else None


_COLUMNS = (
    "discogs_release_id",
    "discogs_catno",
    "discogs_country",
    "discogs_styles",
    "discogs_tracklist",
    "discogs_checked_at",
    "discogs_master_year",
    "discogs_master_checked_at",
)


def ensure_columns(conn) -> None:
    """Add the Discogs columns, skipping the DDL entirely once they exist.

    ADD COLUMN IF NOT EXISTS still takes an ACCESS EXCLUSIVE lock even when
    every column is already there, so running it unconditionally at startup
    makes this script fight whatever else is writing to "Disco" — the price
    crawler every three hours, or a sibling backfill. It cost a running EAN
    backfill once: the ALTER queued for the lock, and the backfill's UPDATE hit
    its own lock timeout and died.

    Same fast path ensure_schema_extras() in database.py uses: read the catalog
    first, and only reach for DDL when something is genuinely missing.
    """
    with conn.cursor() as cur:
        cur.execute(
            """SELECT count(*) FROM information_schema.columns
               WHERE table_name = 'Disco' AND column_name = ANY(%s)""",
            (list(_COLUMNS),),
        )
        if cur.fetchone()[0] == len(_COLUMNS):
            return

    with conn.cursor() as cur:
        cur.execute(
            """ALTER TABLE "Disco"
                 ADD COLUMN IF NOT EXISTS discogs_release_id  INTEGER,
                 ADD COLUMN IF NOT EXISTS discogs_catno       TEXT,
                 ADD COLUMN IF NOT EXISTS discogs_country     TEXT,
                 ADD COLUMN IF NOT EXISTS discogs_styles      TEXT,
                 ADD COLUMN IF NOT EXISTS discogs_tracklist   JSONB,
                 ADD COLUMN IF NOT EXISTS discogs_checked_at  TIMESTAMPTZ,
                 -- Original album year from the Discogs MASTER, never the
                 -- release: a release's year is when this pressing was made.
                 -- Separate checked_at because a legitimate answer is "this
                 -- release has no master", which must not be retried forever.
                 ADD COLUMN IF NOT EXISTS discogs_master_year       INTEGER,
                 ADD COLUMN IF NOT EXISTS discogs_master_checked_at TIMESTAMPTZ"""
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
              AND (
                discogs_checked_at IS NULL
                -- Rows resolved before master-year lookup existed: pick them up
                -- instead of needing a separate backfill pass.
                OR (discogs_release_id IS NOT NULL AND discogs_master_checked_at IS NULL)
              )
            ORDER BY price_count DESC NULLS LAST
            {'LIMIT %s' if limit else ''}
            """,
            (limit,) if limit else (),
        )
        return cur.fetchall()


def fetch_noBarcode_candidates(conn, limit: int | None) -> list[tuple]:
    """Records with no barcode, for the artist+title fallback.

    Amazon has no EAN for a large share of listings — Utada "One Last Kiss"
    among them — so those rows can never be resolved by barcode. Searching by
    artist + title still finds the album, just not the pressing, which is why
    only pressing_invariant() fields get written for them.

    Unidentified-artist rows are excluded: without an artist the search has
    nothing to constrain it and would return whatever shares a title.
    """
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT slug, artista, titulo
            FROM "Disco"
            WHERE (ean IS NULL OR ean !~ '^[0-9]{{13}}$')
              AND disponivel = TRUE
              AND (format IS NULL OR format = 'vinyl')
              AND artista !~* 'artista n[ãa]o identificad'
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
    ap.add_argument(
        "--no-barcode",
        action="store_true",
        help="fallback pass: match barcode-less records by artist+title and "
             "store only fields every vinyl pressing agrees on",
    )
    args = ap.parse_args()

    conn = connect_with_retry()
    conn.autocommit = True
    ensure_columns(conn)

    if args.no_barcode:
        run_no_barcode(conn, args)
        return

    rows = fetch_candidates(conn, args.limit)
    dg = Discogs()
    print(
        f"candidates: {len(rows)} | mode: {'APPLY' if args.apply else 'DRY RUN'} | "
        f"auth: {'token' if dg.token else 'key+secret' if dg.authed else 'anonymous'} "
        f"({dg.delay}s/call)\n"
    )

    resolved = rejected = missed = non_vinyl = 0
    with_sides = with_catno = with_master = 0

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

        hit = next(
            (r for r in results if verify_match(artista, titulo, r, from_barcode=True)),
            None,
        )
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
        # A barcode is not always unique. Measured on 25 random records: 10 map
        # to exactly one Discogs release, 12 map to several, and 5 of those 12
        # disagree on country. Evangelion "Finally" (0194398431512) returns five
        # — US 2022, US 2021 x2, a US misprint variant and a Europe pressing.
        #
        # So the pressing-level fields are only trustworthy when the barcode
        # resolved to a single release. Where several share it, country and
        # catalogue number are a coin flip and are left NULL, exactly as they
        # were for ambiguous MusicBrainz release-groups.
        siblings = [
            r for r in results if verify_match(artista, titulo, r, from_barcode=True)
        ]
        unique_pressing = len(siblings) == 1

        # Track layout is safe across siblings only if they are structurally the
        # same object — a 1LP and a 2LP variant of one album have different side
        # letters. Compared on the search result's own format list, so this
        # costs no extra calls.
        same_format = len({tuple(sorted(r.get("format") or [])) for r in siblings}) == 1

        catno = (
            clean_catno(next((l.get("catno") for l in (rel.get("labels") or [])), None))
            if unique_pressing else None
        )
        country = (rel.get("country") or hit.get("country")) if unique_pressing else None
        styles = ", ".join(rel.get("styles") or hit.get("style") or []) or None

        # One extra call, only when a master exists. Worth it: the master year
        # both fills records with no release date and catches wrong ones —
        # Jethro Tull "Living In The Past" is 1972, and MusicBrainz has it as
        # 2013 from a reissue release-group, which files it under the wrong
        # decade on the site today.
        master_id = rel.get("master_id")
        master_year = dg.master_year(master_id) if master_id else None
        if master_year:
            with_master += 1

        resolved += 1
        with_sides += bool(sides)
        with_catno += bool(catno)

        # Siblings that differ in format may differ in side layout, so the
        # tracklist is only stored when they are structurally identical.
        if not (unique_pressing or same_format):
            tracklist = []
            sides = False

        if args.apply:
            with conn.cursor() as cur:
                cur.execute(
                    """UPDATE "Disco"
                       SET discogs_release_id        = %s,
                           discogs_catno             = %s,
                           discogs_country           = %s,
                           discogs_styles            = %s,
                           discogs_tracklist         = %s,
                           discogs_master_year       = %s,
                           discogs_master_checked_at = NOW(),
                           discogs_checked_at        = NOW()
                       WHERE slug = %s""",
                    (
                        hit["id"],
                        catno,
                        country,
                        styles,
                        json.dumps(tracklist, ensure_ascii=False) if tracklist else None,
                        master_year,
                        slug,
                    ),
                )
        else:
            print(
                f"  OK  {artista[:16]:18s} | {titulo[:24]:26s} | "
                f"{country or '--':12s} sides={'Y' if sides else 'n'} "
                f"orig={master_year or '-':6} catno={catno or '-'} styles={styles or '-'}"
            )

    total = len(rows) or 1
    print(
        f"\nresolved            : {resolved}  ({100*resolved/total:.0f}%)"
        f"\n  ...with A/B sides : {with_sides}"
        f"\n  ...with catalogue : {with_catno}"
        f"\n  ...with orig year : {with_master}"
        f"\n  ...non-vinyl hit  : {non_vinyl}  (flagged only, not acted on)"
        f"\nrejected by verify  : {rejected}"
        f"\nbarcode not found   : {missed}"
    )
    if not args.apply:
        print("\nDRY RUN — nothing written.")


def run_no_barcode(conn, args) -> None:
    """Artist+title pass for records Amazon has no barcode for.

    Writes only pressing-invariant fields. discogs_release_id, catno, country
    and tracklist stay NULL on purpose: artist+title identifies the album, not
    the disc, and those four differ between pressings of the same album.
    """
    rows = fetch_noBarcode_candidates(conn, args.limit)
    dg = Discogs()
    print(
        f"barcode-less candidates: {len(rows)} | "
        f"mode: {'APPLY' if args.apply else 'DRY RUN'} | "
        f"auth: {'yes' if dg.authed else 'anonymous'}\n"
    )

    agreed = ambiguous = missed = 0
    for slug, artista, titulo in rows:
        query_title = clean_album_title(titulo, artista) or titulo
        results = dg.by_artist_title(artista, query_title)
        if not results:
            missed += 1
            if args.apply:
                with conn.cursor() as cur:
                    cur.execute(
                        'UPDATE "Disco" SET discogs_checked_at = NOW() WHERE slug = %s',
                        (slug,),
                    )
            continue

        verified = [r for r in results if verify_match(artista, titulo, r)]
        inv = pressing_invariant(verified)
        if not inv:
            ambiguous += 1
            if args.apply:
                with conn.cursor() as cur:
                    cur.execute(
                        'UPDATE "Disco" SET discogs_checked_at = NOW() WHERE slug = %s',
                        (slug,),
                    )
            continue

        agreed += 1
        if args.apply:
            with conn.cursor() as cur:
                cur.execute(
                    """UPDATE "Disco"
                       SET discogs_styles            = COALESCE(%s, discogs_styles),
                           discogs_master_year       = COALESCE(%s, discogs_master_year),
                           discogs_master_checked_at = NOW(),
                           discogs_checked_at        = NOW()
                       WHERE slug = %s""",
                    (inv.get("styles"), inv.get("year"), slug),
                )
        else:
            print(
                f"  AGREE {artista[:16]:18s} | {titulo[:26]:28s} | "
                f"{len(verified)} pressings | year={inv.get('year') or '-'} "
                f"styles={inv.get('styles') or '-'}"
            )

    total = len(rows) or 1
    print(
        f"\nconsensus across pressings : {agreed}  ({100*agreed/total:.0f}%)"
        f"\npressings disagreed        : {ambiguous}"
        f"\nnothing found              : {missed}"
    )
    if not args.apply:
        print("\nDRY RUN — nothing written.")


if __name__ == "__main__":
    main()
