"""
main.py — Daily Amazon Brazil vinyl crawler → PostgreSQL (Supabase)
────────────────────────────────────────────────────────────────────
Crawls Amazon.com.br for vinyl records from the main popularity-ranked
vinyl page, appends price data to PostgreSQL for historical tracking.

Usage:
    python main.py                        # crawl all pages
    python main.py --max-pages 3          # limit pages
    python main.py --dry-run              # crawl but don't write to DB

Schedule (GitHub Actions):
    cron: '0 9,21 * * *'   # 9h and 21h UTC (6h and 18h BRT)

Dependencies:
    pip install requests beautifulsoup4 lxml curl_cffi psycopg2-binary python-slugify
"""
import re
import time
import random
import logging
import argparse
from datetime import datetime

from database import upsert_batch, limpar_historico_antigo, get_connection
from utils import gerar_slug

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────
ASSOCIATE_TAG     = "groovesnrecor-20"
MAX_PAGES_DEFAULT = 1000       # a página geral tem mais produtos que as de categoria
DELAY_SECONDS     = 5
MIN_PRICE_BRL     = 10.0

# URL principal — todos os vinis ordenados por popularidade
VINYL_URL_PATH = (
    "/s?i=popular&srs=19549018011"
    "&rh=n%3A19549018011"
    "&s=popularity-rank"
    "&fs=true"
    "&ref=lp_19549018011_sar"
)

BASE_URL = "https://www.amazon.com.br"

BROWSER_IDENTITIES = [
    "chrome136", "chrome133a", "chrome131", "chrome124", "chrome120",
    "edge101", "firefox144", "firefox135", "firefox133",
]

# ─────────────────────────────────────────────────────────────
#  Logging
# ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("vinyl_crawler.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
#  Compiled regexes
# ─────────────────────────────────────────────────────────────
_RATING_TEXT_RE = re.compile(
    r"^\d[\d,.]* de \d"
    r"|^\d[\d.]* out of \d"
    r"|estrelas?$",
    re.IGNORECASE,
)
_PRICE_START_RE = re.compile(r"^R\$|^\$|^\d+[.,]")

# ─────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────
def affiliate_link(asin: str) -> str:
    return f"https://www.amazon.com.br/dp/{asin}?tag={ASSOCIATE_TAG}"


def parse_price_br(text: str) -> float | None:
    if not text:
        return None
    text = re.sub(r"R\$\s*|\xa0|\s", "", text)
    text = text.replace(".", "").replace(",", ".")
    m = re.search(r"\d+\.?\d*", text)
    return float(m.group()) if m else None


def is_vinyl(title: str, card=None) -> bool:
    title_lower = title.lower()

    cd_patterns = [r"\bcd\b", r"\[cd\]", r"\(cd\)", r"compact disc", r"\bcd\s*\d"]
    for pat in cd_patterns:
        if re.search(pat, title_lower):
            return False

    vinyl_title_signals = [
        "vinil", "vinyl", r"\blp\b",
        r"\b7[\"\']\b", r'\b10["\']?\b\s*(?:inch|polegadas)',
        r'\b12["\']?\b\s*(?:inch|polegadas)',
        "33rpm", "33 rpm", "45rpm", "45 rpm",
        "180g", "180 g", "180gr", "180gram",
        "picture disc", "picture vinyl", "gatefold",
        "disco de vinil", "disco vinil", "single de vinil",
        r"\b7\s*polegadas\b", r"\b12\s*polegadas\b",
    ]
    for sig in vinyl_title_signals:
        if re.search(sig, title_lower):
            return True

    if card is not None:
        card_text = card.get_text(" ", strip=True).lower()
        vinyl_card_signals = [
            "disco de vinil", "vinil", "vinyl", r"\blp\b",
            "180g", "gatefold", "picture disc",
            "formato: vinil", "format: vinyl", "33 rpm", "45 rpm",
        ]
        for sig in vinyl_card_signals:
            if re.search(sig, card_text):
                if re.search(r"\bcd\b", card_text) and not re.search(r"vinil|vinyl|\blp\b", title_lower):
                    pass
                return True

    return True


def _to_title_case(name: str) -> str:
    """Title-cases a name, keeping small connector words lowercase."""
    SMALL = {"of", "the", "and", "or", "in", "on", "at", "to", "a", "an",
             "de", "da", "do", "e", "y", "los", "las", "el", "la"}
    words = name.split()
    result = []
    for i, word in enumerate(words):
        lower = word.lower()
        result.append(lower if (i > 0 and lower in SMALL) else word.capitalize())
    return " ".join(result)


def normalize_artist(name: str) -> str:
    """
    Normalizes an artist name coming from Amazon to a clean human-readable form.

    Handles two common formats:
      1. Inverted "LAST,FIRST" or "LAST, FIRST" → "First Last"
         e.g. "SWIFT,TAYLOR" → "Taylor Swift"
      2. ALL CAPS names (more than 4 alpha chars) → Title Case
         e.g. "LED ZEPPELIN" → "Led Zeppelin"
         (Short all-caps like "ABBA" or "AC/DC" are left alone.)
    """
    if not name or name == _UNKNOWN_ARTIST:
        return name

    # Case 1: inverted "LAST,FIRST" format
    if "," in name:
        parts = [p.strip() for p in name.split(",", 1)]
        if len(parts) == 2 and all(parts):
            candidate = f"{parts[1]} {parts[0]}"
            return _to_title_case(candidate)

    # Case 2: ALL CAPS (more than 4 alpha chars — preserves ABBA, AC/DC etc.)
    letters = [c for c in name if c.isalpha()]
    if len(letters) > 4 and all(c.isupper() for c in letters):
        return _to_title_case(name)

    return name


_ARTIST_REJECT_PHRASES = (
    "ouça com amazon music", "ouça com music unlimited", "listen with amazon music",
    "adicionar ao carrinho", "add to cart", "comprar agora", "buy now",
    "prime", "frete grátis", "em estoque", "disponível",
    "vendido por", "sold by", "patrocinado", "sponsored",
    "em até", "in up to", "x de r$", "x r$", "sem juros",
)
_UNKNOWN_ARTIST = "Artista não identificado"


def is_fake_artist(artist: str) -> bool:
    if not artist:
        return False
    low = artist.lower()
    return any(phrase in low for phrase in _ARTIST_REJECT_PHRASES)


def _is_plausible_artist(text: str) -> bool:
    if not text or len(text) > 120:
        return False
    if _PRICE_START_RE.match(text):
        return False
    if is_fake_artist(text):
        return False
    if re.fullmatch(r"[\d.,\s/\\-]+", text):
        return False
    return True


def build_page_url(page: int) -> str:
    url = BASE_URL + VINYL_URL_PATH
    url = re.sub(r"[&?]page=\d+", "", url)
    url = re.sub(r"[&?]qid=\d+", "", url)
    qid = int(time.time())
    return url + f"&qid={qid}&page={page}&ref=sr_pg_{page}"


def make_session():
    try:
        from curl_cffi import requests as cffi_requests
        s = cffi_requests.Session(impersonate=random.choice(BROWSER_IDENTITIES))
        s.headers.update({
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
            "Referer": "https://www.amazon.com.br/",
            "DNT": "1",
        })
        return s, "curl_cffi"
    except ImportError:
        import requests as req_lib
        s = req_lib.Session()
        s.headers.update({
            "User-Agent": random.choice([
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
            ]),
            "Accept-Language": "pt-BR,pt;q=0.9",
            "Referer": "https://www.amazon.com.br/",
            "DNT": "1",
        })
        return s, "requests"


def warm_up(session) -> None:
    try:
        session.get("https://www.amazon.com.br/", timeout=15)
        time.sleep(random.uniform(1.5, 3.0))
        session.get("https://www.amazon.com.br/CD-e-Vinil/b/?node=7791937011", timeout=15)
        time.sleep(random.uniform(1.0, 2.0))
    except Exception:
        pass


def safe_get(session, url: str, retries: int = 3):
    from bs4 import BeautifulSoup
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, timeout=25)
            if resp.status_code in (503, 429):
                log.warning("Rate-limited (%s), backing off...", resp.status_code)
                time.sleep(random.uniform(6, 12))
                session, _ = make_session()
                warm_up(session)
                continue
            resp.raise_for_status()
        except Exception as exc:
            log.warning("Request error (attempt %d/%d): %s", attempt, retries, exc)
            if attempt < retries:
                time.sleep(random.uniform(4, 8))
                session, _ = make_session()
                continue
            return None, session
        if any(s in resp.text for s in ["Robot Check", "Verificação de robô", "Digite os caracteres"]):
            log.warning("CAPTCHA detected, skipping page.")
            return None, session
        return BeautifulSoup(resp.text, "lxml"), session
    return None, session


# ─────────────────────────────────────────────────────────────
#  Extraction
# ─────────────────────────────────────────────────────────────
def extract_title(card) -> str:
    PROMO_PHRASES = (
        "ouça com amazon music", "ouça com music unlimited", "listen with amazon music",
        "adicionar ao carrinho", "add to cart", "comprar agora", "buy now",
    )
    candidates = []
    for sel in [
        "h2 a.a-link-normal span.a-text-normal",
        "h2 span.a-text-normal",
        "h2 a span",
        "h2 span",
        "[data-cy='title-recipe'] h2 span",
        "[data-cy='title-recipe'] span.a-text-normal",
        ".a-size-medium.a-color-base.a-text-normal",
        ".a-size-base-plus.a-color-base.a-text-normal",
        ".s-title-instructions-style span",
        ".a-size-medium.a-color-base",
        ".a-size-base-plus.a-color-base",
    ]:
        el = card.select_one(sel)
        if not el:
            continue
        t = el.get_text(strip=True)
        if not t or len(t) <= 3:
            continue
        if _RATING_TEXT_RE.search(t):
            continue
        if re.fullmatch(r"[\d.,\s%R$]+", t):
            continue
        if any(phrase in t.lower() for phrase in PROMO_PHRASES):
            continue
        candidates.append(t)

    if not candidates:
        return ""
    return max((c for c in candidates if len(c) <= 300), key=len, default=candidates[0])


def extract_artist(card) -> str:
    for sel in [
        # Priority 0: structured byline — most reliable when present
        "span.author.notFaded a.a-link-normal",
        "span.author a.a-link-normal",
        # Legacy / fallback selectors
        "h2 ~ .a-row .a-color-secondary .a-size-base",
        "h2 ~ .a-row .a-color-secondary",
        "[data-cy='title-recipe'] ~ .a-row .a-color-secondary",
        ".s-title-instructions-style + div .a-color-secondary",
        ".a-row .a-size-base+ .a-size-base",
        "[data-cy='secondary-offer-recipe'] .a-color-secondary",
        ".a-section .a-color-secondary.a-size-base",
        ".a-size-small .a-color-secondary",
        ".s-line-clamp-2 + .a-row .a-size-base",
        ".a-size-base.a-color-secondary",
    ]:
        el = card.select_one(sel)
        if not el:
            continue
        text = el.get_text(strip=True)
        text = re.sub(r"^(por|by|de)\s+", "", text, flags=re.IGNORECASE).strip()
        if _is_plausible_artist(text):
            return text
    return _UNKNOWN_ARTIST


def _is_in_secondary_section(el) -> bool:
    """
    Returns True if el is nested inside a secondary/alternative-format section.
    Amazon uses these to show CD/Streaming alternatives at the bottom of a card;
    their prices must not be confused with the main vinyl price.
    """
    for ancestor in el.parents:
        if not hasattr(ancestor, "get"):
            break
        # data-cy attribute used by Amazon for secondary offer sections
        if ancestor.get("data-cy") in (
            "secondary-offer-recipe",
            "format-list-recipe",
            "secondary-price-recipe",
        ):
            return True
        cls = " ".join(ancestor.get("class", []))
        if "s-secondary" in cls or "secondary-offer" in cls:
            return True
    return False


def _price_block_is_instalment(block) -> bool:
    block_classes = " ".join(block.get("class", []))
    if any(c in block_classes for c in ("a-text-price", "s-installment")):
        return True
    parent = block.parent
    for _ in range(4):
        if parent is None:
            break
        parent_text = parent.get_text(" ", strip=True).lower()
        if any(kw in parent_text for kw in (
            "parcela", "parcel", "sem juros", "installment",
            "em até", "in up to", "x r$", "x de r$",
        )):
            return True
        parent = parent.parent
    return False


def _read_price_block(block) -> float | None:
    parent = block.parent
    if parent:
        a11y = parent.select_one(
            "#apex-pricetopay-accessibility-label, "
            "[id$='-pricetopay-accessibility-label'], "
            "[id$='-accessibility-label'].aok-offscreen"
        )
        if a11y:
            text = a11y.get_text(strip=True).replace("\xa0", "").strip()
            if text:
                p = parse_price_br(text)
                if p and p > 0:
                    return p

    offscreen = block.select_one(".a-offscreen")
    if offscreen:
        text = offscreen.get_text(strip=True).replace("\xa0", "").strip()
        if text:
            p = parse_price_br(text)
            if p and p > 0:
                return p

    whole_el = block.select_one(".a-price-whole")
    frac_el  = block.select_one(".a-price-fraction")
    if whole_el:
        whole_text = "".join(
            t for t in whole_el.strings
            if t.strip() and t.strip() not in (",", ".")
        ).strip().replace(".", "")
        frac_text = frac_el.get_text(strip=True) if frac_el else "00"
        p = parse_price_br(f"{whole_text},{frac_text}")
        if p and p > 0:
            return p

    return None


def extract_price(card) -> float | None:
    """
    Extrai o preço de compra do card.

    Prioridade:
      0. Container apex-core-price-identifier → accessibility label (estrutura real)
      1. .s-price-instructions-style — container principal do preço nos resultados de busca
      2. Accessibility labels soltos no card (fallback)
      3. Seletores explícitos do buy-box (excluindo seções secundárias)
      4. Primeiro bloco .a-price não parcelado e fora de seções secundárias
      5. Regex no texto completo do card (último recurso)

    Seções secundárias (data-cy="secondary-offer-recipe" etc.) exibem preços de
    formatos alternativos (ex: CD) — esses nunca devem ser capturados como preço principal.
    """
    # ── Prioridade 0: apex-core-price-identifier (estrutura real confirmada) ──
    apex = card.select_one(".apex-core-price-identifier")
    if apex:
        a11y = apex.select_one("#apex-pricetopay-accessibility-label, [id$='-pricetopay-accessibility-label']")
        if a11y:
            text = a11y.get_text(strip=True).replace("\xa0", "").strip()
            p = parse_price_br(text)
            if p and p >= MIN_PRICE_BRL:
                log.debug("Price via apex-core-price-identifier a11y: %.2f", p)
                return p
        price_span = apex.select_one(".priceToPay, .apex-pricetopay-value")
        if price_span and not _price_block_is_instalment(price_span):
            p = _read_price_block(price_span)
            if p and p >= MIN_PRICE_BRL:
                log.debug("Price via apex-core-price-identifier priceToPay: %.2f", p)
                return p

    # ── Prioridade 1: .s-price-instructions-style (container principal nos resultados) ──
    price_section = card.select_one(".s-price-instructions-style")
    if price_section:
        for block in price_section.select(".a-price"):
            if not _price_block_is_instalment(block):
                p = _read_price_block(block)
                if p and p >= MIN_PRICE_BRL:
                    log.debug("Price via s-price-instructions-style: %.2f", p)
                    return p

    # ── Prioridade 2: accessibility labels soltos ──────────────────────────
    for a11y_sel in (
        "#apex-pricetopay-accessibility-label",
        "[id$='-pricetopay-accessibility-label']",
        "[id$='-accessibility-label'].aok-offscreen",
    ):
        el = card.select_one(a11y_sel)
        if el and not _is_in_secondary_section(el):
            text = el.get_text(strip=True).replace("\xa0", "").strip()
            p = parse_price_br(text)
            if p and p >= MIN_PRICE_BRL:
                log.debug("Price via a11y label '%s': %.2f", a11y_sel, p)
                return p

    # ── Prioridade 3: seletores explícitos do buy-box (fora de seções secundárias) ──
    for sel in (
        ".priceToPay",
        ".apex-pricetopay-value",
        ".a-price[data-a-color='base']",
    ):
        for block in card.select(sel):
            if _is_in_secondary_section(block):
                continue
            if not _price_block_is_instalment(block):
                p = _read_price_block(block)
                if p and p >= MIN_PRICE_BRL:
                    log.debug("Price via selector '%s': %.2f", sel, p)
                    return p

    # ── Prioridade 4: primeiro bloco .a-price fora de seções secundárias ─────
    for block in card.select(".a-price"):
        if _is_in_secondary_section(block):
            continue
        if _price_block_is_instalment(block):
            continue
        p = _read_price_block(block)
        if p and p >= MIN_PRICE_BRL:
            log.debug("Price via first-valid block: %.2f", p)
            return p

    # ── Prioridade 5: regex no texto completo (último recurso) ────────────
    card_text = card.get_text(" ", strip=True)
    for m in re.finditer(r"R\$\s*[\d.,]+", card_text):
        p = parse_price_br(m.group())
        if p and p >= MIN_PRICE_BRL:
            log.debug("Price via card-text regex: %.2f", p)
            return p

    log.debug("No plausible price found on card.")
    return None


def extract_rating(card) -> float | None:
    for sel in [
        '[aria-label*="de 5 estrelas"]',
        '[aria-label*="out of 5 stars"]',
        '[aria-label*="estrelas"]',
        ".a-icon-star-small",
        ".a-icon-star",
    ]:
        el = card.select_one(sel)
        if el:
            label = el.get("aria-label", "") or el.get_text(strip=True)
            m = re.search(
                r"([\d,]+)\s*de\s*5|([\d.]+)\s*out\s*of\s*5|([\d,]+)\s*estrelas",
                label,
                re.IGNORECASE,
            )
            if m:
                raw = (m.group(1) or m.group(2) or m.group(3) or "").replace(",", ".")
                try:
                    value = float(raw)
                    if 0.0 <= value <= 5.0:
                        return round(value, 1)
                except ValueError:
                    pass
    return None  # None em vez de "" — o banco aceita NULL


def extract_image(card) -> str:
    for sel in ["img.s-image", "img[data-image-index]", ".s-product-image-container img"]:
        el = card.select_one(sel)
        if not el:
            continue
        url = el.get("src", "").strip() or el.get("data-src", "").strip()
        if not url or url.startswith("data:"):
            srcset = el.get("srcset", "") or el.get("data-srcset", "")
            if srcset:
                entries = [part.strip().split() for part in srcset.split(",") if part.strip()]
                best = max(
                    (e for e in entries if len(e) == 2),
                    key=lambda e: int(re.sub(r"\D", "", e[1]) or "0"),
                    default=None,
                )
                if best:
                    url = best[0]
        if url and not url.startswith("data:"):
            url = re.sub(r"\._[A-Z0-9_,]+_\.", "._AC_SX300_.", url)
            return url
    return ""


# ─────────────────────────────────────────────────────────────
#  Page parsing
# ─────────────────────────────────────────────────────────────
def parse_page(soup) -> list[dict]:
    """Extrai todos os vinis de uma página de resultados."""
    cards = soup.select('[data-component-type="s-search-result"]')
    results = []
    now = datetime.now()
    skipped = {"no_asin": 0, "no_title": 0, "not_vinyl": 0, "no_price": 0}

    for card in cards:
        asin = card.get("data-asin", "").strip()
        if not asin:
            skipped["no_asin"] += 1
            continue

        title = extract_title(card)
        if not title:
            skipped["no_title"] += 1
            continue

        if not is_vinyl(title, card):
            skipped["not_vinyl"] += 1
            log.debug("Non-vinyl filtered: %s", title[:60])
            continue

        price = extract_price(card)
        if price is None:
            skipped["no_price"] += 1
            log.debug("No price for ASIN %s (%s)", asin, title[:50])
            continue

        results.append({
            "asin":      asin,
            "titulo":    title,
            "artista":   normalize_artist(extract_artist(card)),
            "slug":      gerar_slug(title, asin),
            "imgUrl":    extract_image(card),
            "url":       affiliate_link(asin),
            "rating":    extract_rating(card),
            "precoBrl":  price,
            "capturadoEm": now,
        })

    log.debug(
        "parse_page: %d found | skipped → %s",
        len(results), skipped,
    )
    return results


def has_next_page(soup) -> bool:
    """
    Returns True while more pages should be fetched.

    Amazon's pagination UI sometimes omits the next-page link deep in
    paginated results even though more pages exist.  We keep going as long
    as the current page contained product cards, stopping only when a page
    comes back empty (genuine end-of-catalogue).
    """
    if soup.select_one("a.s-pagination-next") is not None:
        return True
    # No explicit next-link — stop only if this page was also empty.
    return bool(soup.select('[data-component-type="s-search-result"]'))


# ─────────────────────────────────────────────────────────────
#  Main crawl loop
# ─────────────────────────────────────────────────────────────
def crawl(max_pages: int, delay: float) -> list[dict]:
    """Crawleia a página geral de vinis por popularidade."""
    session, backend = make_session()
    log.info("Starting — backend: %s | max_pages: %d", backend, max_pages)
    warm_up(session)

    seen_asins: set[str] = set()
    all_items: list[dict] = []

    for page in range(1, max_pages + 1):
        log.info("Page %d/%d", page, max_pages)
        url = build_page_url(page)
        soup, session = safe_get(session, url)

        if soup is None:
            log.warning("Page %d failed, skipping.", page)
            continue

        for item in parse_page(soup):
            if item["asin"] not in seen_asins:
                seen_asins.add(item["asin"])
                all_items.append(item)

        if not has_next_page(soup):
            log.info("No next page — stopping at page %d.", page)
            break

        if page < max_pages:
            sleep_time = delay + random.uniform(0.5, 1.5)
            log.info("Waiting %.1fs...", sleep_time)
            time.sleep(sleep_time)

    log.info("Crawl done — %d unique products.", len(all_items))
    return all_items


# ─────────────────────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────────────────────
def parse_args():
    parser = argparse.ArgumentParser(description="Amazon vinyl crawler → PostgreSQL")
    parser.add_argument("--max-pages", type=int, default=MAX_PAGES_DEFAULT, metavar="N")
    parser.add_argument("--delay", type=float, default=DELAY_SECONDS, metavar="S")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    log.info("═" * 60)
    log.info("Vinyl Crawler — %s", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    log.info("Max pages: %d  |  Delay: %.1fs  |  Dry run: %s",
             args.max_pages, args.delay, args.dry_run)
    log.info("═" * 60)

    all_items = crawl(args.max_pages, args.delay)

    if not all_items:
        log.warning("No products found. Nothing to write.")
        return

    if args.dry_run:
        log.info("DRY RUN — Sample of first 3 items:")
        for item in all_items[:3]:
            log.info("  ASIN: %s | %s | R$ %.2f", item["asin"], item["titulo"][:50], item["precoBrl"])
        return

    conn = get_connection()
    try:
        written = upsert_batch(conn, all_items)
        log.info("Upserted %d records to PostgreSQL.", written)
        limpar_historico_antigo(conn)
        log.info("History cleanup complete.")
    finally:
        conn.close()

    log.info("Done. ✓")


if __name__ == "__main__":
    main()
