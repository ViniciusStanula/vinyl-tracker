"""
lastfm.py — Last.fm tag enrichment for the vinyl crawler.

Fetches top genre tags from Last.fm's artist.getTopTags endpoint and writes
them to Disco.lastfm_tags.  Called once per new artist; tags are never
overwritten once stored (NULL → empty-string or comma-separated list).

Requires LASTFM_API_KEY environment variable.
Rate limit: Last.fm free API allows ~5 req/s.  Use a >=0.2 s delay between calls.
"""
import re
import json
import time
import logging
import urllib.parse
import urllib.request
from difflib import SequenceMatcher

from database import (
    fetch_untagged_artists,
    bulk_update_tags,
    fetch_albums_needing_lastfm_enrichment,
    bulk_update_lastfm_album_info,
)

log = logging.getLogger(__name__)

LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/"

# Minimum _match_score to accept an album.search candidate as the correct album.
# Token-set equality scores 1.0; pure SequenceMatcher must clear 0.90 to
# keep "Led Zeppelin IV" → "Led Zeppelin" (0.889) out of the fallback results.
_SEARCH_CONFIDENCE_THRESHOLD = 0.90

# Tags that carry no genre information — personal labels, nationality markers,
# subjective adjectives, era labels, and instrument mentions.
NON_GENRE_TAGS: frozenset[str] = frozenset({
    # Personal / subjective
    "seen live", "beautiful", "favourite", "my favourite", "my favorites",
    "favorite", "favorites", "love", "awesome", "best", "amazing", "great",
    "perfect", "legend", "legends", "excellent", "loved", "buy", "under review",
    "spotify", "youtube", "all", "albums i own", "artists i've seen live",
    # Instruments / vocals (not genres)
    "guitar", "bass", "drums", "vocals", "instrumental", "piano", "keyboards",
    "male vocalists", "female vocalists",
    # Nationality (not genre)
    "american", "british", "german", "french", "swedish", "english", "scottish",
    "canadian", "australian", "norwegian", "brazilian", "japanese", "korean",
    "italian", "spanish", "portuguese", "irish", "danish", "finnish",
    # Generic descriptors
    "classic", "classics", "oldies", "retro", "vintage",
})

# Artist placeholder used when Amazon doesn't provide a name.
_UNKNOWN_RE = re.compile(r"artista\s+n[ãa]o\s+identificad[oa]", re.IGNORECASE)


def _uninvert(name: str) -> str:
    """Convert 'LAST, FIRST' to 'FIRST LAST' to match Last.fm entries."""
    if "," not in name:
        return name
    last, _, first = name.partition(",")
    first = first.strip()
    last = last.strip()
    return f"{first} {last}" if first else name


def fetch_artist_tags(artist_name: str, api_key: str, max_tags: int = 3) -> list[str]:
    """
    Returns up to max_tags genre tags for artist_name from Last.fm.
    Returns [] for placeholder artists, on API errors, or if no genre tags exist.
    """
    if _UNKNOWN_RE.search(artist_name):
        return []

    name = _uninvert(artist_name)
    params = urllib.parse.urlencode({
        "method": "artist.getTopTags",
        "artist": name,
        "api_key": api_key,
        "format": "json",
    })

    try:
        with urllib.request.urlopen(f"{LASTFM_BASE}?{params}", timeout=10) as resp:
            data = json.loads(resp.read())
    except Exception as exc:
        log.debug("Last.fm request failed for %r: %s", artist_name, exc)
        return []

    if "error" in data:
        log.debug("Last.fm API error for %r (%s): %s",
                  artist_name, data.get("error"), data.get("message"))
        return []

    raw_tags: list[dict] = data.get("toptags", {}).get("tag", [])
    tags: list[str] = []
    for tag in raw_tags:
        label = tag.get("name", "").lower().strip()
        if not label or len(label) < 2 or len(label) > 40:
            continue
        if label in NON_GENRE_TAGS:
            continue
        tags.append(label)
        if len(tags) >= max_tags:
            break

    return tags


def enrich_new_artists(
    conn,
    artistas: set[str],
    api_key: str | None,
    delay: float = 0.21,
    deadline: float | None = None,
) -> int:
    """
    Fetches Last.fm tags for artists in `artistas` that have lastfm_tags IS NULL.
    Stores the result (even if empty) so they are not re-fetched next run.
    Returns the number of artists updated.

    `delay` controls the inter-request pause (≥0.2 s keeps us under 5 req/s).
    `deadline` is a monotonic timestamp; the loop stops early when reached so
    the caller's hard time limit is respected. Unprocessed artists remain NULL
    and will be picked up on the next run.
    """
    if not api_key:
        log.debug("LASTFM_API_KEY not set — skipping tag enrichment.")
        return 0

    # Only process artistas from this batch that still have NULL tags in the DB.
    needs_tags = fetch_untagged_artists(conn, list(artistas))
    if not needs_tags:
        log.debug("Tag enrichment: all artists in this batch already have tags.")
        return 0

    log.info("Tag enrichment: fetching tags for %d new artists.", len(needs_tags))
    updates: dict[str, str] = {}

    for i, artista in enumerate(needs_tags, 1):
        if deadline is not None and time.monotonic() >= deadline:
            log.info("Tag enrichment: deadline reached — saved %d/%d, remaining picked up next run.", i - 1, len(needs_tags))
            break
        tags = fetch_artist_tags(artista, api_key)
        updates[artista] = ", ".join(tags)   # "" if no tags — marks as fetched
        log.debug("[%d/%d] %r → %r", i, len(needs_tags), artista, updates[artista])
        if i < len(needs_tags):
            time.sleep(delay)

    return bulk_update_tags(conn, updates)


# ── Album enrichment ──────────────────────────────────────────────────────────

_VINYL_WORDS = re.compile(
    r"\b(vinyl|vinil|lp|gram|colored|colou?red|remaster(?:ed)?|reissue|gatefold|"
    r"splatter|exclusive|amazon|180|140|clear|gold|green|silver|blue|red|black|"
    r"white|orange|purple|pink|yellow|repress|anniversary|deluxe|edition)\b",
    re.IGNORECASE,
)


def clean_album_title(title: str, artist: str) -> str:
    """
    Strips Amazon vinyl edition suffixes so titles match Last.fm.

    "My Love Is Cool [Disco de Vinil]"               → "My Love Is Cool"
    "Dark Roots of Earth - Clear Gold Green Splatter" → "Dark Roots of Earth"
    "Dua Lipa - Dua Lipa [Disco de Vinil]"            → "Dua Lipa"
    "Fórmula, Vol. 3 (Amazon Exclusive Vinyl)"        → "Fórmula, Vol. 3"
    """
    t = title
    prefix = re.compile(r"^" + re.escape(artist) + r"\s*-\s*", re.IGNORECASE)
    t = prefix.sub("", t)
    t = re.sub(r"\s*\[[^\]]*\]", "", t)
    t = re.sub(
        r"\s*\([^)]*\)",
        lambda m: "" if _VINYL_WORDS.search(m.group()) else m.group(),
        t,
    )
    dash = t.rfind(" - ")
    if dash > 0 and _VINYL_WORDS.search(t[dash + 3:]):
        t = t[:dash]
    return t.strip()


_PUNCT_RE = re.compile(r"[^\w\s]")


def _normalize(s: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    return _PUNCT_RE.sub("", s.lower()).split()


def _match_score(query: str, result: str) -> float:
    """
    Confidence that a Last.fm search result matches the cleaned query.

    Returns 0.0–1.0.  Used by _album_search_fallback to reject wrong albums.

    Strategy:
      - Normalize both to token sets (lowercase, no punctuation).
      - Score 1.0 if token sets are equal (handles "The X" ↔ "X").
      - Otherwise SequenceMatcher ratio — must clear _SEARCH_CONFIDENCE_THRESHOLD
        to keep "Led Zeppelin IV" → "Led Zeppelin" (0.889) rejected.
    """
    qt = _normalize(query)
    rt = _normalize(result)
    if not qt or not rt:
        return 0.0

    # Same token sets (order/duplicates ignored) → confident match.
    # clean_album_title already strips edition words, so Last.fm normally
    # returns the same base title; set equality handles "The X" ↔ "X" too.
    if set(qt) == set(rt):
        return 1.0

    return SequenceMatcher(None, " ".join(qt), " ".join(rt)).ratio()



def _clean_wiki(html: str) -> str:
    """Strip Last.fm self-links, HTML tags, disambiguation preamble, and legal footer."""
    text = re.sub(
        r'<a[^>]*href="https?://www\.last\.fm[^"]*"[^>]*>.*?</a>',
        "",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    # Convert block-level tags to paragraph markers before stripping HTML
    text = re.sub(r"</?(p|br|div|h[1-6])[^>]*>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    # Collapse non-newline whitespace, then normalise paragraph breaks
    text = re.sub(r"[^\S\n]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Strip disambiguation preamble — Last.fm marks current album with "(seen here)"
    text = re.sub(r"^.*?\(seen here\)\s*", "", text, flags=re.IGNORECASE)
    # Strip legal footer added by Last.fm to all wiki entries
    text = re.sub(
        r"\s*User-contributed text.*$", "", text, flags=re.IGNORECASE | re.DOTALL
    )
    text = text.strip()
    # If no paragraph breaks exist, insert them every 4 sentences
    if "\n" not in text:
        sentences = re.split(r"(?<=[.!?])\s+", text)
        chunks = [" ".join(sentences[i:i+4]) for i in range(0, len(sentences), 4)]
        text = "\n\n".join(chunks)
    return text


def _album_search_fallback(artist: str, cleaned: str, api_key: str) -> dict | None:
    """
    Falls back to album.search when album.getInfo finds nothing.

    Searches Last.fm by title + artist, scores each candidate with _match_score,
    and re-fetches via album.getInfo only if the best match clears
    _IMG_CONFIDENCE_THRESHOLD.  This handles non-exact titles, regional
    variants, and albums whose canonical name differs slightly from the
    cleaned Amazon title.
    """
    params = urllib.parse.urlencode({
        "method":  "album.search",
        "album":   cleaned,
        "artist":  _uninvert(artist),
        "api_key": api_key,
        "format":  "json",
        "limit":   5,
    })
    try:
        with urllib.request.urlopen(f"{LASTFM_BASE}?{params}", timeout=10) as resp:
            data = json.loads(resp.read())
    except Exception as exc:
        log.debug("album.search failed for %r / %r: %s", artist, cleaned, exc)
        return None

    candidates = (
        data.get("results", {})
            .get("albummatches", {})
            .get("album", [])
    )
    if not candidates:
        log.debug("album.search: no candidates for %r / %r", artist, cleaned)
        return None

    best_name:  str   = ""
    best_score: float = 0.0
    for c in candidates:
        name  = c.get("name", "")
        score = _match_score(cleaned, name)
        if score > best_score:
            best_score = score
            best_name  = name

    if best_score < _SEARCH_CONFIDENCE_THRESHOLD or not best_name:
        log.debug(
            "album.search fallback: no confident match for %r / %r (best=%.2f %r)",
            artist, cleaned, best_score, best_name,
        )
        return None

    log.debug(
        "album.search fallback: matched %r (score=%.2f) for %r / %r",
        best_name, best_score, artist, cleaned,
    )
    return fetch_album_info(artist, best_name, api_key)


def fetch_album_info(artist: str, album: str, api_key: str) -> dict | None:
    """
    Fetches listeners, playcount, and wiki text from Last.fm album.getInfo.
    Returns None on any error or if album not found.
    """
    params = urllib.parse.urlencode({
        "method":  "album.getInfo",
        "artist":  _uninvert(artist),
        "album":   album,
        "api_key": api_key,
        "format":  "json",
    })
    try:
        with urllib.request.urlopen(f"{LASTFM_BASE}?{params}", timeout=10) as resp:
            data = json.loads(resp.read())
    except Exception as exc:
        log.debug("album.getInfo failed for %r / %r: %s", artist, album, exc)
        return None

    if "error" in data or "album" not in data:
        log.debug("album.getInfo: no result for %r / %r", artist, album)
        return None

    info = data["album"]
    raw_wiki = (info.get("wiki") or {}).get("content") or (info.get("wiki") or {}).get("summary") or ""
    return {
        "listeners":   int(info.get("listeners") or 0),
        "playcount":   int(info.get("playcount") or 0),
        "wiki_en":     _clean_wiki(raw_wiki) or None,
        "lastfm_name": info.get("name", ""),
    }


def enrich_album_infos(
    conn,
    api_key: str | None,
    delay: float = 0.5,
    deadline: float | None = None,
    limit: int = 500,
    exclude_unidentified: bool = False,
) -> int:
    """
    Fetches Last.fm album.getInfo for albums where lastfm_listeners IS NULL.
    Writes listeners, playcount, and English wiki to the DB.
    Returns the number of albums updated.
    """
    if not api_key:
        log.debug("LASTFM_API_KEY not set — skipping album enrichment.")
        return 0

    albums = fetch_albums_needing_lastfm_enrichment(
        conn, limit=limit, exclude_unidentified=exclude_unidentified
    )
    if not albums:
        log.debug("Album enrichment: all albums already enriched.")
        return 0

    log.info("Album enrichment: fetching Last.fm data for %d albums.", len(albums))
    updates: list[dict] = []

    for i, album in enumerate(albums, 1):
        if deadline is not None and time.monotonic() >= deadline:
            log.info("Album enrichment: deadline reached — processed %d/%d.", i - 1, len(albums))
            break
        cleaned = clean_album_title(album["titulo"], album["artista"])
        info = fetch_album_info(album["artista"], cleaned, api_key)
        if info is None:
            info = _album_search_fallback(album["artista"], cleaned, api_key)

        listeners = info["listeners"] if info else 0
        status    = f"listeners={listeners}" if info else "not found on Last.fm"
        log.info(
            "[%d/%d] %-30s / %-35s → %s",
            i, len(albums),
            album["artista"][:30], cleaned[:35],
            status,
        )

        updates.append({
            "id":        album["id"],
            "listeners": info["listeners"] if info else 0,
            "playcount": info["playcount"] if info else 0,
            "wiki_en":   info["wiki_en"]   if info else None,
        })
        if i < len(albums):
            time.sleep(delay)

    log.info("Album enrichment done: %d records processed.", len(updates))
    return bulk_update_lastfm_album_info(conn, updates)
