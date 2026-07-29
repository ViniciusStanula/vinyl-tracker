"""
mb_verify.py — per-record MusicBrainz match verification + fix, callable
inline from any pipeline that touches one Disco record at a time (currently:
wikipedia_bio_fetch.py, so writing a bio for a record also corrects that
record's MB match instead of the two staying disconnected processes).

Reuses the exact same checks the one-off batch scripts already validated:
  - title_matches_release (mb_enrich.py) / the looser variant from
    audit_mb_titles.py, for "is mb_title actually this release"
  - the BOX/STUB tracklist-shape heuristics from flag_bad_tracklists.py, for
    "mb_title matches but the tracklist plainly belongs to a different release"
    (e.g. a promo single or box set under a title-compatible release-group)

When a record fails either check, re-run mb_enrich's search_release_group and
mb_tracklist's fetch_tracklist to fix it in place — same as
rematch_flagged_tracklists.py, which is why mb_mbid is cleared alongside
mb_tracklist rather than kept "for a later pass" (PR #288 lesson: a scheduled
job treats mbid-present+tracklist-null as "re-fetch with this same mbid",
which just restores the same wrong tracklist).

Costs 0 MB calls when the existing match already looks right (the common
case). Up to 2 MB calls (search + tracklist) when it doesn't.
"""
import json
import re
import time
import unicodedata

from mb_enrich import search_release_group
from mb_tracklist import fetch_tracklist

_LEADING_ARTICLE = re.compile(r"^(the|a|an) ")


def _norm_loose(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("&", " and ")
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return _LEADING_ARTICLE.sub("", s)


def _loose_tokens(s: str) -> set[str]:
    return set(_norm_loose(s).split())


def title_matches_loosely(mb_title: str, album_clean: str, artist: str) -> bool:
    # Same rule as audit_mb_titles.py: tuned for comparing an already-STORED
    # mb_title (which may differ from a fresh search hit only cosmetically —
    # accents, smart quotes, a leading "The") against the product title.
    if not mb_title:
        return False
    qtok = _loose_tokens(album_clean)
    atok = _loose_tokens(artist)
    mbtok = _loose_tokens(mb_title) - atok
    return mbtok <= qtok


# Same markers/threshold as flag_bad_tracklists.py — duplicated rather than
# imported because that module's copies are baked into a SQL string, not
# exposed as importable constants.
_BOXSET_MARKERS = re.compile(
    r"(box ?set|boxset|deluxe|anthology|complete|collection|discograf|"
    r"[2-9] ?[- ]?lp|1[0-9] ?[- ]?lp|[2-9] ?cd|super ?deluxe|"
    r"years|greatest hits|best of|essential|compilation|live|"
    r"int[ée]grale|1[89][0-9]{2} ?[-–] ?[12][0-9]{3})",
    re.IGNORECASE,
)
_SINGLE_MARKERS = re.compile(r'(single|7"|10"|12"|\bep\b|maxi|b/w|b-w|remix)', re.IGNORECASE)
_STUB_MAX_MS = 15 * 60 * 1000


def bad_tracklist_reason(titulo: str, tracks: list[dict], primary_type: str | None) -> str | None:
    """None if the tracklist shape looks plausible for this product title,
    else 'BOX' or 'STUB' (see flag_bad_tracklists.py for the reasoning)."""
    n = len(tracks)
    if n > 30 and not _BOXSET_MARKERS.search(titulo or ""):
        return "BOX"
    if 1 <= n <= 2 and not _SINGLE_MARKERS.search(titulo or "") and primary_type == "Album":
        total_ms = sum(t["length"] for t in tracks if isinstance(t.get("length"), int))
        has_all_lengths = all(isinstance(t.get("length"), int) for t in tracks)
        if has_all_lengths and total_ms < _STUB_MAX_MS:
            return "STUB"
    return None


def _write_with_retry(conn, sql, params, attempts=5):
    cur = conn.cursor()
    for attempt in range(attempts):
        try:
            cur.execute(sql, params)
            conn.commit()
            return
        except Exception as exc:
            conn.rollback()
            if "deadlock" not in str(exc).lower() or attempt == attempts - 1:
                raise
            time.sleep(2 * (attempt + 1))
            cur = conn.cursor()


def verify_and_fix_mb(conn, slug: str, artista: str, titulo: str, album_clean: str,
                       mb_title: str | None, mb_mbid: str | None,
                       mb_primary_type: str | None, mb_tracklist_raw: str | None,
                       delay: float = 1.1, apply: bool = True) -> dict:
    """
    Checks the record's stored MB match against its own title/tracklist; if
    it looks wrong, re-searches and re-fetches (writing the fix when
    apply=True). Returns the current-as-of-now values as a dict:
        {"mb_title": str|None, "mb_tracklist": list[dict]|None,
         "fixed": bool, "reason": str|None}
    so callers (e.g. wikipedia_bio_fetch.py) know whether tracklist data is
    now actually available, without re-querying the DB.
    """
    tracks = json.loads(mb_tracklist_raw) if mb_tracklist_raw else None

    bad_title = not mb_mbid or not title_matches_loosely(mb_title, album_clean, artista)
    reason = None
    if not bad_title and tracks:
        reason = bad_tracklist_reason(titulo, tracks, mb_primary_type)

    if not bad_title and not reason:
        return {"mb_title": mb_title, "mb_tracklist": tracks, "fixed": False, "reason": None}

    reason = reason or ("NO_MATCH" if not mb_mbid else "TITLE_MISMATCH")

    hit = search_release_group(artista, album_clean)
    time.sleep(delay)

    if hit:
        if apply:
            _write_with_retry(
                conn,
                """UPDATE "Disco"
                   SET mb_mbid = %s, mb_title = %s, mb_first_release_date = %s,
                       mb_primary_type = %s, mb_genres = %s, mb_tracklist = NULL
                   WHERE slug = %s""",
                (hit["mbid"], hit["title"], hit["first_release_date"],
                 hit["primary_type"], hit["genres"], slug),
            )
        new_tracks = fetch_tracklist(hit["mbid"])
        time.sleep(delay)
        if new_tracks:
            if apply:
                _write_with_retry(
                    conn,
                    """UPDATE "Disco" SET mb_tracklist = %s WHERE slug = %s""",
                    (json.dumps(new_tracks, ensure_ascii=False), slug),
                )
            return {"mb_title": hit["title"], "mb_tracklist": new_tracks, "fixed": True, "reason": reason}
        return {"mb_title": hit["title"], "mb_tracklist": None, "fixed": True, "reason": reason}

    if apply:
        _write_with_retry(
            conn,
            """UPDATE "Disco"
               SET mb_mbid = '', mb_title = NULL, mb_first_release_date = NULL,
                   mb_primary_type = NULL, mb_genres = NULL, mb_tracklist = NULL
               WHERE slug = %s""",
            (slug,),
        )
    return {"mb_title": None, "mb_tracklist": None, "fixed": True, "reason": reason}
