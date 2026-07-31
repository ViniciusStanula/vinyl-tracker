"""
recover_artist_from_title.py — recover 'Artista não identificado' from the
product title, validated against artists that already exist in the catalogue.

Amazon listings frequently carry the artist in the title itself, but the layout
varies and BOTH orders occur:

    "Vinile Joy Division - Closer ..."        -> artist on the LEFT
    "BACK TO BACK - DUKE ELLINGTON & ..."     -> artist on the RIGHT
    "LP Vinil Onéssimo Gomes - Canta Em ..."  -> format prefix, then artist

So guessing "left of the dash" is wrong roughly as often as it is right.
Instead: split on every dash, normalise each side, and accept a side ONLY if
that exact name is already an artista on some other record. An artist we
already track is strong evidence; an unrecognised string is not.

Ambiguous cases (both sides known, or neither) are reported, never written.

Usage:
    python recover_artist_from_title.py                  # dry run (default)
    python recover_artist_from_title.py --apply          # write
    python recover_artist_from_title.py --limit 50
"""
import argparse
import io
import re
import sys
import unicodedata
from collections import Counter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from db_retry import connect_with_retry

UNIDENTIFIED = "Artista não identificado"

# Format/marketing noise that sits in front of the real artist name.
_LEAD_NOISE = re.compile(
    r"^\s*(?:disco\s+de\s+vin(?:il|yl)(?:\s+novo)?|lp\s+vinil|vinil|vinile|vinyl|"
    r"lp|cd|novo)\b[\s\-–—:]*",
    re.IGNORECASE,
)
# Edition/format junk that trails the artist on the right-hand side.
_TRAIL_NOISE = re.compile(
    r"\s*[\(\[].*$|\s*[-–—]\s*(?:exclusive|limited|colored|coloured|picture|gatefold|"
    r"indie|amazon|rsd|deluxe|remaster).*$",
    re.IGNORECASE,
)


# Words that are vinyl colours / edition descriptors AND also happen to be real
# band names in the catalogue ("Red", "White", "Pink", "Aqua"...). In the
# "<album> - <word>" tail position they are virtually always the pressing
# colour, so the catalogue lookup "confirms" a band that has nothing to do with
# the record. Confirmed on the first dry run: 8 of 44 proposals were these.
# Also blocks non-artist labels that leaked into the artista column ("OST").
_NOT_AN_ARTIST = {
    "red", "white", "black", "blue", "green", "pink", "orange", "yellow",
    "purple", "violet", "gold", "golden", "silver", "aqua", "clear", "amber",
    "cream", "smoke", "smoky", "grey", "gray", "brown", "bone", "natural",
    "splatter", "marble", "marbled", "translucent", "opaque", "transparent",
    "picture disc", "coloured vinyl", "colored vinyl", "vinyl", "vinil",
    "ost", "soundtrack", "trilha sonora", "various", "various artists",
    "import", "importado", "deluxe", "limited", "limited edition", "reissue",
    "remaster", "remastered", "explicit", "mono", "stereo", "live",
}


def norm(s: str) -> str:
    """Accent-insensitive, punctuation-insensitive comparison key."""
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def candidate_sides(titulo: str) -> list[str]:
    """Every plausible artist substring from the title's dash structure."""
    t = _LEAD_NOISE.sub("", titulo or "")
    parts = [p.strip() for p in re.split(r"\s+[-–—]\s+", t) if p.strip()]
    if len(parts) < 2:
        return []
    out = []
    # Only the outermost segments realistically hold the artist; middle
    # fragments are almost always subtitle/edition text.
    for cand in (parts[0], parts[-1]):
        cand = _TRAIL_NOISE.sub("", cand).strip(" -–—:")
        # A plausible artist name: not absurdly long, not a bare number.
        if 2 <= len(cand) <= 60 and not cand.isdigit():
            out.append(cand)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    conn = connect_with_retry()
    cur = conn.cursor()

    # Known-artist vocabulary: every artista already attached to a live record.
    cur.execute(
        """
        SELECT artista, COUNT(*) FROM "Disco"
        WHERE artista IS NOT NULL
          AND artista NOT ILIKE '%%o identificado%%'
          AND disponivel = TRUE
        GROUP BY artista
        """
    )
    known: dict[str, tuple[str, int]] = {}
    for artista, n in cur.fetchall():
        k = norm(artista)
        # Keep the spelling used on the most records as canonical.
        if k and (k not in known or n > known[k][1]):
            known[k] = (artista, n)
    print(f"known artists in catalogue: {len(known)}")

    cur.execute(
        """
        SELECT slug, titulo FROM "Disco"
        WHERE artista ILIKE '%%o identificado%%'
          AND disponivel = TRUE AND (format IS NULL OR format = 'vinyl')
        ORDER BY price_count DESC NULLS LAST
        """
    )
    rows = cur.fetchall()
    if args.limit:
        rows = rows[: args.limit]
    print(f"unidentified-artist records in scope: {len(rows)}\n")

    # On a soundtrack listing the trailing name is usually the film's director
    # or producer, not the recording artist -- the first dry run proposed
    # "Wong Kar Wai" (a film director) for an Original Soundtrack. Leave these
    # for the MusicBrainz pass, which resolves composers properly.
    soundtrack_re = re.compile(
        r"\b(original\s+soundtrack|soundtrack|o\.?s\.?t\.?|trilha\s+sonora|"
        r"motion\s+picture)\b",
        re.IGNORECASE,
    )

    resolved, ambiguous, skipped_ost, no_match = [], [], 0, 0
    for slug, titulo in rows:
        if soundtrack_re.search(titulo or ""):
            skipped_ost += 1
            continue
        hits = []
        for cand in candidate_sides(titulo):
            k = norm(cand)
            if k in _NOT_AN_ARTIST:
                continue
            if k in known:
                hits.append(known[k][0])
        # dedupe while keeping order
        hits = list(dict.fromkeys(hits))
        if len(hits) == 1:
            resolved.append((slug, titulo, hits[0]))
        elif len(hits) > 1:
            ambiguous.append((slug, titulo, hits))
        else:
            no_match += 1

    print(f"RESOLVED (one known artist found) : {len(resolved)}")
    print(f"AMBIGUOUS (both sides known)      : {len(ambiguous)}")
    print(f"SKIPPED soundtrack listings       : {skipped_ost}")
    print(f"NO MATCH (needs another source)   : {no_match}\n")

    print("--- RESOLVED sample ---")
    for slug, titulo, artist in resolved[:40]:
        print(f"  {artist:28s} <- {titulo[:66]}")
    if ambiguous:
        print("\n--- AMBIGUOUS (never auto-written) ---")
        for slug, titulo, hits in ambiguous[:15]:
            print(f"  {hits} <- {titulo[:60]}")

    if not args.apply:
        print("\nDRY RUN — nothing written. Re-run with --apply.")
        conn.close()
        return

    for slug, _titulo, artist in resolved:
        cur.execute(
            'UPDATE "Disco" SET artista = %s, "updatedAt" = NOW() WHERE slug = %s',
            (artist, slug),
        )
    conn.commit()
    print(f"\nApplied: {len(resolved)} records updated.")
    conn.close()


if __name__ == "__main__":
    main()
