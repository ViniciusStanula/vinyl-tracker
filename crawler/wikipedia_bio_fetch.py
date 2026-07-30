"""
wikipedia_bio_fetch.py — find + fetch English Wikipedia album extracts for
Disco records that have no lastfm_wiki_pt/sobre_pt, as grounding source for
Claude Code to write sobre_pt bios (test of an alternative source to Last.fm).

Usage:
    python wikipedia_bio_fetch.py --limit 50 --out wiki_candidates.json

For each candidate:
    1. clean_album_title() to strip Amazon junk from the raw title
    2. Wikipedia full-text search for "<title> <artist>"
    3. Take the top hit only if its page title's first "word chunk" plausibly
       matches the cleaned album title AND the extract text contains the
       artist's name (cheap confidence check — avoids writing a bio grounded
       on the wrong page, e.g. a same-titled unrelated article)
    4. Fetch the plain-text extract (intro section) for confirmed matches

Writes a JSON list of {slug, artista, titulo, titulo_clean, wiki_title, wiki_url,
extract} for confirmed matches only. Records with no confident match are
skipped and counted, not written.
"""
import argparse
import io
import json
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

import requests

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from database import get_connection
from lastfm import clean_album_title
from mb_verify import verify_and_fix_mb

API_URL = "https://en.wikipedia.org/w/api.php"
HEADERS = {"User-Agent": "GarimpaVinil/1.0 (vinicius.stanula@gmail.com)"}
RATE_LIMIT = 0.3


def search_candidate(artista: str, titulo_clean: str):
    params = {
        "action": "query",
        "list": "search",
        "srsearch": f"{titulo_clean} {artista}",
        "srlimit": 3,
        "format": "json",
    }
    r = requests.get(API_URL, params=params, headers=HEADERS, timeout=8)
    r.raise_for_status()
    hits = r.json()["query"]["search"]
    return hits


def fetch_extract(page_title: str):
    params = {
        "action": "query",
        "prop": "extracts",
        "explaintext": 1,
        "exintro": 1,
        "titles": page_title,
        "format": "json",
    }
    r = requests.get(API_URL, params=params, headers=HEADERS, timeout=8)
    r.raise_for_status()
    pages = r.json()["query"]["pages"]
    for page in pages.values():
        return page.get("extract", "")
    return ""


import re

# Disambiguators that mean "definitely not the album page", even though the
# page will often still mention "album" somewhere (a song/tour/musical page
# routinely name-drops the parent album it came from).
_WRONG_TYPE = re.compile(r"\b(song|tour|musical|film|soundtrack|tv series)\b", re.IGNORECASE)

# _WRONG_TYPE only ever checked hit_title, but a Wikipedia SONG page's title
# is usually just the song's own name -- the "wrong type" signal instead
# shows up in the extract's own opening clause. Confirmed live: "Smokin' in
# the Boys Room" (title has no "song" in it) matched the Disco listing "Yeah
# - Smokin' In The Boys Room", and its extract opens '"Smokin' in the Boys
# Room" is a song originally recorded by Brownsville Station in 1973 on
# their album Yeah!' -- describes the SONG, not the album, would have
# misgrounded the bio despite is_about_album passing (the word "album"
# appears, just about a different, parent work).
_EXTRACT_WRONG_TYPE = re.compile(
    r'^"?[^".]{0,80}"?\s+is\s+(a|an)\s+(song|single|track)\b', re.IGNORECASE
)

# Listing titles that bundle 2+ distinct albums into one Disco record (e.g. a
# "Complete Vinyl Set" or "2-Pack"). A single Wikipedia album page can only
# ever describe one of the bundled albums, so grounding a bio on it would
# misrepresent the actual product — skip these outright rather than risk a
# confident-but-wrong match (see the Harry Styles "Fine Line" false-bundle
# case from the first test batch).
_BUNDLE_TITLE = re.compile(
    r"\b(box\s?set|discography|vinyl set|vinyl collection|vinyl studio album|"
    r"collection\b.*\(|2-pack|3-pack|\d-pack|complete vinyl|album set|"
    r"vinyl pack|bonus art card|bonus inner-sleeve|\d\s?lp\s?boxset)\b",
    re.IGNORECASE,
)


# \s+ not literal spaces: Wikipedia's disambiguation-list boilerplate can
# carry a double space ("Death metal may  also refer to:") that a single
# literal space silently fails to match. Confirmed live: this let a
# disambiguation page (Dismember's "DEATH METAL" listing matched to the
# genre-name disambig page) through as a "confident" match.
_DISAMBIG = re.compile(r"may\s+(also\s+)?refer to:?", re.IGNORECASE)

# A "Live" or "Best Of"/compilation listing routinely matches the artist's
# ORIGINAL studio album page on title alone (e.g. "X: Live In LA" vs the
# Wikipedia page "X"), because the search query strips down to the core
# title. Reject when the Disco title carries one of these markers but the
# matched Wikipedia page title doesn't — a real live/compilation Wikipedia
# page would carry the same marker in its own title.
_LIVE_TITLE = re.compile(r"\blive\b", re.IGNORECASE)
_COMPILATION_TITLE = re.compile(
    r"\b(best of|greatest hits|anthology|compilation|the very best|super hits)\b",
    re.IGNORECASE,
)


def _norm_title(s: str) -> str:
    # "&" vs "and" is a real, common difference between an Amazon listing
    # title and MB/Wikipedia's canonical title (confirmed: "Flesh & Blood"
    # vs Wikipedia's "Flesh and Blood" was rejected on this alone before this
    # normalization existed). Same fold mb_verify.py/audit_mb_titles.py
    # already use for the equivalent MB-title comparison.
    return s.lower().replace("&", "and").strip()


def _contains_whole(needle: str, haystack: str) -> bool:
    # Plain "in" lets a substring match across a word boundary that changes
    # meaning -- confirmed live: hit_core "romance" matched inside product
    # title "...mis romances" (a DIFFERENT, later Luis Miguel album) purely
    # because "romance" is a prefix of "romances". \b...\b requires the
    # matched span to end/start on a real word boundary, so "romance" no
    # longer matches inside "romances" (no boundary between "e" and "s").
    if not needle:
        return False
    return re.search(r"\b" + re.escape(needle) + r"\b", haystack) is not None


def is_confident_match(hit_title: str, titulo: str, titulo_clean: str, artista: str, extract: str) -> bool:
    # Cheap heuristics, deliberately conservative — false negatives (skip a
    # real match) are fine, false positives (wrong page) are not.
    title_lower = _norm_title(titulo_clean)
    hit_lower = hit_title.lower()
    # Strip Wikipedia disambiguation suffix like " (Coldplay album)" for comparison.
    hit_core = _norm_title(hit_lower.split(" (")[0])
    # Compare against hit_core, not hit_lower. The disambiguator often IS the
    # artist name ("(John Mayall album)") — when a Disco product's title is
    # just the bare artist name (an incomplete/bad Amazon listing), checking
    # against the full hit_lower makes "john mayall" trivially match ANY
    # album by John Mayall, since the artist name sits right there in the
    # suffix. Confirmed: "John Mayall" (product) matched "Back to the Roots
    # (John Mayall album)" this way — a real album, just the wrong one.
    title_matches = title_lower == hit_core or _contains_whole(title_lower, hit_core) or _contains_whole(hit_core, title_lower)
    artist_in_extract = artista.lower() in extract.lower()
    if _WRONG_TYPE.search(hit_title) or _EXTRACT_WRONG_TYPE.search(extract[:150]):
        return False
    # Disambiguation pages ("X may refer to: ...") list several unrelated
    # works and often name-drop the artist + "album" somewhere in the list,
    # fooling the checks below. Reject outright — this is prose, not an
    # article about the record itself.
    if _DISAMBIG.search(extract[:200]):
        return False
    # Check the RAW titulo too, not just titulo_clean. clean_album_title can
    # strip "Live"/edition-marker words as junk before this function ever
    # sees them -- confirmed live: "History of the Grateful Dead Vol. 1
    # (Bear's Choice) [Live] [50th Anniversary Edition]" cleaned down to
    # "History of the Grateful Dead Vol. 1 (Bear's Choice)", losing "Live"
    # entirely, so this guard silently never fired and the record matched
    # the band's unrelated 1967 studio debut instead of anything about the
    # actual live release. Same failure emptied "Marvin Gaye Vinyl - Let's
    # Get It On... Live..." down to just "Marvin Gaye", which then matched
    # a random early album via the bare-artist-name trap above.
    if (_LIVE_TITLE.search(titulo_clean) or _LIVE_TITLE.search(titulo)) and not _LIVE_TITLE.search(hit_title):
        return False
    if (_COMPILATION_TITLE.search(titulo_clean) or _COMPILATION_TITLE.search(titulo)) and not _COMPILATION_TITLE.search(hit_title):
        return False
    # An album/EP's Wikipedia intro sentence almost always uses the word
    # "album" or "EP" itself ("... is a/the studio album by ..."). Was
    # "first sentence" via extract.split(". ", 1)[0], but that breaks on any
    # abbreviation period before the real sentence end — "Listen Without
    # Prejudice Vol. 1 is the second solo studio album..." truncated at
    # "Vol." and never reached "album", wrongly rejecting a real match. A
    # fixed leading window is robust to that and still excludes a song/tour
    # page's later, unrelated mention of the parent album (same intent the
    # sentence-split was going for).
    intro_window = extract[:220].lower()
    is_about_album = "album" in intro_window or re.search(r"\bep\b", intro_window)
    # Was >= 200 -- rejected genuinely valid short extracts. Confirmed live:
    # "Passion and Warfare" (Steve Vai, certified Gold, unambiguously the
    # right album -- title/artist/is_about_album all passed) has a real
    # Wikipedia intro of only 173 chars ("...is the second studio album by
    # guitarist Steve Vai, released on May 22, 1990... certified Gold by the
    # RIAA."), two complete factual sentences, just short. 80 still rejects
    # genuinely degenerate stubs (a single sub-sentence fragment) without
    # punishing an artist/album whose Wikipedia page just isn't long.
    return title_matches and artist_in_extract and bool(is_about_album) and len(extract.strip()) >= 80


# Known-bad slugs that keep resurfacing every run because sobre_pt stays NULL
# after we hold them out (they never get "used up" like a real write would).
# Each is a genuine one-off data issue, not a pattern worth a heuristic rule:
# - take-cover-disco-de-vinil-98buka: Disco's own `artista` column is literally
#   "Take Cover" (matches the title, not a real band name) — collides with
#   Queensrÿche's unrelated "Take Cover" album. DB data-quality issue, not a
#   matcher bug.
EXCLUDE_SLUGS = {
    "take-cover-disco-de-vinil-98buka",
    # Peter Gabriel self-titled his first four solo albums (1977, 1978, 1980,
    # 1982 -- fans call them "Car"/"Scratch"/"Melt"/"Security" but Wikipedia's
    # own page titles disambiguate only by year). This product is the 4th
    # ("Security"), but every source disagrees on which one: the matched
    # Wikipedia extract keeps landing on the 2nd (1978) or 3rd (1980) album,
    # while mb_tracklist/mb_first_release_date point at the 1st (1977).
    # Recurred identically across 3 separate batches (2026-07-29/30) with zero
    # progress each time since sobre_pt never gets written -- excluding
    # outright rather than re-spending API calls on it every run.
    "peter-gabriel-4-security-ll5tnj",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--out", required=True)
    ap.add_argument("--apply-mb-fix", action="store_true",
                     help="write MB re-matches for candidates with a wrong/missing "
                          "match instead of just previewing them (default: dry run)")
    ap.add_argument("--mb-delay", type=float, default=1.1)
    args = ap.parse_args()

    conn = get_connection()
    cur = conn.cursor()
    # Was "AND d.mb_tracklist IS NOT NULL", which silently skipped forever any
    # record whose MB match had never been found or was cleared — bios could
    # never surface for those. Now selects mb_title/mb_mbid/mb_primary_type/
    # mb_tracklist too, so the loop below can verify (and fix, via
    # mb_verify.verify_and_fix_mb) each candidate's MB match before deciding
    # whether it has a usable tracklist -- fixing the tracklist as a
    # byproduct of processing the record for a bio, not a separate pass.
    cur.execute(
        """
        SELECT d.slug, d.artista, d.titulo, count(b.id) AS hits,
               d.mb_title, d.mb_mbid, d.mb_primary_type, d.mb_tracklist
        FROM "Disco" d
        JOIN bot_hits b ON b.path = '/disco/' || d.slug
        WHERE d.disponivel = TRUE AND (d.format IS NULL OR d.format = 'vinyl')
          AND d.sobre_pt IS NULL AND d.lastfm_wiki_pt IS NULL
        GROUP BY d.slug, d.artista, d.titulo, d.mb_title, d.mb_mbid, d.mb_primary_type, d.mb_tracklist
        ORDER BY hits DESC
        LIMIT %s
        """,
        (args.limit,),
    )
    rows = cur.fetchall()

    matched = []
    skipped = 0
    bundle_skipped = 0
    mb_fixed = 0
    no_tracklist = 0
    for slug, artista, titulo, hits, mb_title, mb_mbid, mb_primary_type, mb_tracklist_raw in rows:
        if slug in EXCLUDE_SLUGS:
            skipped += 1
            print(f"SKIP   {artista} - {titulo}  (excluded slug)")
            continue
        if _BUNDLE_TITLE.search(titulo):
            bundle_skipped += 1
            print(f"SKIP   {artista} - {titulo}  (bundle listing)")
            continue
        titulo_clean = clean_album_title(titulo, artista)

        mb_result = verify_and_fix_mb(
            conn, slug, artista, titulo, titulo_clean,
            mb_title, mb_mbid, mb_primary_type, mb_tracklist_raw,
            delay=args.mb_delay, apply=args.apply_mb_fix,
        )
        if mb_result["fixed"]:
            mb_fixed += 1
            print(f"MB-FIX {artista} - {titulo_clean}  ({mb_result['reason']}) "
                  f"-> {mb_result['mb_title'] or '(no confident match)'}"
                  f"{'' if args.apply_mb_fix else '  [dry run, not written]'}")
        if not mb_result["mb_tracklist"]:
            no_tracklist += 1
            skipped += 1
            print(f"SKIP   {artista} - {titulo_clean}  (no MB tracklist)")
            continue

        try:
            hits = search_candidate(artista, titulo_clean)
        except Exception as exc:
            print(f"SEARCH_ERROR {slug}: {exc}", file=sys.stderr)
            skipped += 1
            continue
        time.sleep(RATE_LIMIT)

        found = None
        for hit in hits:
            try:
                extract = fetch_extract(hit["title"])
            except Exception as exc:
                print(f"EXTRACT_ERROR {slug} / {hit['title']}: {exc}", file=sys.stderr)
                continue
            time.sleep(RATE_LIMIT)
            if is_confident_match(hit["title"], titulo, titulo_clean, artista, extract):
                found = (hit["title"], extract)
                break

        if found:
            wiki_title, extract = found
            matched.append({
                "slug": slug,
                "artista": artista,
                "titulo": titulo,
                "titulo_clean": titulo_clean,
                "wiki_title": wiki_title,
                "wiki_url": f"https://en.wikipedia.org/wiki/{wiki_title.replace(' ', '_')}",
                "extract": extract,
            })
            print(f"MATCH  {artista} - {titulo_clean}  ->  {wiki_title}")
        else:
            skipped += 1
            print(f"SKIP   {artista} - {titulo_clean}  (no confident match)")

    conn.close()

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(matched, f, ensure_ascii=False, indent=2)

    print(
        f"\nDone. {len(matched)} matched, {skipped} skipped "
        f"({no_tracklist} for no MB tracklist), {bundle_skipped} bundle-skipped, "
        f"{mb_fixed} MB re-matches {'applied' if args.apply_mb_fix else '(dry run)'}, "
        f"{len(rows)} total. Wrote {args.out}"
    )


if __name__ == "__main__":
    main()
