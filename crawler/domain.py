"""
domain.py — Pure domain logic for the vinyl crawler.

Contains stateless functions for product classification, artist normalization,
and price parsing. No I/O, no DB, no HTTP.
"""
import re

# ─────────────────────────────────────────────────────────────
#  Constants
# ─────────────────────────────────────────────────────────────

UNKNOWN_ARTIST = "Artista não identificado"

_PRICE_CLEAN_RE = re.compile(r"R\$\s*|\xa0|\s")
_PRICE_NUM_RE   = re.compile(r"\d+\.?\d*")

_PRICE_START_RE = re.compile(r"^R\$|^\$|^\d+[.,]")

_CD_RE = re.compile(
    r"\bcds?\b|\[cd\]|\(cd\)|compact disc|\bcds?\s*\d|audio cd|áudio cd",
    re.IGNORECASE,
)
_VINYL_TITLE_RE = re.compile(
    r"vinil|vinyl|\blp\b"
    r'|\b7["\']\b'
    r'|\b10["\']?\b\s*(?:inch|polegadas)'
    r'|\b12["\']?\b\s*(?:inch|polegadas)'
    r"|33\s?rpm|45\s?rpm"
    r"|180\s?g(?:r(?:am)?)?"
    r"|picture\s+(?:disc|vinyl)|gatefold"
    r"|disco\s+(?:de\s+)?vinil|single\s+de\s+vinil"
    r"|\b7\s*polegadas\b|\b12\s*polegadas\b",
    re.IGNORECASE,
)
_VINYL_CARD_RE = re.compile(
    r"vinil|vinyl|\blp\b|180\s?g(?:r(?:am)?)?|gatefold|picture\s+disc"
    r"|disco\s+(?:de\s+)?vinil|formato:\s*vinil|format:\s*vinyl|33\s+rpm|45\s+rpm",
    re.IGNORECASE,
)

_ARTIST_REJECT_PHRASES = (
    "ouça com amazon music", "ouça com music unlimited", "listen with amazon music",
    "adicionar ao carrinho", "add to cart", "comprar agora", "buy now",
    "prime", "frete grátis", "em estoque", "disponível",
    "vendido por", "sold by", "patrocinado", "sponsored",
    "em até", "in up to", "x de r$", "x r$", "sem juros",
    "compras no mês", "compras nos últimos", "bought in past", "bought last month",
    "amazon music",
    "oferta",
    "mais opções de comprar",
    "opções de comprar",
    "dias de",
    "página",
    "preço",
    "r$",
    "outro formato",
    "other format",
    "músicas mp3",
    "musicas mp3",
    "entrega grátis",
    "chega antes",
)

_DATE_ARTIST_RE = re.compile(
    r"^\d{1,2}\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b",
    re.IGNORECASE,
)

_EMBEDDED_PRICE_RE = re.compile(r"\d+[,\.]\d{2}")


# ─────────────────────────────────────────────────────────────
#  Functions
# ─────────────────────────────────────────────────────────────

def parse_price_br(text: str) -> float | None:
    if not text:
        return None
    cleaned = _PRICE_CLEAN_RE.sub("", text)
    cleaned = cleaned.replace(".", "").replace(",", ".")
    m = _PRICE_NUM_RE.search(cleaned)
    if m is None:
        return None
    return float(m.group())


def is_vinyl(title: str, card=None) -> bool:
    if _CD_RE.search(title):
        return False

    if _VINYL_TITLE_RE.search(title):
        return True

    if card is not None:
        card_text = card.get_text(" ", strip=True)
        if _VINYL_CARD_RE.search(card_text):
            if not (_CD_RE.search(card_text) and not _VINYL_TITLE_RE.search(title)):
                return True

    return True


# ── Format allowlist (CD-contamination incident, 2026-06-11) ─────────────────
# Positive vinyl evidence is required before a product may enter the catalog.
# Callers must accept ONLY "vinyl" — "unknown" is rejected, never inserted.

_FORMAT_VINYL_RE = re.compile(r"vinil|vinyl", re.IGNORECASE)
_FORMAT_NONVINYL_RE = re.compile(
    r"\bcds?\b|audio cd|áudio cd|compact disc|\bmp3\b|streaming"
    r"|\bcassette\b|\bcassete\b|\bdvd\b|blu-?ray|\bdigital\b",
    re.IGNORECASE,
)
_FORMAT_LABEL_RE = re.compile(r"(?:formato|format)\s*:?\s*", re.IGNORECASE)
_DP_ASIN_RE = re.compile(r"/dp/([A-Z0-9]{10})", re.IGNORECASE)


def detect_format(title: str, soup=None, asin: str | None = None) -> str:
    """
    Classify a product's physical format from the strongest available signal.
    Returns "vinyl", "cd" (any confirmed non-vinyl), or "unknown".

    soup is the full product-page BeautifulSoup; pass None for title-only
    classification (e.g. search cards, where the page is not available).
    asin enables the sibling-variant check on multi-format pages: a vinyl
    swatch that links a DIFFERENT ASIN means the vinyl edition is its own
    product and this ASIN is a non-vinyl sibling (CD/MP3/...).
    """
    if _CD_RE.search(title):
        return "cd"
    if _VINYL_TITLE_RE.search(title):
        return "vinyl"
    if soup is None:
        return "unknown"

    # Multi-format page: which variant does THIS ASIN represent?
    selected = soup.select_one("#tmmSwatches .swatchElement.selected")
    if selected is not None:
        text = selected.get_text(" ", strip=True)
        if _FORMAT_VINYL_RE.search(text):
            return "vinyl"
        if _FORMAT_NONVINYL_RE.search(text):
            return "cd"

    # Sibling-variant check: swatches for the page's own ASIN carry no /dp/
    # link, so a vinyl swatch pointing at another ASIN confirms this one is
    # the non-vinyl variant. (CD-leak audit, 2026-06-12.)
    if asin:
        for swatch in soup.select("#tmmSwatches .swatchElement"):
            if not _FORMAT_VINYL_RE.search(swatch.get_text(" ", strip=True)):
                continue
            link = swatch.select_one("a[href]")
            m = _DP_ASIN_RE.search(link.get("href") or "") if link else None
            if m and m.group(1).upper() != asin.upper():
                return "cd"
            break  # vinyl swatch is this ASIN (or unlinked) — not a sibling

    if selected is not None:
        # Multi-format page with an inconclusive selected swatch: the details
        # section describes the page's primary variant, not necessarily this
        # ASIN — don't trust it.
        return "unknown"

    # Single-format page: details / ficha tecnica "Formato" row.
    for area_sel in (
        "#detailBullets_feature_div",
        "#productDetails_detailBullets_sections1",
        "#productDetails_techSpec_section_1",
        "#prodDetails",
    ):
        area = soup.select_one(area_sel)
        if area is None:
            continue
        text = area.get_text(" ", strip=True)
        m = _FORMAT_LABEL_RE.search(text)
        if m:
            segment = text[m.end():m.end() + 60]
            if _FORMAT_VINYL_RE.search(segment):
                return "vinyl"
            if _FORMAT_NONVINYL_RE.search(segment):
                return "cd"

    # Breadcrumb check removed (CD-leak audit, 2026-06-12): the root music
    # category "CD e Vinil" appears on every BR music product — including
    # plain CDs — so it can never be positive vinyl evidence.
    return "unknown"


def _to_title_case(name: str) -> str:
    SMALL = {"of", "the", "and", "or", "in", "on", "at", "to", "a", "an",
             "de", "da", "do", "e", "y", "los", "las", "el", "la"}
    words = name.split()
    result = []
    for i, word in enumerate(words):
        lower = word.lower()
        result.append(lower if (i > 0 and lower in SMALL) else word.capitalize())
    return " ".join(result)


def normalize_artist(name: str) -> str:
    if not name or name == UNKNOWN_ARTIST:
        return name

    if "," in name:
        parts = [p.strip() for p in name.split(",", 1)]
        if len(parts) == 2 and all(parts):
            candidate = f"{parts[1]} {parts[0]}"
            return _to_title_case(candidate)

    letters = [c for c in name if c.isalpha()]
    if len(letters) > 4 and all(c.isupper() for c in letters):
        return _to_title_case(name)

    return name


def is_fake_artist(artist: str) -> bool:
    if not artist:
        return False
    if _DATE_ARTIST_RE.match(artist):
        return True
    low = artist.lower()
    return any(phrase in low for phrase in _ARTIST_REJECT_PHRASES)


def _is_plausible_artist(text: str) -> bool:
    if not text or len(text) > 120:
        return False
    if not re.search(r"[a-zA-ZÀ-ÿ]", text):
        return False
    if _PRICE_START_RE.match(text):
        return False
    if is_fake_artist(text):
        return False
    if re.fullmatch(r"[\d.,\s/\\-]+", text):
        return False
    if _EMBEDDED_PRICE_RE.search(text):
        return False
    return True
