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
# Non-music merchandise (clothing, homewares, accessories) — classified as
# "other" rather than "cd" so operators can distinguish contamination types.
_MERCH_TITLE_RE = re.compile(
    r"\bcamiseta[s]?\b|\bcamisa[s]?\b|\bregata[s]?\b|\bmoletom\b|\bmoletons\b"
    r"|\bmochila[s]?\b|\balmofada[s]?\b|\bcaneca[s]?\b|\bpulseira[s]?\b"
    r"|\badesivo[s]?\b|\bchaveiro[s]?\b|\bboné[s]?\b|\bposter[s]?\b",
    re.IGNORECASE,
)
# Funko Pop / collectible figures — "Vinyl" means plastic material, not music.
# Must be checked BEFORE _VINYL_TITLE_RE so "Pop! Vinyl Figure" loses to this.
_VINYL_FIGURE_RE = re.compile(
    r"\bfunko\b|\bvinyl\s+figure[s]?\b|\bpop!\s*vinyl\b",
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
    if _VINYL_FIGURE_RE.search(title):
        return False
    if _VINYL_TITLE_RE.search(title):
        return True
    if _CD_RE.search(title) or _MERCH_TITLE_RE.search(title):
        return False

    if card is not None:
        card_text = card.get_text(" ", strip=True)
        if _VINYL_CARD_RE.search(card_text):
            if not (_CD_RE.search(card_text) and not _VINYL_TITLE_RE.search(title)):
                return True

    return True


# ── Format allowlist (CD-contamination incident, 2026-06-11) ─────────────────
# Positive vinyl evidence is required before a product may enter the catalog.
# Callers must accept ONLY "vinyl" — "unknown" is rejected, never inserted.

_FORMAT_VINYL_RE = re.compile(r"vinil|vinyl|\blp\b", re.IGNORECASE)
_FORMAT_NONVINYL_RE = re.compile(
    r"\bcds?\b|audio cd|áudio cd|compact disc|\bmp3\b|streaming"
    r"|\bcassette\b|\bcassete\b|\bdvd\b|blu-?ray|\bdigital\b"
    r"|capa\s+comum|capa\s+dura|\bbrochura\b|\bpaperback\b|\bhardcover\b"
    r"|\baudiolivros?\b|\baudiobooks?\b|\bkindle\b",
    re.IGNORECASE,
)
_FORMAT_LABEL_RE = re.compile(
    r"(?:formato|format|tipo\s+de\s+m[íi]dia|m[íi]dia)\s*:?\s*",
    re.IGNORECASE,
)
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
    if _VINYL_FIGURE_RE.search(title):
        return "other"
    if _VINYL_TITLE_RE.search(title):
        return "vinyl"
    if _MERCH_TITLE_RE.search(title):
        return "other"

    if soup is None:
        # Title-only path (search cards): trust the CD signal directly.
        return "cd" if _CD_RE.search(title) else "unknown"

    # With page HTML: check the selected swatch BEFORE the CD title signal.
    # Amazon injects distributor titles like "The Orchard - Álbum [CD]" on vinyl
    # ASIN pages — the selected swatch is the reliable ground-truth format field.
    selected = soup.select_one("#tmmSwatches .swatchElement.selected")
    selected_is_cd = False
    if selected is not None:
        text = selected.get_text(" ", strip=True)
        if _FORMAT_VINYL_RE.search(text):
            return "vinyl"
        selected_is_cd = bool(_FORMAT_NONVINYL_RE.search(text))

    # CD title signal — checked after swatch to avoid injected-title false positives.
    if _CD_RE.search(title):
        return "cd"

    # Sibling-variant check: scan ALL vinyl swatches.
    # vinyl_this → THIS ASIN is the vinyl edition (swatch has no link or links here).
    # vinyl_other only → all vinyl swatches point elsewhere; likely a CD/MP3 sibling,
    # but Amazon also uses this layout when one ASIN is standard vinyl and a sibling
    # is the colored/limited edition. Don't short-circuit to "cd" here — fall through
    # to the detail area scan, which has the authoritative "Formato" field.
    vinyl_this = False
    vinyl_other = False
    if asin:
        for swatch in soup.select("#tmmSwatches .swatchElement"):
            if not _FORMAT_VINYL_RE.search(swatch.get_text(" ", strip=True)):
                continue
            link = swatch.select_one("a[href]")
            m = _DP_ASIN_RE.search(link.get("href") or "") if link else None
            if m and m.group(1).upper() != asin.upper():
                vinyl_other = True
            else:
                vinyl_this = True  # no link (= this page) or links to same ASIN
    if vinyl_this:
        return "vinyl"

    # Selected-swatch fallback — only when NO vinyl sibling ambiguity.
    # When vinyl_other is set we defer to the detail scan below instead.
    if selected is not None and not vinyl_other:
        return "cd" if selected_is_cd else "unknown"

    # Detail area scan — authoritative for both single-format pages and for
    # vinyl_other cases where "Formato: Disco de Vinil" beats the swatch inference.
    for area_sel in (
        "#bylineInfo_feature_div",   # "Artista (Artista) Formato: Disco de Vinil"
        "#productSubtitle",
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
        # Broader fallback: vinyl keyword anywhere — ONLY for #productSubtitle.
        # In bullet/detail sections "N° X em CD e Vinil" appears as a category
        # ranking on every music product and would false-positive on CD pages.
        if area_sel == "#productSubtitle" and _FORMAT_VINYL_RE.search(text):
            return "vinyl"

    # Exhausted all signals. vinyl_other means every vinyl swatch linked elsewhere
    # and the product details had no vinyl label — most likely a non-vinyl sibling.
    if vinyl_other:
        return "cd"
    if selected is not None:
        return "cd" if selected_is_cd else "unknown"
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
