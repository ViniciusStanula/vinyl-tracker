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
import os
import re
import time
import random
import logging
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

from database import (
    upsert_batch,
    limpar_historico_antigo,
    get_connection,
    ensure_schema_extras,
    fetch_active_deals,
    fetch_stale_records,
    mark_stale_price,
    mark_unavailable,
)
from deal_scorer import score_deals
from utils import gerar_slug

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────
ASSOCIATE_TAG      = os.environ.get("ASSOCIATE_TAG", "")
MAX_PAGES_DEFAULT  = 1000      # a página geral tem mais produtos que as de categoria
MAX_PAGES_CATEGORY = 50        # limite por URL de categoria (Amazon raramente passa de 20)
DELAY_SECONDS      = 3
MIN_PRICE_BRL      = 10.0

# URL principal — todos os vinis ordenados por popularidade
VINYL_URL_PATH = (
    "/s?i=popular&srs=19549018011"
    "&rh=n%3A19549018011"
    "&s=popularity-rank"
    "&fs=true"
    "&ref=lp_19549018011_sar"
)

BASE_URL = "https://www.amazon.com.br"

# URLs de categorias de gênero — cada uma é paginada separadamente
CATEGORY_URLS = [
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416074011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416075011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416076011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416077011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416078011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416079011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416080011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416081011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416082011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416084011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416085011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19532539011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416086011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416087011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416088011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416089011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416090011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416091011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416130011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416092011&dc&rnid=18726358011",
    "https://www.amazon.com.br/s?bbn=19549018011&rh=n%3A7791937011%2Cn%3A19549018011%2Cn%3A19416093011&dc&rnid=18726358011",
]

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
    # Amazon social proof badges
    "compras no mês", "compras nos últimos", "bought in past", "bought last month",
    # Amazon promotional noise picked up by fallback selectors
    "amazon music",           # "90 dias de Amazon Music grátis incluso"
    "oferta",                 # "30(6 Ofertas de Novos) Mais Opções de Comprar$ 278"
    "mais opções de comprar", # same
    "opções de comprar",      # same
    "dias de",                # "90 dias de ..."
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


def build_category_page_url(base_url: str, page: int) -> str:
    url = re.sub(r"[&?]page=\d+", "", base_url)
    url = re.sub(r"[&?]qid=\d+", "", url)
    qid = int(time.time())
    return url + f"&qid={qid}&page={page}"


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
#  Product-page fetch + parse (stale-records check)
# ─────────────────────────────────────────────────────────────
def fetch_product_page(session, url: str, retries: int = 3):
    """
    Fetches a single Amazon product detail page.

    Returns (soup_or_none, http_status_or_none, session).

    Callers must inspect http_status:
      404          → product definitively gone; mark unavailable
      None         → transient error (rate-limit, network, CAPTCHA); skip this run
      2xx / other  → soup is populated; parse normally
    """
    from bs4 import BeautifulSoup

    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, timeout=25)
            if resp.status_code == 404:
                return None, 404, session
            if resp.status_code in (503, 429):
                log.warning(
                    "Rate-limited (%s) on product page, backing off...",
                    resp.status_code,
                )
                time.sleep(random.uniform(6, 12))
                session, _ = make_session()
                warm_up(session)
                continue
            resp.raise_for_status()
        except Exception as exc:
            log.warning(
                "Request error fetching product page (attempt %d/%d): %s",
                attempt, retries, exc,
            )
            if attempt < retries:
                time.sleep(random.uniform(4, 8))
                session, _ = make_session()
                continue
            return None, None, session

        if any(s in resp.text for s in [
            "Robot Check", "Verificação de robô", "Digite os caracteres",
        ]):
            log.warning("CAPTCHA detected on product page, skipping.")
            return None, None, session

        return BeautifulSoup(resp.text, "lxml"), resp.status_code, session

    return None, None, session


# In-stock keywords for Amazon Brazil product pages (span.a-color-success / #availability)
_INSTOCK_KW = ("em estoque", "in stock", "disponível", "disponivel")
_OUTOFSTOCK_KW = (
    "atualmente indisponível", "currently unavailable",
    "fora de estoque", "out of stock",
    "não disponível", "not available",
)


def parse_product_page(soup) -> tuple[float | None, bool, int | None]:
    """
    Extracts price, availability, and review count from an Amazon product page.

    Returns (price_brl, in_stock, review_count).

    price_brl is None when the price widget is absent (e.g. "sold by third
    party only" pages where the add-to-cart block isn't rendered).
    in_stock reflects the #availability / span.a-color-success text;
    defaults to False when no availability signal is found.
    review_count is None when the review widget is absent.
    """
    # ── Availability ──────────────────────────────────────────────────────
    in_stock = False

    avail_el = soup.select_one("#availability")
    if avail_el:
        avail_text = avail_el.get_text(" ", strip=True).lower()
        if any(kw in avail_text for kw in _INSTOCK_KW):
            in_stock = True
        elif any(kw in avail_text for kw in _OUTOFSTOCK_KW):
            in_stock = False
        else:
            # Ambiguous availability text — treat as in-stock so we don't
            # incorrectly mark records unavailable.
            in_stock = True
    else:
        # Fallback: green badge anywhere on the page
        for el in soup.select("span.a-color-success"):
            text = el.get_text(" ", strip=True).lower()
            if any(kw in text for kw in _INSTOCK_KW):
                in_stock = True
                break

    # Hard out-of-stock override: explicit widget IDs Amazon uses
    for sel in ("#outOfStock", "#soldByThirdParty"):
        el = soup.select_one(sel)
        if el and el.get_text(strip=True):
            text = el.get_text(" ", strip=True).lower()
            if any(kw in text for kw in _OUTOFSTOCK_KW):
                in_stock = False

    # ── Price ─────────────────────────────────────────────────────────────
    price: float | None = None

    # Priority 1: priceToPay / apex-pricetopay-value containers
    # These are the canonical "buy box" price widgets on product pages.
    for container_sel in (".priceToPay", ".apex-pricetopay-value"):
        container = soup.select_one(container_sel)
        if not container:
            continue

        # 1a. a-offscreen sibling contains the human-readable string "R$217,73"
        offscreen = container.select_one(".a-offscreen")
        if offscreen:
            p = parse_price_br(offscreen.get_text(strip=True).replace("\xa0", ""))
            if p and p >= MIN_PRICE_BRL:
                price = p
                break

        # 1b. whole + fraction spans
        whole_el = container.select_one(".a-price-whole")
        frac_el  = container.select_one(".a-price-fraction")
        if whole_el:
            whole_text = "".join(
                t for t in whole_el.strings
                if t.strip() and t.strip() not in (",", ".")
            ).strip().replace(".", "")
            frac_text = frac_el.get_text(strip=True) if frac_el else "00"
            p = parse_price_br(f"{whole_text},{frac_text}")
            if p and p >= MIN_PRICE_BRL:
                price = p
                break

    # Priority 2: any standalone a-offscreen that starts with "R$"
    # (covers pages where the buy-box uses a different container class)
    if price is None:
        for el in soup.select(".a-offscreen"):
            text = el.get_text(strip=True).replace("\xa0", "")
            if text.startswith("R$") or re.match(r"^\d+[,.]", text):
                p = parse_price_br(text)
                if p and p >= MIN_PRICE_BRL:
                    price = p
                    break

    # ── Review count ──────────────────────────────────────────────────────
    review_count: int | None = None

    # #acrCustomerReviewText → "1.235 avaliações de clientes"
    # span[data-hook="total-review-count"] → same text on some page variants
    for sel in (
        "#acrCustomerReviewText",
        '[data-hook="total-review-count"]',
        '[aria-label*="classificações"]',
        '[aria-label*="avaliações de clientes"]',
        '[aria-label*="ratings"]',
        '[aria-label*="customer reviews"]',
    ):
        el = soup.select_one(sel)
        if not el:
            continue
        text = el.get("aria-label", "") or el.get_text(strip=True)
        m = re.search(r"([\d.,]+)", text)
        if m:
            count_str = m.group(1).replace(".", "").replace(",", "")
            try:
                val = int(count_str)
                if val > 0:
                    review_count = val
                    break
            except ValueError:
                pass

    return price, in_stock, review_count


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
        # strip "por/by/de" prefix even when not followed by a space
        # e.g. "por$uicideboy$" → "$uicideboy$"
        text = re.sub(r"^(por|by|de)(?=\s|[^a-zA-ZÀ-ÿ])", "", text, flags=re.IGNORECASE).strip()
        # strip trailing year/format suffix e.g. "|2022" or "| 2022 (Deluxe Edition)"
        text = re.sub(r"\s*\|\s*\d{4}\b.*$", "", text).strip()
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
      0. [data-cy="price-recipe"] → span.a-price[xl][base] → .a-offscreen (seletor confirmado)
      1. Container apex-core-price-identifier → accessibility label (estrutura real)
      2. .s-price-instructions-style — container principal do preço nos resultados de busca
      3. Accessibility labels soltos no card (fallback)
      4. Seletores explícitos do buy-box (excluindo seções secundárias)
      5. Primeiro bloco .a-price não parcelado e fora de seções secundárias
      6. Regex no texto completo do card (último recurso)

    Seções secundárias (data-cy="secondary-offer-recipe" etc.) exibem preços de
    formatos alternativos (ex: CD) — esses nunca devem ser capturados como preço principal.
    """
    # ── Prioridade 0: data-cy="price-recipe" (seletor confirmado pela análise do HTML) ──
    price_recipe = card.select_one('[data-cy="price-recipe"]')
    if price_recipe:
        offscreen = price_recipe.select_one(
            '.a-price[data-a-size="xl"][data-a-color="base"] .a-offscreen'
        )
        if offscreen:
            text = offscreen.get_text(strip=True).replace("\xa0", "").strip()
            p = parse_price_br(text)
            if p and p >= MIN_PRICE_BRL:
                log.debug("Price via price-recipe a-offscreen: %.2f", p)
                return p

    # ── Prioridade 1: apex-core-price-identifier (estrutura real confirmada) ──
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

    # ── Prioridade 2: price-instructions-style container (principal nos resultados) ──
    # Amazon changed the class prefix from "s-" to "puis-"; match both.
    price_section = card.select_one(
        ".s-price-instructions-style, .puis-price-instructions-style"
    )
    if price_section:
        for block in price_section.select(".a-price"):
            if not _price_block_is_instalment(block):
                p = _read_price_block(block)
                if p and p >= MIN_PRICE_BRL:
                    log.debug("Price via price-instructions-style: %.2f", p)
                    return p

    # ── Prioridade 3: accessibility labels soltos ──────────────────────────
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

    # ── Prioridade 4: seletores explícitos do buy-box (fora de seções secundárias) ──
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

    # ── Prioridade 5: primeiro bloco .a-price fora de seções secundárias ─────
    for block in card.select(".a-price"):
        if _is_in_secondary_section(block):
            continue
        if _price_block_is_instalment(block):
            continue
        p = _read_price_block(block)
        if p and p >= MIN_PRICE_BRL:
            log.debug("Price via first-valid block: %.2f", p)
            return p

    # ── Prioridade 6: regex no texto completo (último recurso) ────────────
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


def extract_review_count(card) -> int | None:
    """
    Extracts the number of customer reviews from a search-result card.

    Amazon Brazil renders the count in a span whose aria-label reads e.g.
    "1.235 classificações" (dot = thousands separator in pt-BR).
    Falls back to the plain visible text inside the same span.
    """
    for sel in (
        '[aria-label*="classificações"]',
        '[aria-label*="avaliações de clientes"]',
        '[aria-label*="ratings"]',
        '[aria-label*="customer reviews"]',
    ):
        el = card.select_one(sel)
        if not el:
            continue
        # Prefer the aria-label; fall back to visible text (both carry the count)
        text = el.get("aria-label", "") or el.get_text(strip=True)
        m = re.search(r"([\d.,]+)", text)
        if m:
            # Remove thousands separators (pt-BR uses "." as thousands sep)
            count_str = m.group(1).replace(".", "").replace(",", "")
            try:
                val = int(count_str)
                if val > 0:
                    return val
            except ValueError:
                pass
    return None


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
    now = datetime.now(timezone.utc)
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
            "asin":        asin,
            "titulo":      title,
            "artista":     normalize_artist(extract_artist(card)),
            "slug":        gerar_slug(title, asin),
            "imgUrl":      extract_image(card),
            "url":         affiliate_link(asin),
            "rating":      extract_rating(card),
            "reviewCount": extract_review_count(card),
            "precoBrl":    price,
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
def crawl_single_url(
    session,
    url_builder,
    label: str,
    max_pages: int,
    delay: float,
    seen_asins: set,
    max_consecutive_empty: int = 5,
):
    """
    Crawls a single paginated URL until exhausted or max_pages reached.

    url_builder(page) → URL string
    seen_asins is mutated in-place — ASINs collected here are added so the
    caller can share it across multiple crawl_single_url calls to deduplicate
    across sources within the same run.

    Returns (new_items, session).
    """
    items: list[dict] = []
    consecutive_empty = 0

    for page in range(1, max_pages + 1):
        url = url_builder(page)
        log.info("[%s] Page %d", label, page)
        soup, session = safe_get(session, url)

        if soup is None:
            log.warning("[%s] Page %d failed, skipping.", label, page)
            continue

        new_on_page = 0
        for item in parse_page(soup):
            if item["asin"] not in seen_asins:
                seen_asins.add(item["asin"])
                items.append(item)
                new_on_page += 1

        if new_on_page == 0:
            consecutive_empty += 1
            log.info(
                "[%s] No new products on page %d (%d/%d consecutive).",
                label, page, consecutive_empty, max_consecutive_empty,
            )
            if consecutive_empty >= max_consecutive_empty:
                log.info("[%s] End of results — stopping at page %d.", label, page)
                break
        else:
            consecutive_empty = 0

        if not has_next_page(soup):
            log.info("[%s] No next page — stopping at page %d.", label, page)
            break

        if page < max_pages:
            sleep_time = delay + random.uniform(0.5, 1.5)
            log.info("[%s] Waiting %.1fs...", label, sleep_time)
            time.sleep(sleep_time)

    return items, session


def crawl(max_pages: int, delay: float) -> list[dict]:
    """
    Orchestrates the full crawl:
      1. Main popularity-ranked URL (up to max_pages pages).
      2. Each genre category URL (up to MAX_PAGES_CATEGORY pages each).

    A single seen_asins set is shared across all sources so that an ASIN
    found in the main crawl is never re-processed from a category crawl,
    preventing duplicate HistoricoPreco rows within the same run.
    """
    session, backend = make_session()
    log.info("Starting — backend: %s | max_pages (main): %d", backend, max_pages)
    warm_up(session)

    seen_asins: set[str] = set()
    all_items: list[dict] = []

    # ── 1. Main popularity URL ─────────────────────────────────────────────
    log.info("═" * 50)
    log.info("Crawling main popularity URL...")
    items, session = crawl_single_url(
        session,
        build_page_url,
        "main",
        max_pages,
        delay,
        seen_asins,
        max_consecutive_empty=20,
    )
    all_items.extend(items)
    log.info("Main URL complete — %d products.", len(items))

    # ── 2. Genre category URLs ─────────────────────────────────────────────
    for i, cat_url in enumerate(CATEGORY_URLS, 1):
        log.info("═" * 50)
        log.info(
            "Crawling category %d/%d  ...%s",
            i, len(CATEGORY_URLS), cat_url[-50:],
        )
        time.sleep(random.uniform(2.0, 4.0))

        def _url_builder(page, _base=cat_url):
            return build_category_page_url(_base, page)

        items, session = crawl_single_url(
            session,
            _url_builder,
            f"cat-{i}",
            MAX_PAGES_CATEGORY,
            delay,
            seen_asins,
            max_consecutive_empty=5,
        )
        all_items.extend(items)
        log.info("Category %d complete — %d new products.", i, len(items))

    log.info("═" * 50)
    log.info("Full crawl done — %d unique products total.", len(all_items))
    return all_items


# ─────────────────────────────────────────────────────────────
#  Stale-records check
# ─────────────────────────────────────────────────────────────
def _fetch_one_stale(record: dict, delay: float, worker_idx: int) -> dict:
    """
    Worker function: fetches a single product page in its own session.
    Called from a ThreadPoolExecutor — must be stateless w.r.t. the DB
    connection (all DB writes happen back on the main thread).

    Returns a result dict with keys: record, outcome, price, review_count.
    outcome is one of: "updated", "unavailable", "error".
    """
    # Stagger worker starts so they don't fire simultaneously.
    time.sleep(worker_idx * random.uniform(1.0, 2.0))

    url = affiliate_link(record["asin"])
    session, _ = make_session()
    soup, status, _ = fetch_product_page(session, url)

    result = {"record": record, "outcome": "error", "price": None, "review_count": None}

    if status == 404:
        result["outcome"] = "unavailable"
    elif soup is None:
        result["outcome"] = "error"
    else:
        price, in_stock, review_count = parse_product_page(soup)
        if not in_stock:
            result["outcome"] = "unavailable"
        elif price is None:
            result["outcome"] = "error"
        else:
            result["outcome"] = "updated"
            result["price"] = price
            result["review_count"] = review_count

    # Per-worker delay so the combined request rate stays at ≤ max_workers/delay req/s.
    time.sleep(delay + random.uniform(0.5, 1.5))
    return result


def crawl_stale_records(
    stale: list[dict],
    delay: float,
    conn,
    dry_run: bool,
    max_workers: int = 2,
) -> tuple[int, int, int]:
    """
    Fetches individual product pages for records absent from the category crawl
    and updates the database accordingly.

    Uses ThreadPoolExecutor(max_workers) to overlap I/O waits.  DB writes are
    performed sequentially on the calling thread so no connection locking is
    needed (psycopg2 connections are not thread-safe).

    For each stale record:
      - HTTP 404            → mark_unavailable()
      - Out-of-stock page   → mark_unavailable()
      - In-stock + price    → mark_stale_price()
      - In-stock, no price  → warning; DB not touched this run
      - Transient error     → warning; DB not touched (will retry next run)

    Returns (updated, unavailable, errors).
    """
    now = datetime.now(timezone.utc)
    updated = unavailable = errors = 0
    total = len(stale)

    log.info("Stale-records: %d records, %d parallel workers", total, max_workers)

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {
            pool.submit(_fetch_one_stale, record, delay, idx % max_workers): record
            for idx, record in enumerate(stale)
        }

        completed = 0
        for future in as_completed(futures):
            completed += 1
            try:
                res = future.result()
            except Exception as exc:
                log.warning("[stale %d/%d] Worker raised: %s", completed, total, exc)
                errors += 1
                continue

            record   = res["record"]
            outcome  = res["outcome"]
            asin     = record["asin"]
            disco_id = record["id"]
            label    = record.get("titulo", "")[:50]

            log.info(
                "[stale %d/%d] ASIN %s — %s → %s",
                completed, total, asin, label, outcome,
            )

            if outcome == "unavailable":
                if not dry_run:
                    mark_unavailable(conn, disco_id)
                unavailable += 1
            elif outcome == "updated":
                log.info("  R$ %.2f  reviews=%s", res["price"], res["review_count"])
                if not dry_run:
                    mark_stale_price(conn, disco_id, res["price"], now, res["review_count"])
                updated += 1
            else:
                errors += 1

    log.info(
        "Stale-records check done — %d updated | %d unavailable | %d skipped",
        updated, unavailable, errors,
    )
    return updated, unavailable, errors


# ─────────────────────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────────────────────
def parse_args():
    parser = argparse.ArgumentParser(description="Amazon vinyl crawler → PostgreSQL")
    parser.add_argument("--max-pages", type=int, default=MAX_PAGES_DEFAULT, metavar="N")
    parser.add_argument("--delay", type=float, default=DELAY_SECONDS, metavar="S")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument(
        "--stale-max", type=int, default=200, metavar="N",
        help="Max stale records to re-fetch per run (0 = unlimited, default: 200)",
    )
    parser.add_argument(
        "--stale-workers", type=int, default=2, metavar="N",
        help="Parallel workers for stale-records fetching (default: 2)",
    )
    parser.add_argument(
        "--skip-stale", action="store_true",
        help="Skip the stale-records check entirely",
    )
    parser.add_argument(
        "--skip-deal-revalidation", action="store_true",
        help="Skip the pre-crawl deal re-validation phase",
    )
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

    t_start = time.monotonic()

    if args.dry_run:
        log.info("DRY RUN — skipping DB phases; running crawl only.")
        t0 = time.monotonic()
        all_items = crawl(args.max_pages, args.delay)
        log.info("Phase crawl: %.0fs", time.monotonic() - t0)
        log.info("DRY RUN — Sample of first 3 items:")
        for item in all_items[:3]:
            log.info("  ASIN: %s | %s | R$ %.2f", item["asin"], item["titulo"][:50], item["precoBrl"])
        return

    conn = get_connection()
    try:
        ensure_schema_extras(conn)

        # ── Phase 0: Re-validate active deals (highest priority) ──────────
        # Query for records currently flagged as deals and re-crawl them
        # immediately so that the DB reflects the freshest prices before we
        # spend time discovering new ones.
        if args.skip_deal_revalidation:
            log.info("Deal re-validation skipped (--skip-deal-revalidation).")
        else:
            log.info("═" * 60)
            t0 = time.monotonic()
            active_deals = fetch_active_deals(conn)
            log.info(
                "Phase 0 — Deal re-validation: %d active deals to re-check.",
                len(active_deals),
            )
            if active_deals:
                crawl_stale_records(
                    active_deals, args.delay, conn,
                    dry_run=False, max_workers=args.stale_workers,
                )
                # Re-score immediately after re-validation so that deals whose
                # prices just went up (or products that became unavailable) are
                # cleared before Phase 1 runs.  Without this, a deal that Phase 0
                # invalidated would stay visible if Phase 1 returns no results and
                # Phase 2.5 never executes.
                score_deals(conn)
                log.info("Phase 0 done: %.0fs", time.monotonic() - t0)
            else:
                log.info("No active deals found — skipping re-validation.")

        # ── Phase 1: Regular crawl ─────────────────────────────────────────
        log.info("═" * 60)
        t0 = time.monotonic()
        all_items = crawl(args.max_pages, args.delay)
        log.info("Phase 1 crawl: %.0fs", time.monotonic() - t0)

        if not all_items:
            log.warning("No products found. Nothing to write.")
        else:
            # ── Phase 2: Upsert crawl results ──────────────────────────────
            t0 = time.monotonic()
            written = upsert_batch(conn, all_items)
            log.info("Phase 2 upsert: %.0fs — %d records written.", time.monotonic() - t0, written)

            # ── Phase 2.5: Deal scoring ─────────────────────────────────────
            # Runs after every upsert so deal_score reflects the freshest prices.
            # score_deals computes multi-window benchmarks (avg_30d, avg_90d,
            # low_30d, low_all_time) in a single SQL query, applies tiered scoring
            # rules with cooldown logic in Python, then batch-updates Disco.
            log.info("═" * 60)
            t0 = time.monotonic()
            scoring_summary = score_deals(conn)
            log.info(
                "Phase 2.5 scoring: %.0fs — flagged=%d | maintained=%d"
                " | cleared=%d | cooldown_skipped=%d",
                time.monotonic() - t0,
                scoring_summary["flagged"],
                scoring_summary["scored"],
                scoring_summary["cleared"],
                scoring_summary["skipped"],
            )

            # ── Phase 3: Stale-records check ───────────────────────────────
            if args.skip_stale:
                log.info("Stale-records check skipped (--skip-stale).")
            else:
                seen_asins = {item["asin"] for item in all_items}
                stale_limit = args.stale_max if args.stale_max > 0 else 10_000
                stale = fetch_stale_records(conn, seen_asins, limit=stale_limit)

                log.info("═" * 60)
                log.info(
                    "Phase 3 stale-records — %d records not seen in this run (limit %d).",
                    len(stale), stale_limit,
                )

                if stale:
                    t0 = time.monotonic()
                    crawl_stale_records(
                        stale, args.delay, conn,
                        dry_run=False, max_workers=args.stale_workers,
                    )
                    log.info("Phase 3 stale: %.0fs", time.monotonic() - t0)
                else:
                    log.info("No stale records — all known records appeared in this crawl.")

        # ── Phase 4: History cleanup ───────────────────────────────────────
        t0 = time.monotonic()
        limpar_historico_antigo(conn)
        log.info("Phase 4 cleanup: %.0fs", time.monotonic() - t0)
    finally:
        conn.close()

    log.info("Total runtime: %.0fs", time.monotonic() - t_start)
    log.info("Done. ✓")


if __name__ == "__main__":
    main()
