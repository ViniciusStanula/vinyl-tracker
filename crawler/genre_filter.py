"""
genre_filter.py — decide whether a MusicBrainz tag is really a musical genre.

mb_enrich falls back to MusicBrainz *folksonomy tags* when a release-group has
no curated genres, and those tags are free text. German music sites' users tag
albums with their own site names and chart metadata, so the catalog accumulated
values like "offizielle charts" (694 rows), "1-4 wochen" (237), "plattentests.de"
(128), "laut.de" (92), "ph_2_stars", bare years and even a raw MBID.

A blocklist (the old NON_GENRE_TAGS) can never keep up with free text, so this
is an allowlist: MusicBrainz's own curated genre vocabulary (~2181 entries,
mb_genre_vocab.json, refreshable from /ws/2/genre/all) plus EXTRA_ALLOWED for
genre names in common use that MB's list happens to omit.

Matching is on a normalised form (case, accents, spacing and punctuation
stripped) so "synthpop" matches MB's "synth-pop" and "hip-hop" matches "hip hop".
"""
import json
import os
import re
import unicodedata

_HERE = os.path.dirname(os.path.abspath(__file__))
VOCAB_PATH = os.path.join(_HERE, "mb_genre_vocab.json")

# Real genre names MB's curated list omits. Kept deliberately short: every entry
# is a style someone would browse by, not a descriptor. Things like "live",
# "compilation", "concept album", "double album", "self-titled" and "animal on
# cover" describe the release, not its music, so they are NOT here.
EXTRA_ALLOWED = frozenset({
    "rap", "soundtrack", "hardcore", "alternative", "indie", "fusion",
    "adult contemporary", "acoustic", "bop", "modal", "rhythm and blues",
    "chanson", "world", "world music", "minimal", "standards",
    "rock & roll", "rock and roll", "funk soul", "urban", "score",
    "ost", "vgm", "christmas", "album rock",
})


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower().strip())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", s)


def _load_allowed() -> frozenset[str]:
    try:
        with open(VOCAB_PATH, encoding="utf-8") as f:
            vocab = json.load(f)
    except FileNotFoundError:  # vocab file is optional; EXTRA_ALLOWED still applies
        vocab = []
    return frozenset(_norm(g) for g in vocab) | frozenset(_norm(g) for g in EXTRA_ALLOWED)


_ALLOWED = _load_allowed()


def is_genre(tag: str) -> bool:
    """True when the tag is a recognised musical genre."""
    if not tag or not tag.strip():
        return False
    n = _norm(tag)
    if not n:
        return False
    # A tag carrying several genres ("pop/rock/indie/electronic", "rap/hip-hop")
    # is a site's category string, not a genre — the caller stores one per slot.
    if tag.count("/") >= 1 and len(tag) > 12:
        return False
    return n in _ALLOWED


def filter_genres(tags) -> list[str]:
    """Keep only real genres, preserving order and dropping duplicates."""
    out, seen = [], set()
    for t in tags:
        t = (t or "").strip()
        if not is_genre(t):
            continue
        n = _norm(t)
        if n in seen:
            continue
        seen.add(n)
        out.append(t)
    return out
