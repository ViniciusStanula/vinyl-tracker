"""
titulo_seo.py — computes the SEO-clean display title (H1 / <title> / JSON-LD)
for a Disco record, plus its color/edition/version variant data.

Replaces the raw Amazon título ("Killers[180g LP] [2015 Remaster]") with a
clean base title ("Killers") and, only when a same-artist sibling shares that
base title, a disambiguating suffix built from real pressing data
("Megadeth (Vinil Multicor)"). Never invents data: a record with no color or
edition information anywhere stays plain rather than guessing.

Base title priority: discogs_title -> mb_title (both gated by a
meaningful-overlap guard against the raw título) -> clean_album_title(raw).
Variant data priority: discogs_format_desc (verified pressing data) ->
raw-título junk text (fallback, only after the artist prefix is stripped).

Validated across ~700 real records spanning 40+ artists and every major
genre/language on the site, plus a full 31k-record catalog run. See
crawler/tests/test_titulo_seo.py for the regression suite these rules exist
to satisfy.
"""
import re

from lastfm import clean_album_title, _VINYL_WORDS, _fold, _fold_pattern
from discogs_enrich import _is_latin_comparable, _tokens

# Words that mean "no real title info here" for self-titled-shape detection,
# but aren't in _VINYL_WORDS -- that set exists to decide what
# clean_album_title should STRIP, not to catalog every generic edition word.
# Missing "Limited" or the "Self-Title(d)" idiom wrongly rejected legitimate
# self-titled matches (Megadeth, Engineers) and fell back to raw junk text.
SELF_TITLED_JUNK = {"limited", "special", "self", "titled", "title", "le", "exclusive", "edition", "album"}

# discogs_enrich._tokens() is built for coarse wrong-match detection and
# strips words like "Original"/"Soundtrack"/"Motion"/"Picture" as noise for
# THAT purpose. Reused for meaningful-content comparison, it erased exactly
# the words distinguishing Amy Winehouse's real album "Back To Black" from
# the 2024 biopic's "Back To Black (Original Soundtrack)" -- a different
# product with a different tracklist. This lighter tokenizer only strips
# true grammatical filler, not real content words.
_LIGHT_STOPWORDS = {"a", "an", "the", "of", "and", "or", "to", "in", "on", "from", "with"}


def _light_tokens(s):
    words = re.findall(r"[A-Za-zÀ-ÿ0-9]+", (s or "").lower())
    return {w for w in words if w not in _LIGHT_STOPWORDS and len(w) > 1}


COLOR_MAP = [
    (r"\bolive\s+green\b", "verde-oliva"),
    (r"\bcoke\s+bottle\s+clear\b", "transparente"),
    (r"\bcrystal\s+clear\b", "transparente"),
    (r"\bmilky\s+clear\b", "transparente leitoso"),
    (r"\bbone\s+white\b", "branco osso"),
    (r"\bblack\s+ice\b", "preto"),
    (r"\b\w+\s+marbled?\b", "mesclado"),
    (r"\bmarbled?\b", "mesclado"),
    (r"\bswirl\b", "mesclado"),
    (r"\bsplatter\b", "splatter"),
    (r"\btranslucent\b", "translúcido"),
    (r"\btrans\b", "translúcido"),
    (r"\bopaque\b", "opaco"),
    (r"\bclear\b", "transparente"),
    (r"\btransparent\b", "transparente"),
    (r"\bbone\b", "osso"),
    (r"\bblack\b", "preto"),
    (r"\bwhite\b", "branco"),
    (r"\bred\b", "vermelho"),
    (r"\bblue\b", "azul"),
    (r"\bgreen\b", "verde"),
    (r"\byellow\b", "amarelo"),
    (r"\borange\b", "laranja"),
    (r"\bpurple\b", "roxo"),
    (r"\bviolet\b", "violeta"),
    (r"\bpink\b", "rosa"),
    (r"\bgold\b", "dourado"),
    (r"\bsilver\b", "prateado"),
    (r"\bcopper\b", "cobre"),
    (r"\bgrey\b", "cinza"),
    (r"\bgray\b", "cinza"),
    # Real, common Discogs pressing colors found by scanning the
    # still-colliding backlog for unrecognized words in discogs_format_desc.
    (r"\bcream\b", "creme"),
    (r"\bmagenta\b", "magenta"),
    (r"\bgrape\b", "uva"),
    (r"\blilac\b", "lilás"),
    (r"\bmaroon\b", "bordô"),
    (r"\bturquoise\b", "turquesa"),
    (r"\bteal\b", "azul-petróleo"),
    (r"\bbrown\b", "marrom"),
    (r"\baquamarine\b", "água-marinha"),
    (r"\bchocolate\b", "chocolate"),
    (r"\baqua\b", "água-marinha"),
    (r"\bplatinum\b", "platina"),
    (r"\bonyx\b", "ônix"),
    (r"\bcoral\b", "coral"),
]
GENERIC_COLOR_RE = re.compile(r"\bcolou?red\b|\bcolour\b|\bvinilo\s+color\b", re.IGNORECASE)

EDITION_PRIORITY = [
    (r"\bzoetrope\b", "Zoetrope"),
    (r"\bdeluxe\s+edition\b", "Edição Deluxe"),
    (r"\bspecial\s+edition\b", "Edição Especial"),
    (r"\banniversary\b", "Edição de Aniversário"),
    (r"\brecord\s+store\s+day\b", "Record Store Day"),
    (r"\bpicture\s+disc\b", "Picture Disc"),
    (r"\bbox\s?set\b", "Box Set"),
    (r"\bnumbered\b", "Numerado"),
]
VERSION_PRIORITY = [
    (r"\bhalf[\s-]?speed\b", "Masterização Half-Speed"),
    (r"\bacoustic\b", "Acústico"),
    (r"\blive\b", "Ao Vivo"),
    (r"\bremix(ed)?\b", "Remix"),
    (r"\bexpanded\b", "Edição Expandida"),
    (r"\bunplugged\b", "Unplugged"),
    (r"\binstrumental\b", "Instrumental"),
    (r"\bdemo(s)?\b", "Demos"),
]

_NICKNAME_SHAPED = re.compile(
    r"\(?\s*(red|blue|black|white|green|pink|gold|silver|purple|orange|yellow)\s+(album|edition)\s*\)?",
    re.IGNORECASE,
)
_VINYL_ADJACENT = re.compile(
    r"(vinyl|vinil|lp|disc)\b.{0,20}\b(red|blue|black|white|green|pink|gold|silver|purple|orange|yellow)|"
    r"\b(red|blue|black|white|green|pink|gold|silver|purple|orange|yellow)\b.{0,20}\b(vinyl|vinil|lp|disc)\b",
    re.IGNORECASE,
)

# Loose hue families so near-synonyms ("translúcido" vs "transparente") don't
# false-trigger the title-vs-discogs conflict guard in compose().
_COLOR_FAMILY = {
    "transparente": "clear", "translúcido": "clear", "transparente leitoso": "clear",
    "preto": "preto", "branco": "branco", "branco osso": "branco", "osso": "branco",
    "vermelho": "vermelho", "azul": "azul", "verde": "verde", "verde-oliva": "verde",
    "amarelo": "amarelo", "laranja": "laranja", "roxo": "roxo", "violeta": "roxo",
    "rosa": "rosa", "dourado": "dourado", "prateado": "metalico", "cobre": "metalico",
    "cinza": "metalico", "mesclado": "mesclado", "splatter": "mesclado",
}


_BUNDLE_SEPARATOR_RE = re.compile(r"\s/\s")


def base_title(artista, titulo, discogs_title, mb_title):
    """Resolves the clean base album title, preferring verified external data
    over raw-title regex stripping -- but only when that data actually
    explains the título's real content, not just the artist's own name."""
    # A título with 2+ " / " separators names multiple works ("Metallica
    # Vinyl Collection: Kill 'Em All / Ride The Lightning / Master Of
    # Puppets"). discogs_title/mb_title can only ever resolve to ONE of
    # them, and the 2-shared-word overlap check doesn't catch this: "master"
    # and "puppets" genuinely ARE in the bundle title, so a candidate
    # matching just that one album passed as if it were the whole product,
    # silently erasing the other two. No external single-album title can
    # correctly represent a multi-album bundle, so bundles skip candidate
    # matching entirely and keep the full, regex-cleaned listing text.
    if titulo and len(_BUNDLE_SEPARATOR_RE.findall(titulo)) >= 2:
        return clean_album_title(titulo, artista or "")

    clean = clean_album_title(titulo or "", artista or "")
    clean_words = re.findall(r"[A-Za-zÀ-ÿ0-9]+", clean)
    artista_words = {w.lower() for w in re.findall(r"[A-Za-zÀ-ÿ0-9]+", artista or "")}
    all_junk = (not clean_words) or all(
        _VINYL_WORDS.search(w) or w.lower() in artista_words or w.lower() in SELF_TITLED_JUNK
        for w in clean_words
    )
    titulo_tokens = _tokens(titulo)
    meaningful = _light_tokens(clean) - _light_tokens(artista)

    for cand in (discogs_title, mb_title):
        if cand and _is_latin_comparable(cand):
            theirs = _tokens(cand)
            theirs_light = _light_tokens(cand)
            if not theirs:
                continue
            if all_junk:
                # Genuine self-titled shape: nothing but junk/artist-echo
                # survived cleaning, so a loose overlap check against the
                # raw título is all there is to verify against.
                if titulo_tokens & theirs:
                    return cand
            else:
                overlap = meaningful & theirs_light
                extra = theirs_light - meaningful
                if len(meaningful) <= 2:
                    # A short real title ("Uprising") makes any ratio-based
                    # threshold trivial -- a wrong, longer candidate
                    # ("Uprising Live!") still scores 100% overlap of the
                    # real content. Short titles instead require the
                    # candidate to fully explain the content AND add nothing
                    # unexplained of its own.
                    if overlap == meaningful and not extra:
                        return cand
                # A single shared common word ("moon" between a wrongly
                # Discogs-matched "Pink Moon" and the real "The Dark Side Of
                # The Moon") isn't enough evidence -- require either 2+
                # shared words or a majority of the real content.
                elif len(overlap) >= 2 or len(overlap) / max(len(meaningful), 1) >= 0.6:
                    return cand
    return clean


def extract_junk(raw, artista=None):
    """Pulls the bracket/paren/dash-tail text most likely to hold color or
    edition info -- scoped to exclude the artist prefix so it never mistakes
    the real album title (e.g. "Purple Rain") for a color descriptor."""
    text = raw or ""
    if artista:
        prefix = re.compile(r"^" + _fold_pattern(artista) + r"\s*[-/:]\s*", re.IGNORECASE)
        m = prefix.match(_fold(text))
        if m:
            text = text[m.end():]
    parts = re.findall(r"\[[^\]]*\]|\([^)]*\)", text)
    if artista:
        # A parenthetical that's JUST the artist's name, anywhere in the
        # title -- not only as a leading prefix -- must not be color-scanned
        # either. "LP THE DARK SIDE OF THE MOON (PINK FLOYD) (IMPORTADO)"
        # read "(PINK FLOYD)" and found the color word "Pink" in the band's
        # own name, wrongly claiming "Vinil Rosa".
        folded_artist = _fold(artista).strip().lower()
        parts = [p for p in parts if _fold(p[1:-1]).strip().lower() != folded_artist]
    # Color/edition text isn't always bracketed -- Amazon often just appends
    # it after a trailing " - ", the same shape clean_album_title's own
    # dash-tail scan targets.
    dash = text.rfind(" - ")
    if dash > 0:
        parts.append(text[dash + 3:])
    return " ".join(parts)


def parse_colors(text):
    if not text:
        return []
    low, found = text.lower(), []
    for pat, label in COLOR_MAP:
        if re.search(pat, low) and label not in found:
            found.append(label)
    return found


def parse_single(text, priority_list):
    low = (text or "").lower()
    for pat, label in priority_list:
        if re.search(pat, low):
            return label
    return None


def resolve_variant(artista, titulo, fmt_desc):
    """Resolves (cor, edicao, versao) for a record. Returns None for any
    field with no data -- never guesses. `cor` is a short display label like
    "Vermelho" or "Splatter Colorido", suitable for both the H1 suffix and
    grouping records for a /vinil-colorido/<cor> hub page."""
    color_src = fmt_desc or extract_junk(titulo, artista)
    colors = parse_colors(color_src)

    # A title-only color claim (no discogs_format_desc to confirm the actual
    # pressing) needs the color word to sit near an actual vinyl-word.
    # "Weezer (Red Album)" is the record's own cover-art nickname -- not
    # necessarily red vinyl -- and asserting "Vinil Vermelho" would be a
    # wrong, checkable claim about the physical product.
    if not fmt_desc and colors and _NICKNAME_SHAPED.search(titulo or "") and not _VINYL_ADJACENT.search(titulo or ""):
        colors = []

    # discogs_format_desc isn't infallible -- a barcode can resolve to the
    # WRONG colored pressing when several share it (a record's
    # discogs_format_desc said "Green" while its own raw título said "Clear
    # Vinyl, Yellow" -- a different physical variant entirely). When the two
    # sources disagree on hue family, we can't tell which is right for THIS
    # listing -- downgrade to a generic "colored" claim rather than
    # confidently assert either side.
    fmt_desc_had_conflict = False
    if fmt_desc and colors:
        title_colors = parse_colors(extract_junk(titulo, artista))
        title_families = {_COLOR_FAMILY.get(c) for c in title_colors} - {None}
        fmt_families = {_COLOR_FAMILY.get(c) for c in colors} - {None}
        if title_families and fmt_families and not (title_families & fmt_families):
            colors = []
            fmt_desc_had_conflict = True

    if len(colors) >= 3:
        cor = "Splatter Colorido" if "splatter" in (color_src or "").lower() else "Multicor"
    elif colors:
        cor = " / ".join(c.capitalize() for c in colors[:2])
    elif fmt_desc_had_conflict:
        cor = "Colorido"
    elif GENERIC_COLOR_RE.search(color_src or "") and not (
        not fmt_desc and _NICKNAME_SHAPED.search(titulo or "") and not _VINYL_ADJACENT.search(titulo or "")
    ):
        cor = "Colorido"
    else:
        cor = None

    edicao = parse_single(fmt_desc, EDITION_PRIORITY) or parse_single(extract_junk(titulo, artista), EDITION_PRIORITY)
    versao = parse_single(fmt_desc, VERSION_PRIORITY) or parse_single(extract_junk(titulo, artista), VERSION_PRIORITY)
    return cor, edicao, versao


def compose(artista, titulo, discogs_title, mb_title, fmt_desc):
    """Returns (h1, base, cor, edicao, versao). `h1` is the final display
    title -- base plus a disambiguating suffix only when variant data
    exists."""
    base = base_title(artista, titulo, discogs_title, mb_title)
    cor, edicao, versao = resolve_variant(artista, titulo, fmt_desc)

    bits = []
    if cor:
        bits.append(f"Vinil {cor}")
    if edicao:
        bits.append(edicao)
    if versao:
        bits.append(versao)
    suffix = f" ({', '.join(bits)})" if bits else ""
    return f"{base}{suffix}", base, cor, edicao, versao
