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
    discogs_genres       text   the level above styles ("Rock")
    discogs_tracklist    jsonb  [{position, title, duration}] with A1/B1
    discogs_title        text   album name without Amazon's pressing junk
    discogs_label        text   the record label
    discogs_released     text   when THIS pressing was made
    discogs_master_year  int    when the ALBUM first came out — use for /decada
    discogs_format_desc  text   "2xLP, Album, Reissue, 180 Gram"
    discogs_checked_at   ts     so reruns skip and failures can be retried

Three tiers of confidence
-------------------------
Fields are written according to how well the evidence identifies the DISC, not
just the album. A barcode resolving to one release is the strongest case; the
same barcode shared by several pressings is weaker; an artist+title search
identifies only the work.

  pressing-level, single release only : country, released, format_desc
  pressing-level, or sibling consensus: catno, label
  album-level, always safe            : styles, genres, master_year, title

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


# Words that carry no identifying power, so an overlap on one of them is not
# evidence of a match. "the" alone was enough to pass both halves of
# verify_match: "See the Sun" matched "The Paper Dolls - My Life (Is In Your
# Hands)" on that single token, and the record was stored with the wrong
# album's tracklist. Any title containing "the" matched any other one.
#
# Includes the pressing/format words Amazon bakes into our titles ("Disco de
# Vinil", "[VINYL]", "Edicao Limitada"), which are ours alone and would never
# be evidence about which release Discogs returned.
_STOPWORDS = frozenset("""
the and for with from that this you your ours out off her his its
los las les des del della delle une uns und der das dem den ein eine
que com por para uno una unos unas nos nas dos das aos
disco vinil vinyl album albuns record records lp lps ep eps single singles
edicao edition ediciones limitada limited deluxe expanded remaster remastered
import importado exclusive exclusivo colored coloured gatefold reissue
versao version original official soundtrack ost trilha sonora
explicit content nacional novo lacrado duplo triplo clear 2lp 3lp 4lp
iex gram 180g indie
""".split())
# "die" is deliberately absent: it is a German article but also an English verb,
# and dropping it cost the match on HEALTH "Die Slow".

# Amazon's stand-in for "we could not parse an artist". Carries no more signal
# than "Various Artists", but was treated as a real artist name, so a correct
# hit was rejected for not containing the words "artista identificado":
# "This Is The Show - Clear Vinyl" vs Discogs "Pluralone - This Is The Show".
_UNIDENTIFIED = re.compile(r"artista n[ãa]o identificad", re.I)


# A reissue series is the publisher's branding, not part of the album name:
# "Jazz Samba Encore! (Verve Acoustic Sounds Series)", "Dial 'S' For Sonny
# (Blue Note Classic Vinyl Series)". clean_album_title leaves these because
# they carry no vinyl word, and the extra tokens drag title coverage under the
# threshold — that one cost the Stan Getz / Luiz Bonfa match.
_SERIES_PAREN = re.compile(r"\s*\([^)]*\bseries\b[^)]*\)", re.I)


def _strip_series(title: str) -> str:
    return _SERIES_PAREN.sub("", title or "").strip()


def _tokens(s: str) -> set[str]:
    """Identifying words only — short words and stopwords carry no evidence."""
    return {t for t in _norm(s).split() if len(t) > 2 and t not in _STOPWORDS}


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
    # Digits only and barcode-length is a barcode, not a catalogue number.
    # The range is 12-14 rather than (12, 13) because editors pad: Anne Wilson
    # "REBEL" carries catno "00602458871463", which is the 12-digit UPC with
    # two leading zeros, and slipped through a length-13 test.
    if s.isdigit() and 12 <= len(s) <= 14:
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

    # Test the title half alone. Discogs writes "Artist - Title", and a romaji
    # artist over a Japanese title reads as 30%+ Latin overall, so a fully
    # Japanese title never reached this relaxation: Nausicaa is catalogued as
    # "Yasuda Narumi* - 風の谷のナウシカ (2024 Ver.)".
    title_part = raw.split(" - ", 1)[1] if " - " in raw else raw
    if from_barcode and not _is_latin_comparable(title_part):
        return True

    a_tok = _tokens(our_artist)
    # Compare against the album name, not Amazon's pressing description. The
    # junk is counted in the denominator otherwise: our Kaguya title is "Tale
    # Of The Princess Kaguya Ost (2Lp/Remaster/Etched Side/Japanese Import/
    # Obistrip/Gatefold/Limited)", which matched Discogs on all three words
    # that matter and still scored 0.43 coverage.
    t_tok = _tokens(_strip_series(clean_album_title(our_title, our_artist) or our_title))
    hay = set(combined.split())

    # Nothing identifying on our side means the comparison cannot be made, and
    # "cannot verify" is not "verified". Both halves used to treat an empty
    # token set as a pass, so a record whose artist and title reduced to
    # stopwords accepted the first result the barcode returned, whatever it was.
    if not a_tok and not t_tok:
        return False

    # "Various Artists" carries no signal; fall back to title agreement alone.
    generic_artist = (
        not a_tok
        or _norm(our_artist).startswith("various")
        or bool(_UNIDENTIFIED.search(our_artist or ""))
    )
    artist_ok = generic_artist or bool(a_tok & hay)
    # Same rule on the title side: an empty title token set is only acceptable
    # when the artist actually matched something.
    title_ok = bool(t_tok & hay) if t_tok else not generic_artist
    if artist_ok and title_ok:
        return True

    # Our artista column is wrong often enough that requiring it to agree threw
    # away correct matches wholesale. Measured on category batches: "Sekiro"
    # filed against Pizza Tower's soundtrack, "Kill la Kill" against Halloween,
    # "The Batman" against Wallace & Gromit — in each case our title was right,
    # Discogs found the right album, and the artist gate rejected it. It also
    # rejects legitimate credit differences: Mega Man Legends 2 is credited to
    # Makoto Tomozawa, not "Capcom Sound Team", and Novectacle is "Novect".
    #
    # So a title can carry a match on its own, but only a specific one: at
    # least two identifying words and most of our title accounted for. One
    # shared word is how "the" attached The Paper Dolls to "See The Sun".
    if t_tok:
        overlap = t_tok & hay
        if len(overlap) >= 2 and len(overlap) / len(t_tok) >= 0.6:
            return True
        # A single word can carry it when the word is rare enough to be an
        # identifier in its own right and it is our whole title: "Romaplasm"
        # is not a coincidence, "Live" would be. Our artist column had this
        # record under "Romantasm"; Discogs has it under Baths.
        if (
            len(overlap) == 1
            and overlap == t_tok
            and len(next(iter(overlap))) >= 7
        ):
            return True

    # Barcode plus an artist agreement, with a title that will not line up.
    # Discogs censors titles (KMD "Bl_ck B_st_rds" for "Black Bastards"), files
    # self-titled records as "Cracker - Cracker" against our "Cracker -
    # 180-Gram Black Vinyl", and numbers sequels our pressing description
    # buries ("II (IEX) (Indie Exclusive)" vs "Van Halen II").
    #
    # Safe because it needs a real artist token to land: the two genuinely
    # wrong barcodes in these batches (Queen -> Judas Priest, a Curtis Mayfield
    # tribute -> Django Reinhardt) share no artist word and stay rejected.
    if from_barcode and not generic_artist and bool(a_tok & hay):
        return True
    return False


def master_consensus(results: list[dict]) -> int | None:
    """The Discogs master every verified pressing points at, or None.

    Far stronger evidence than the field-by-field agreement pressing_invariant
    asks for. Niall Horan "Flicker" returns eight pressings across three
    countries and two decades; all eight carry master_id 1254664, which settles
    that they are one album even though their years and styles differ.

    Search results already carry master_id, so this is free, and it turns the
    barcode-less path from "hope every pressing agrees" into one authoritative
    lookup.
    """
    ids = {r.get("master_id") for r in results if r.get("master_id")}
    return ids.pop() if len(ids) == 1 else None


def sibling_consensus(sibs: list[dict], key: str) -> str | None:
    """The one value every sibling release agrees on, or None.

    A barcode mapping to several releases does not mean they give several
    answers. Measured on 30 records — 11 with multiple pressings behind one
    barcode — the siblings agreed on label and catalogue number 82% of the
    time, while country differed 64% of the time (the same record pressed for
    Europe and for the US). So country stays gated on a single pressing, and
    these two are taken by consensus instead of being dropped.

    Reads the search results, which already carry catno and label, so this
    costs no extra API call.
    """
    values = set()
    for r in sibs:
        v = r.get(key)
        if isinstance(v, list):
            v = v[0] if v else None
        if key == "catno":
            v = clean_catno(v)
        v = (v or "").strip() or None
        if v:
            values.add(v)
    return values.pop() if len(values) == 1 else None


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


class DiscogsUnavailable(Exception):
    """The API could not be reached — as opposed to answering "nothing found".

    Callers must leave discogs_checked_at alone when they see this, so the
    record is retried on the next run instead of being retired unenriched.
    """


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
                    return None  # genuinely absent, and that is an answer
                if 500 <= exc.code < 600:
                    log.warning("Discogs HTTP %s on %s", exc.code, path)
                    time.sleep(self.delay * attempt)
                    continue
                log.warning("Discogs HTTP %s on %s", exc.code, path)
                return None
            except Exception as exc:
                log.warning("Discogs error on %s: %s", path, exc)
                time.sleep(self.delay * attempt)
        # Exhausted the retries. This is NOT "no results" — returning None here
        # made a timeout indistinguishable from an empty search, and the caller
        # then stamped discogs_checked_at, retiring the record permanently on a
        # transient blip. The same audit batch reported 4 misses one run and 6
        # the next, which is how this surfaced.
        raise DiscogsUnavailable(path)

    # type=release is not optional. A barcode search returns master rows mixed
    # in with release rows, both carrying a plain "id", and master ids collide
    # with unrelated release ids: The Beatles "Live At The Hollywood Bowl"
    # (0602557054996) returns master 1103767, and /releases/1103767 is a Dutch
    # novelty record. verify_match cannot catch this — it reads the search
    # result's title, which is correct on the master too, so the wrong album is
    # only visible after the release fetch.
    #
    # It also fixes a silent one: masters counted as siblings inflated the
    # count, so single pressings looked ambiguous and lost catno and country.
    def by_barcode(self, barcode: str) -> list[dict]:
        data = self._get("/database/search", {"barcode": barcode, "type": "release"})
        time.sleep(self.delay)
        return (data or {}).get("results") or []

    def by_artist_title(self, artist: str, title: str) -> list[dict]:
        data = self._get(
            "/database/search",
            {"artist": artist, "release_title": title, "format": "Vinyl",
             "type": "release"},
        )
        time.sleep(self.delay)
        return (data or {}).get("results") or []

    def release(self, release_id: int) -> dict | None:
        data = self._get(f"/releases/{release_id}")
        time.sleep(self.delay)
        return data

    def master(self, master_id: int) -> dict | None:
        """The album as an abstract work: year, title, styles, tracklist."""
        data = self._get(f"/masters/{master_id}")
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
    "discogs_title",
    "discogs_label",
    "discogs_released",
    "discogs_format_desc",
    "discogs_genres",
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
                 ADD COLUMN IF NOT EXISTS discogs_master_checked_at TIMESTAMPTZ,
                 -- Clean album title. Ours is the Amazon marketing string and
                 -- carries pressing junk on ~24% of records:
                 --   "DOCTOR WHO: FOUR FROM DOOM'S DAY (2LP/TRANSLUCENT
                 --    PURPLE AND BLUE 140G)"
                 --   "Dial 'S' For Sonny (Blue Note Classic Vinyl Series)"
                 -- Discogs stores the album's actual title.
                 ADD COLUMN IF NOT EXISTS discogs_title             TEXT,
                 -- Ficha tecnica. All four measured on a 29-record field
                 -- audit before being added.
                 --
                 -- Label: Discogs had one where MusicBrainz had none on 21 of
                 -- 29, and disagreed on 3. Pressing-level, so it is written
                 -- under the same unique_pressing gate as catno and country.
                 ADD COLUMN IF NOT EXISTS discogs_label             TEXT,
                 -- Full pressing date, present on 29 of 29. Distinct from
                 -- discogs_master_year, which is when the ALBUM first came
                 -- out; this is when this particular disc was made.
                 ADD COLUMN IF NOT EXISTS discogs_released          TEXT,
                 -- "LP, Album, Reissue, 180 Gram, Gatefold". Reissue alone
                 -- appeared on 13 of 29 — the difference between an original
                 -- and a repress, which the page cannot state today.
                 ADD COLUMN IF NOT EXISTS discogs_format_desc       TEXT,
                 -- Broad genre ("Rock", "Stage & Screen"), a level above
                 -- styles. Album-level, so no pressing gate.
                 ADD COLUMN IF NOT EXISTS discogs_genres            TEXT"""
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


def album_level_fields(dg, verified: list[dict]) -> dict:
    """What can be said about the ALBUM from a set of verified pressings.

    Prefers the shared master — one authoritative lookup giving the original
    year, the clean title, genres and the running order — and falls back to
    pressing_invariant when the pressings point at different masters or none.

    Never returns pressing-level data. The master tracklist carries no side
    letters, which is precisely the claim a pressing-agnostic match can make.
    """
    if not verified:
        return {}
    mid = master_consensus(verified)
    if mid:
        master = dg.master(mid) or {}
        year = master.get("year")
        return {
            "year": year if isinstance(year, int) and 1900 < year < 2100 else None,
            "styles": ", ".join(master.get("styles") or []) or None,
            "genres": ", ".join(master.get("genres") or []) or None,
            "title": (master.get("title") or "").strip() or None,
            "tracks": [
                {"position": t.get("position"), "title": t.get("title"),
                 "duration": t.get("duration")}
                for t in (master.get("tracklist") or [])
                if t.get("title") and (t.get("type_") or "track") == "track"
            ],
        }
    inv = pressing_invariant(verified)
    return {"year": inv.get("year"), "styles": inv.get("styles")} if inv else {}


def salvage_by_title(dg, conn, args, slug, artista, titulo) -> bool:
    """Last chance for a record whose barcode found nothing, or found junk.

    Those rows used to be stamped checked and retired empty. An artist+title
    search still identifies the ALBUM, so the pressing-invariant fields apply
    exactly as they do for records that never had a barcode: styles and the
    original year, never country, catalogue number or side layout.

    Measured on 60 records: 9 barcode misses, 3 of them recovered this way, at
    the cost of one extra call per miss. Returns True when something was saved.

    The row is stamped checked either way — the barcode already failed and the
    title search has now failed too, so there is nothing left to retry.
    """
    query = clean_album_title(titulo, artista) or titulo
    alb: dict = {}
    if not _UNIDENTIFIED.search(artista or ""):
        try:
            alt = dg.by_artist_title(artista, query)
            alb = album_level_fields(
                dg, [r for r in alt if verify_match(artista, titulo, r)]
            )
        except DiscogsUnavailable:
            # Do not stamp: the barcode answered, this did not, so the row is
            # still worth another run.
            return False

    if args.apply:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE "Disco"
                   SET discogs_styles      = COALESCE(%s, discogs_styles),
                       discogs_genres      = COALESCE(%s, discogs_genres),
                       discogs_title       = COALESCE(discogs_title, %s),
                       discogs_tracklist   = COALESCE(discogs_tracklist, %s),
                       discogs_master_year = COALESCE(%s, discogs_master_year),
                       discogs_checked_at  = NOW()
                   WHERE slug = %s""",
                (alb.get("styles"), alb.get("genres"), alb.get("title"),
                 json.dumps(alb["tracks"], ensure_ascii=False)
                 if alb.get("tracks") else None,
                 alb.get("year"), slug),
            )
    elif alb:
        print(f"  SALVAGE {artista[:16]:18s} | {titulo[:26]:28s} "
              f"year={alb.get('year') or '-':6} tracks={len(alb.get('tracks') or []) or '-':4} "
              f"styles={(alb.get('styles') or '-')[:30]}")
    return bool(alb)


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

    resolved = rejected = missed = non_vinyl = unavailable = salvaged = 0
    with_sides = with_catno = with_master = 0

    for slug, artista, titulo, ean in rows:
        try:
            results = dg.by_barcode(ean)
        except DiscogsUnavailable:
            # Leave discogs_checked_at NULL so the next run picks the row up.
            unavailable += 1
            continue
        if not results:
            missed += 1
            if salvage_by_title(dg, conn, args, slug, artista, titulo):
                salvaged += 1
            continue

        hit = next(
            (r for r in results if verify_match(artista, titulo, r, from_barcode=True)),
            None,
        )
        if hit is None:
            rejected += 1
            print(f"  REJECT {artista[:18]:20s} | {titulo[:30]:32s} -> {results[0].get('title','')[:40]}")
            # A rejected hit means the barcode pointed somewhere else, so the
            # barcode is the part not to trust — the title is still worth a try.
            if salvage_by_title(dg, conn, args, slug, artista, titulo):
                salvaged += 1
            continue

        fmts = [f.lower() for f in (hit.get("format") or [])]
        if not any("vinyl" in f for f in fmts):
            # Recorded, not acted on: a non-vinyl hit hints the row may be
            # misclassified, but format changes are a separate, reviewed job.
            non_vinyl += 1

        try:
            rel = dg.release(hit["id"]) or {}
        except DiscogsUnavailable:
            unavailable += 1
            continue
        # type_ "heading" rows are section dividers, not tracks — a Janis
        # pressing opens with "From The Soundtrack Of The Motion Picture
        # \"Janis\"" at position "". Kept, they inflate the track count and
        # break side detection, since a position-less row sits between real
        # ones. "index" rows are the same kind of thing for multi-part suites.
        tracklist = [
            {"position": t.get("position"), "title": t.get("title"), "duration": t.get("duration")}
            for t in (rel.get("tracklist") or [])
            if t.get("title") and (t.get("type_") or "track") == "track"
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
            if unique_pressing
            else sibling_consensus(siblings, "catno")
        )
        country = (rel.get("country") or hit.get("country")) if unique_pressing else None
        # Discogs uses a literal "Unknown" placeholder, which is not a country.
        if (country or "").strip().lower() in ("unknown", "unbekannt", ""):
            country = None
        styles = ", ".join(rel.get("styles") or hit.get("style") or []) or None
        # Album-level, so it survives an ambiguous barcode the way styles do.
        genres = ", ".join(rel.get("genres") or []) or None

        # The manufacturing date and the physical description are the fields
        # that genuinely differ between pressings sharing a barcode (siblings
        # agreed on format only 36% of the time), so they stay gated on a
        # single pressing. The label does not — 82% agreement — so it falls
        # back to consensus rather than being dropped.
        released = None
        format_desc = None
        label = sibling_consensus(siblings, "label")
        if unique_pressing:
            label = (next((l.get("name") for l in (rel.get("labels") or [])), None)
                     or None)
            released = (rel.get("released") or "").strip() or None
            fmt = (rel.get("formats") or [{}])[0]
            parts = list(fmt.get("descriptions") or [])
            if fmt.get("text"):
                parts.append(fmt["text"])          # "180 Gram", "Blue Translucent"
            qty = str(fmt.get("qty") or "")
            if qty.isdigit() and int(qty) > 1:
                parts.insert(0, f"{qty}xLP")
            format_desc = ", ".join(dict.fromkeys(p for p in parts if p)) or None

        # One extra call, only when a master exists. Worth it: the master year
        # both fills records with no release date and catches wrong ones —
        # Jethro Tull "Living In The Past" is 1972, and MusicBrainz has it as
        # 2013 from a reissue release-group, which files it under the wrong
        # decade on the site today.
        # Discogs release titles are the album name without the pressing
        # description Amazon bakes into ours.
        dg_title = (rel.get("title") or "").strip() or None

        master_id = rel.get("master_id")
        master_failed = False
        try:
            master_year = dg.master_year(master_id) if master_id else None
        except DiscogsUnavailable:
            # The release itself is in hand, so keep it; only the original-year
            # lookup failed. Leaving discogs_master_checked_at NULL below makes
            # the resume branch in fetch_candidates come back for just this.
            master_year = None
            master_failed = True
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
                           discogs_title             = %s,
                           discogs_label             = %s,
                           discogs_released          = %s,
                           discogs_format_desc       = %s,
                           discogs_genres            = %s,
                           discogs_master_checked_at = CASE WHEN %s THEN NULL
                                                            ELSE NOW() END,
                           discogs_checked_at        = NOW()
                       WHERE slug = %s""",
                    (
                        hit["id"],
                        catno,
                        country,
                        styles,
                        json.dumps(tracklist, ensure_ascii=False) if tracklist else None,
                        master_year,
                        dg_title,
                        label,
                        released,
                        format_desc,
                        genres,
                        master_failed,
                        slug,
                    ),
                )
        else:
            print(
                f"  OK  {artista[:16]:18s} | {titulo[:24]:26s} | "
                f"{country or '--':12s} sides={'Y' if sides else 'n'} "
                f"orig={master_year or '-':6} catno={catno or '-':12s} "
                f"label={(label or '-')[:18]:20s} rel={released or '-':12s} "
                f"fmt={(format_desc or '-')[:34]}"
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
        f"\n  ...salvaged by title search : {salvaged}"
        f"\nAPI unavailable, left unchecked : {unavailable}"
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

    agreed = ambiguous = missed = unavailable = from_master = 0
    for slug, artista, titulo in rows:
        query_title = clean_album_title(titulo, artista) or titulo
        try:
            results = dg.by_artist_title(artista, query_title)
        except DiscogsUnavailable:
            unavailable += 1
            continue
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

        # Prefer the master. Asking every pressing to agree field by field is
        # the wrong question — Niall Horan "Flicker" returns eight pressings
        # spanning 2017 to 2026, so they never agree on a year, yet all eight
        # carry one master_id and are plainly the same album. The master then
        # answers authoritatively in a single call, where the old path gave up.
        had_master = master_consensus(verified) is not None
        try:
            alb = album_level_fields(dg, verified)
        except DiscogsUnavailable:
            unavailable += 1
            continue

        if not alb:
            ambiguous += 1
            if args.apply:
                with conn.cursor() as cur:
                    cur.execute(
                        'UPDATE "Disco" SET discogs_checked_at = NOW() WHERE slug = %s',
                        (slug,),
                    )
            continue

        year, styles = alb.get("year"), alb.get("styles")
        genres, dg_title = alb.get("genres"), alb.get("title")
        tracks = alb.get("tracks") or []
        if had_master:
            from_master += 1
        else:
            agreed += 1

        if args.apply:
            with conn.cursor() as cur:
                cur.execute(
                    """UPDATE "Disco"
                       SET discogs_styles            = COALESCE(%s, discogs_styles),
                           discogs_genres            = COALESCE(%s, discogs_genres),
                           discogs_title             = COALESCE(discogs_title, %s),
                           discogs_tracklist         = COALESCE(discogs_tracklist, %s),
                           discogs_master_year       = COALESCE(%s, discogs_master_year),
                           discogs_master_checked_at = NOW(),
                           discogs_checked_at        = NOW()
                       WHERE slug = %s""",
                    (styles, genres, dg_title,
                     json.dumps(tracks, ensure_ascii=False) if tracks else None,
                     year, slug),
                )
        else:
            print(
                f"  {'MASTER' if had_master else 'AGREE ':6s} {artista[:16]:18s} | "
                f"{titulo[:24]:26s} | {len(verified)} pressings | "
                f"year={year or '-':6} tracks={len(tracks) or '-':4} "
                f"styles={(styles or '-')[:30]}"
            )

    total = len(rows) or 1
    print(
        f"\nresolved via master        : {from_master}  ({100*from_master/total:.0f}%)"
        f"\nconsensus across pressings : {agreed}  ({100*agreed/total:.0f}%)"
        f"\npressings disagreed        : {ambiguous}"
        f"\nnothing found              : {missed}"
    )
    if not args.apply:
        print("\nDRY RUN — nothing written.")


if __name__ == "__main__":
    main()
