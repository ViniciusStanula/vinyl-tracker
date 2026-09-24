"""
umusicstore_crawler.py — umusicstore.com (Universal Music Brazil, VTEX) vinyl
price crawler → main Disco catalog
──────────────────────────────────────────────────────────────────────────────
Walks the public VTEX Search API for the umusicstore.com vinyl category and
upserts every product into the SAME "Disco" / "HistoricoPreco" tables the
Amazon and Mercado Livre crawlers use, tagged marketplace='umusicstore'. This
lets umusicstore records reuse the whole enrichment + frontend stack (artist
pages, genre pages, price history) exactly like the other marketplaces.

Why the VTEX Search API (not HTML scraping, not a curated CSV like ML): it's
the same public JSON endpoint the storefront's own JS calls, unauthenticated,
paginated, and — unlike Amazon or ML — it returns a barcode (ean) and clean
"Artista"/"Gênero" specification fields per product, so no title-parsing
heuristics are needed for the common case.

No affiliate program exists for umusicstore.com direct (only via a separate
Shopee storefront, out of scope here) — so Disco.url is a plain, untagged
product link. See frontend/lib/affiliateUrl.ts: any marketplace other than
"amazon" passes `url` through unchanged, so this is correct as-is.

Enrichment note: MusicBrainz (name-only match), Last.fm tags/bio, and the
titulo_seo backfill (title cleaning, vinil_cor, vinil_edicao, ...) all select
their backlog with no marketplace filter, so umusicstore rows are picked up
automatically by the existing scheduled workflows — nothing extra to wire up.
The one thing this crawler does that ML's doesn't: it populates Disco.ean
from VTEX's GTIN, which feeds schema.org gtin13 AND is the primary key the
Discogs barcode-match pass (discogs_enrich.py) looks for — a real advantage
over Amazon rows that needed a separate EAN backfill (backfill_ean.py).

Known v1 simplification: a VTEX product can have multiple SKUs ("items") for
the same title (e.g. different vinyl colors). This crawler collapses each
product to ONE Disco row, using whichever SKU currently has the lowest
available price for its ean/image/stock — it does not create a separate row
per color variant. vinil_cor still gets set correctly from the title text by
the existing titulo_seo backfill regardless of which SKU backed the row.

Usage:
    python umusicstore_crawler.py                 # full catalog sync
    python umusicstore_crawler.py --dry-run        # crawl but don't write to DB
    python umusicstore_crawler.py --limit 50        # only first 50 products (smoke test)

Environment (crawler/.env):
    UMUSICSTORE_VTEX_ACCOUNT   — VTEX account name (default: universalmusic)
    UMUSICSTORE_CATEGORY_PATH  — VTEX category path (default: musica/lp---vinil)
    UMUSICSTORE_DOMAIN         — storefront domain for product links
                                  (default: https://www.umusicstore.com)
    DATABASE_URL                — Supabase Postgres (shared with the other crawlers)
"""
import os
import re
import sys
import time
import random
import logging
import argparse
from dataclasses import dataclass
from datetime import datetime, timezone

# Load crawler/.env so local runs match CI (no-op when real env vars are set).
from preflight import load_dotenv_if_present
load_dotenv_if_present()

from curl_cffi import requests as cffi_requests
from database import get_connection, ensure_ean_column
from utils import gerar_slug
from domain import UNKNOWN_ARTIST, normalize_artist, _is_plausible_artist

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────
VTEX_ACCOUNT   = os.environ.get("UMUSICSTORE_VTEX_ACCOUNT", "universalmusic")
STORE_DOMAIN   = os.environ.get("UMUSICSTORE_DOMAIN", "https://www.umusicstore.com")

# The VTEX Search API caps any single query's _from/_to pagination window at
# _from<=2500 (confirmed live: explicit "Parameter _from can't be greater
# than 2500" error). "vinil-importado" alone holds ~3883 products (confirmed
# via the `resources` response header), so a single ordered pass can't reach
# all of it. Name-sort dual-direction pagination (ascending + descending,
# merged by productId) was tried first but left a real, reproducible gap:
# both directions' reachable windows stop short of the middle of the
# alphabet (ASC reaches only up to "D" names, DESC only down to "N" names),
# recovering just ~3206/3883. Price-sort dual-direction was worse (~2551)
# due to heavy price-tie clustering.
#
# The fix: partition by brand instead of paging one big ordered list. Every
# product in this catalog belongs to exactly one VTEX "brand" (Universal
# Music files each artist as its own brand — confirmed via
# /api/catalog_system/pub/brand/list, ~1176 active brands), and each brand's
# catalog is small (confirmed live: zero brands exceed the 50-item page
# size), so `fq=B:{id}` per brand never hits the pagination cap at all.
# Sweeping every active brand id recovered 5359 unique products store-wide
# (all formats — CD/vinyl/merch — vinyl is a subset), matching the expected
# ~4094-vinyl-record scale far better than either ordered-pagination attempt.
#
# discover_all() still also runs the old per-category name-ASC/DESC pass and
# unions it in, as a cheap safety net for the one case brand-partitioning
# can't reach: a product filed with no brand at all. Real category slugs
# confirmed via VTEX's category tree API (category/tree/5) — not guessed
# from the display names.
CATEGORY_PATHS = [
    p.strip() for p in os.environ.get(
        "UMUSICSTORE_CATEGORY_PATHS",
        "musica/lp-|-vinil/vinil-nacional,"
        "musica/lp-|-vinil/vinil-importado,"
        "musica/lp-|-vinil/edicao-clube-do-vinil",
    ).split(",") if p.strip()
]
API_BASE       = f"https://{VTEX_ACCOUNT}.vtexcommercestable.com.br/api/catalog_system/pub/products/search"
BRAND_LIST_URL = f"https://{VTEX_ACCOUNT}.vtexcommercestable.com.br/api/catalog_system/pub/brand/list"

PAGE_SIZE      = 50    # VTEX's max page size for this endpoint
DELAY_RANGE    = (0.6, 1.5)   # jittered pause between pages
# VTEX intermittently 500s mid-pagination even well short of the real ~2500
# cap (confirmed live: same offset succeeds seconds later on manual retry).
# A generous attempt count lets a page ride out these blips instead of
# truncating a whole discovery pass early and leaving a real gap.
MAX_ATTEMPTS   = 6

# ─────────────────────────────────────────────────────────────
#  Logging  (mirror ml_crawler.py: stdout + file)
# ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            os.path.join(os.path.dirname(__file__), "umusicstore_crawler.log"),
            encoding="utf-8",
        ),
    ],
)
log = logging.getLogger("umusicstore_crawler")


# ─────────────────────────────────────────────────────────────
#  Row
# ─────────────────────────────────────────────────────────────
@dataclass
class Row:
    vtex_id: str                  # productId — stored as Disco.asin
    titulo: str
    artista: str
    estilo: str | None = None
    ean: str | None = None
    img_url: str | None = None
    url: str = ""
    price: float | None = None
    disponivel: bool = False


# ─────────────────────────────────────────────────────────────
#  Artist derivation from the catalog title (fallback only — the "Artista"
#  specification field covers the common case, see _derive_artist below)
# ─────────────────────────────────────────────────────────────
_TITLE_NOISE_RE = re.compile(
    r"^[\s\-]*"
    r"(box\s?set\s+)?"
    r"(vinil|lp|disco de vinil|cd)\b[\s:\-]*",
    re.IGNORECASE,
)


def _artist_from_title(title: str) -> str:
    """Best-effort artist from a title like
    'Vinil Milton Nascimento - Clube da Esquina 2 (2LP)' → 'Milton Nascimento'."""
    if not title:
        return UNKNOWN_ARTIST
    t = _TITLE_NOISE_RE.sub("", title).strip()
    cand = t.split(" - ", 1)[0].strip() if " - " in t else ""
    cand = normalize_artist(cand)
    if cand and len(cand) <= 60 and _is_plausible_artist(cand):
        return cand
    return UNKNOWN_ARTIST


def _first_spec(product: dict, key: str) -> str | None:
    """VTEX specification fields (e.g. 'Artista', 'Gênero') are arrays of strings."""
    val = product.get(key)
    if isinstance(val, list) and val:
        v = str(val[0]).strip()
        return v or None
    if isinstance(val, str) and val.strip():
        return val.strip()
    return None


def _derive_artist(product: dict) -> str:
    for cand in (_first_spec(product, "Artista"), product.get("brand")):
        if cand:
            cand = normalize_artist(cand)
            if cand and len(cand) <= 60 and _is_plausible_artist(cand):
                return cand
    return _artist_from_title(product.get("productName") or "")


# ─────────────────────────────────────────────────────────────
#  EAN normalization → strict 13-digit, matching discogs_enrich.py's
#  `ean ~ '^[0-9]{13}$'` barcode-match candidate query.
# ─────────────────────────────────────────────────────────────
def _normalize_ean(raw: str | None) -> str | None:
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 13:
        return digits
    if len(digits) == 14 and digits[0] == "0":
        return digits[1:]
    if len(digits) == 12:
        return "0" + digits
    return None


def _product_url(product: dict) -> str | None:
    link_text = (product.get("linkText") or "").strip()
    if link_text:
        return f"{STORE_DOMAIN}/{link_text}/p"
    link = (product.get("link") or "").strip()
    m = re.match(r"https?://[^/]+(/.*)", link)
    return f"{STORE_DOMAIN}{m.group(1)}" if m else None


def _extract_offer(items: list[dict]) -> tuple[float | None, bool, str | None, str | None]:
    """Across every SKU/seller: lowest available price, any-in-stock flag,
    and the ean/image of whichever SKU produced that price (falls back to the
    first SKU's ean/image when nothing is currently available)."""
    best_price: float | None = None
    best_item: dict | None = None
    any_available = False
    for item in items:
        for seller in item.get("sellers") or []:
            offer = seller.get("commertialOffer") or {}
            available = bool(offer.get("IsAvailable")) and (offer.get("AvailableQuantity") or 0) > 0
            if available:
                any_available = True
            price = offer.get("Price")
            if available and isinstance(price, (int, float)) and price > 0:
                if best_price is None or price < best_price:
                    best_price, best_item = float(price), item

    src_item = best_item or (items[0] if items else None)
    ean = _normalize_ean(src_item.get("ean")) if src_item else None
    img_url = None
    if src_item:
        imgs = src_item.get("images") or []
        if imgs and imgs[0].get("imageUrl"):
            img_url = imgs[0]["imageUrl"]
    return best_price, any_available, ean, img_url


# Guard against the vinyl category cross-listing non-vinyl products (CDs,
# apparel/merch bundles) — the same class of bug fixed for Amazon in
# titulo_seo.py (book leaked in via a title-only "LP" match). Structural
# check (categories path) first, title keywords as a backstop.
_MERCH_KEYWORDS_RE = re.compile(
    r"\b(camiseta|caneca|bon[eé]|moletom|p[oô]ster|ecobag|chaveiro|adesivo|"
    r"garrafa|squeeze|almofada|quadro|action figure|funko)\b",
    re.IGNORECASE,
)
_VINYL_HINT_RE = re.compile(r"\b(vinil|vinyl|lp)\b", re.IGNORECASE)
_CD_ONLY_RE = re.compile(r"\bcd\b", re.IGNORECASE)


def _is_vinyl_product(product: dict) -> bool:
    title = product.get("productName") or ""
    if _MERCH_KEYWORDS_RE.search(title):
        return False
    categories = product.get("categories") or []
    cat_text = " ".join(str(c) for c in categories)
    has_vinyl_category = bool(_VINYL_HINT_RE.search(cat_text))
    has_vinyl_title = bool(_VINYL_HINT_RE.search(title))
    if not has_vinyl_category and not has_vinyl_title:
        return False
    # "CD" in the title with no vinyl/LP mention anywhere = plain CD, even if
    # VTEX filed it under the vinyl category tree.
    if _CD_ONLY_RE.search(title) and not has_vinyl_title:
        return False
    return True


def parse_product(product: dict) -> Row | None:
    vtex_id = str(product.get("productId") or "").strip()
    titulo = (product.get("productName") or "").strip()
    if not vtex_id or not titulo:
        return None
    if not _is_vinyl_product(product):
        log.info("[%s] not vinyl, skipping: %s", vtex_id, titulo[:60])
        return None
    url = _product_url(product)
    if not url:
        log.warning("[%s] no resolvable product URL, skipping: %s", vtex_id, titulo[:60])
        return None
    price, disponivel, ean, img_url = _extract_offer(product.get("items") or [])
    return Row(
        vtex_id=vtex_id,
        titulo=titulo,
        artista=_derive_artist(product),
        estilo=_first_spec(product, "Gênero"),
        ean=ean,
        img_url=img_url,
        url=url,
        price=price,
        disponivel=disponivel,
    )


# ─────────────────────────────────────────────────────────────
#  VTEX Search API client — public, unauthenticated, paginated
# ─────────────────────────────────────────────────────────────
class VTEXClient:
    def __init__(self):
        self._session = cffi_requests.Session(impersonate="chrome124")

    def fetch_brand_list(self) -> list[dict] | None:
        """GET the store-wide brand list (unpaginated) → list of brand dicts,
        or None on unrecoverable error."""
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                resp = self._session.get(
                    BRAND_LIST_URL, headers={"Accept": "application/json"}, timeout=30,
                )
            except Exception as exc:
                log.warning("Brand-list request error (attempt %d/%d): %s", attempt, MAX_ATTEMPTS, exc)
                if attempt < MAX_ATTEMPTS:
                    time.sleep((2 ** attempt) / 2 + random.uniform(0, (2 ** attempt) / 2))
                    continue
                return None
            if resp.status_code == 200:
                try:
                    data = resp.json()
                except Exception:
                    return None
                return data if isinstance(data, list) else None
            log.warning("Brand-list HTTP %s (attempt %d/%d)", resp.status_code, attempt, MAX_ATTEMPTS)
            if attempt < MAX_ATTEMPTS:
                time.sleep((2 ** attempt) / 2 + random.uniform(0, (2 ** attempt) / 2))
        return None

    def fetch_page(self, url: str, extra_params: dict, _from: int, _to: int) -> list[dict] | None:
        """GET one page → list of product dicts, or None on unrecoverable error."""
        params = {**extra_params, "_from": _from, "_to": _to}
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                resp = self._session.get(
                    url,
                    params=params,
                    headers={"Accept": "application/json"},
                    timeout=30,
                )
            except Exception as exc:
                log.warning("Request error offset=%d (attempt %d/%d): %s", _from, attempt, MAX_ATTEMPTS, exc)
                if attempt < MAX_ATTEMPTS:
                    time.sleep((2 ** attempt) / 2 + random.uniform(0, (2 ** attempt) / 2))
                    continue
                return None

            if resp.status_code == 429:
                wait = float(resp.headers.get("Retry-After", "0") or 0) or (2 ** attempt)
                log.warning("429 rate-limited at offset=%d — sleeping %.0fs", _from, wait)
                time.sleep(wait)
                continue
            if resp.status_code in (200, 206):
                try:
                    data = resp.json()
                except Exception:
                    log.warning("Non-JSON response at offset=%d", _from)
                    return None
                return data if isinstance(data, list) else None
            if 500 <= resp.status_code < 600:
                log.warning("HTTP %s (transient) at offset=%d (attempt %d/%d)",
                            resp.status_code, _from, attempt, MAX_ATTEMPTS)
                if attempt < MAX_ATTEMPTS:
                    time.sleep((2 ** attempt) / 2 + random.uniform(0, (2 ** attempt) / 2))
                    continue
                return None
            log.warning("HTTP %s at offset=%d", resp.status_code, _from)
            return None
        return None


def _fetch_page_warm(client: VTEXClient, url: str, extra_params: dict, _from: int, _to: int) -> list[dict] | None:
    """A brand-id URL's first hit can return an incomplete page (confirmed
    live: a brand's true 44-item catalog returned only 2 items on a cold
    first request, then 44 stably on every immediate repeat). Fetching twice
    and merging by productId defends every page against this without needing
    to know in advance which URLs are cold. Returns None only if BOTH
    attempts fail outright."""
    first = client.fetch_page(url, extra_params, _from, _to)
    second = client.fetch_page(url, extra_params, _from, _to)
    if first is None and second is None:
        return None
    merged: dict[str, dict] = {}
    for p in (first or []) + (second or []):
        pid = str(p.get("productId") or "")
        if pid:
            merged[pid] = p
    return list(merged.values())


def _page_through(client: VTEXClient, url: str, extra_params: dict, label: str, limit: int = 0, warm: bool = True) -> list[dict]:
    """Shared pagination loop: stops on the first short page — VTEX's normal
    end-of-results signal — or on an outright fetch failure (including the
    _from<=2500 window cap), in which case it stops early with whatever was
    gathered so far rather than silently under-reporting as complete. `limit`
    (smoke-test only) stops paging once enough products are gathered.

    `warm=True` (full discovery) double-fetches each page via
    _fetch_page_warm to defend against the cold-cache under-count. `warm=False`
    (the frequent, lightweight price-refresh pass) single-fetches instead —
    half the requests, at the cost of occasionally missing a just-added
    product on that one run; it self-heals on the next refresh pass or the
    next full daily sweep, so completeness isn't required here."""
    products: list[dict] = []
    offset = 0
    while True:
        page = (_fetch_page_warm(client, url, extra_params, offset, offset + PAGE_SIZE - 1) if warm
                else client.fetch_page(url, extra_params, offset, offset + PAGE_SIZE - 1))
        if page is None:
            log.error("[%s] page fetch failed at offset=%d — stopping this pass early (%d so far).",
                       label, offset, len(products))
            break
        if not page:
            break
        products.extend(page)
        log.info("[%s] fetched offset %d-%d (%d total so far)", label, offset, offset + PAGE_SIZE - 1, len(products))
        if len(page) < PAGE_SIZE:
            break
        if limit and len(products) >= limit:
            break
        offset += PAGE_SIZE
        time.sleep(random.uniform(*DELAY_RANGE))
    return products


def discover_by_brand(client: VTEXClient, limit: int = 0) -> list[dict]:
    """Primary discovery path: sweep every active VTEX brand (Universal Music
    files each artist as its own brand) and merge its catalog, de-duping by
    productId. Each brand's catalog is small — confirmed live, zero brands
    exceed one page (50 items) — so this never hits VTEX's _from<=2500
    pagination cap the way a single big ordered category listing does."""
    brands = client.fetch_brand_list() or []
    active_ids = [b["id"] for b in brands if b.get("isActive") and b.get("id")]
    log.info("Brand sweep: %d active brand(s) to crawl.", len(active_ids))

    by_id: dict[str, dict] = {}
    for i, brand_id in enumerate(active_ids):
        if limit and len(by_id) >= limit:
            break
        remaining = (limit - len(by_id)) if limit else 0
        products = _page_through(client, API_BASE, {"fq": f"B:{brand_id}"}, f"brand:{brand_id}", limit=remaining)
        for product in products:
            pid = str(product.get("productId") or "")
            if pid:
                by_id[pid] = product
        if (i + 1) % 100 == 0:
            log.info("Brand sweep progress: %d/%d brands, %d unique product(s) so far.",
                      i + 1, len(active_ids), len(by_id))
        time.sleep(random.uniform(*DELAY_RANGE))
    return list(by_id.values())


def discover_by_category_name_order(client: VTEXClient, limit: int = 0, warm: bool = True) -> list[dict]:
    """Safety-net discovery path: the old per-category name-ASC/DESC sweep.
    Kept as a supplementary pass, unioned into the brand sweep in
    discover_all(), to catch the one class of product the brand sweep can't
    reach — one filed with no brand at all."""
    by_id: dict[str, dict] = {}
    for category_path in CATEGORY_PATHS:
        for order in ("OrderByNameASC", "OrderByNameDESC"):
            if limit and len(by_id) >= limit:
                break
            remaining = (limit - len(by_id)) if limit else 0
            url = f"{API_BASE}/{category_path}"
            products = _page_through(client, url, {"O": order}, f"{category_path}:{order}", limit=remaining, warm=warm)
            for product in products:
                pid = str(product.get("productId") or "")
                if pid:
                    by_id[pid] = product
    return list(by_id.values())


def discover_refresh(client: VTEXClient) -> list[dict]:
    """Lightweight price/availability refresh pass for the frequent (every
    few hours) run: a single-fetch, ASC-only category listing — no
    brand sweep, no double-fetch. Cheap (~150 requests vs. the full sweep's
    ~2500) at the cost of partial coverage on any one run; harmless because
    this pass never triggers the disponivel=false sync-drop (see
    upsert_umusicstore's sync_drop param) and self-heals via the next full
    daily sweep. New products discovered incidentally here are a bonus, not
    the point — that's discover_all()'s job."""
    by_id: dict[str, dict] = {}
    for category_path in CATEGORY_PATHS:
        url = f"{API_BASE}/{category_path}"
        products = _page_through(client, url, {"O": "OrderByNameASC"}, f"refresh:{category_path}", warm=False)
        for product in products:
            pid = str(product.get("productId") or "")
            if pid:
                by_id[pid] = product
    return list(by_id.values())


def discover_all(client: VTEXClient, limit: int = 0) -> list[dict]:
    """Union of both discovery paths, de-duped by productId — see
    discover_by_brand (primary) and discover_by_category_name_order (safety
    net) docstrings."""
    by_id: dict[str, dict] = {}
    for product in discover_by_brand(client, limit=limit):
        pid = str(product.get("productId") or "")
        if pid:
            by_id[pid] = product
    remaining = (limit - len(by_id)) if limit else 0
    if not limit or remaining > 0:
        for product in discover_by_category_name_order(client, limit=remaining):
            pid = str(product.get("productId") or "")
            if pid:
                by_id[pid] = product
    return list(by_id.values())


# ─────────────────────────────────────────────────────────────
#  Cache purge (identical pattern to ml_crawler.py / main.py)
# ─────────────────────────────────────────────────────────────
def notify_revalidate(since_iso: str) -> None:
    from revalidate_tags import observed_artist_names, observed_disco_tags, post_purge

    url = os.environ.get("REVALIDATE_URL")
    secret = os.environ.get("REVALIDATE_SECRET")
    if not url or not secret:
        log.warning("REVALIDATE_URL/SECRET not set — skipping cache purge")
        return

    try:
        conn = get_connection()
        try:
            tags = observed_disco_tags(conn, since_iso)
            artists = observed_artist_names(conn, since_iso)
        finally:
            conn.close()
    except Exception as exc:
        log.warning("Per-entity tag lookup failed (non-fatal): %s", exc)
        return

    sent = post_purge(url, secret, tags=tags, artist_names=artists)
    log.info("Revalidation: purged %d entities (%d records, %d artists)",
             sent, len(tags), len(artists))

    try:
        resp = cffi_requests.post(url, json={"secret": secret, "tag": "deals"}, timeout=10)
        if resp.status_code != 200:
            log.warning("Deal-surface purge — HTTP %s: %s", resp.status_code, resp.text[:120])
    except Exception as exc:
        log.warning("Deal-surface purge failed (non-fatal): %s", exc)


# ─────────────────────────────────────────────────────────────
#  Storage — upsert into the shared Disco / HistoricoPreco tables
# ─────────────────────────────────────────────────────────────
def upsert_umusicstore(conn, rows: list[Row], captured_at: datetime, sync_drop: bool = True) -> tuple[int, int]:
    """Upsert every parsed row into Disco (marketplace='umusicstore'); append a
    HistoricoPreco row for each in-stock, priced row. Sync-driven: umusicstore
    Disco rows whose product id is no longer in this crawl are marked
    disponivel=false (never hard-deleted) — but only when sync_drop=True.
    The lightweight refresh pass (discover_refresh) only sees a fraction of
    the catalog on any one run, so it must NOT sync-drop or it would wrongly
    mark real, in-stock records unavailable; only the full daily sweep does."""
    import psycopg2.extras

    priced = [r for r in rows if r.disponivel and r.price is not None]

    with conn.cursor() as cur:
        disco_rows = [
            (
                r.vtex_id,                      # asin ← VTEX productId
                r.titulo,
                r.artista,
                gerar_slug(r.titulo, r.vtex_id),
                r.estilo,
                r.ean,
                r.img_url,
                r.url,
                r.disponivel,
            )
            for r in rows
        ]
        psycopg2.extras.execute_batch(
            cur,
            """
            INSERT INTO "Disco" (
                id, asin, titulo, artista, slug, estilo, ean, "imgUrl", url,
                disponivel, format, marketplace, "createdAt", "updatedAt", last_crawled_at
            )
            VALUES (
                gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s,
                %s, 'vinyl', 'umusicstore', NOW(), NOW(), NOW()
            )
            ON CONFLICT (asin) DO UPDATE SET
                titulo          = EXCLUDED.titulo,
                artista         = CASE
                                      WHEN "Disco".artista IS DISTINCT FROM 'Artista não identificado'
                                      THEN "Disco".artista
                                      ELSE EXCLUDED.artista
                                  END,
                estilo          = COALESCE(EXCLUDED.estilo, "Disco".estilo),
                ean             = COALESCE(EXCLUDED.ean, "Disco".ean),
                "imgUrl"        = COALESCE(EXCLUDED."imgUrl", "Disco"."imgUrl"),
                url             = EXCLUDED.url,
                disponivel      = EXCLUDED.disponivel,
                "updatedAt"     = NOW(),
                last_crawled_at = NOW()
            """,
            disco_rows,
            page_size=500,
        )

        vtex_ids = [r.vtex_id for r in rows]
        cur.execute('SELECT asin, id FROM "Disco" WHERE asin = ANY(%s)', (vtex_ids,))
        id_map = {row[0]: row[1] for row in cur.fetchall()}

        preco_rows = [
            (str(id_map[r.vtex_id]), r.price, captured_at)
            for r in priced if r.vtex_id in id_map
        ]
        psycopg2.extras.execute_batch(
            cur,
            """
            WITH ins AS (
                INSERT INTO "HistoricoPreco" (id, "discoId", "precoBrl", "capturadoEm")
                VALUES (gen_random_uuid(), %s, %s, %s)
                RETURNING "discoId"
            )
            UPDATE "Disco" SET price_count = price_count + 1
            WHERE id IN (SELECT "discoId" FROM ins)
            """,
            preco_rows,
            page_size=500,
        )

        dropped = 0
        if sync_drop:
            cur.execute(
                """
                UPDATE "Disco" SET disponivel = FALSE, "updatedAt" = NOW()
                WHERE marketplace = 'umusicstore'
                  AND asin <> ALL(%s)
                  AND disponivel = TRUE
                """,
                (vtex_ids or ["__none__"],),
            )
            dropped = cur.rowcount

    conn.commit()
    if dropped:
        log.info("Sync: marked %d umusicstore row(s) unavailable (dropped from this crawl).", dropped)
    return len(disco_rows), len(preco_rows)


# ─────────────────────────────────────────────────────────────
#  Run summary
# ─────────────────────────────────────────────────────────────
def print_summary(rows: list[Row]) -> None:
    disponivel = [r for r in rows if r.disponivel]
    indisponivel = [r for r in rows if not r.disponivel]
    unknown = sum(1 for r in rows if r.artista == UNKNOWN_ARTIST)
    no_ean = sum(1 for r in rows if not r.ean)
    log.info("═" * 60)
    log.info("SUMMARY  total=%d  disponivel=%d  indisponivel=%d  (unknown-artist=%d, no-ean=%d)",
              len(rows), len(disponivel), len(indisponivel), unknown, no_ean)
    log.info("═" * 60)


# ─────────────────────────────────────────────────────────────
#  Entrypoint
# ─────────────────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(description="umusicstore.com (VTEX) vinyl crawler → Disco")
    ap.add_argument("--dry-run", action="store_true", help="crawl but don't write to DB")
    ap.add_argument("--limit", type=int, default=0, help="only process first N products (0 = all)")
    ap.add_argument("--refresh-only", action="store_true",
                     help="lightweight price/availability pass (single-fetch, ASC-only category listing, "
                          "no brand sweep, no sync-drop) for the frequent intraday runs; "
                          "run without this flag once daily for full discovery + sync-drop")
    args = ap.parse_args()

    client = VTEXClient()
    if args.refresh_only:
        log.info("Refresh-only pass: account=%s categories=%s", VTEX_ACCOUNT, ", ".join(CATEGORY_PATHS))
        raw_products = discover_refresh(client)
    else:
        log.info("Discovering catalog: account=%s categories=%s", VTEX_ACCOUNT, ", ".join(CATEGORY_PATHS))
        raw_products = discover_all(client, limit=args.limit)
    log.info("Discovered %d raw product(s) from VTEX.", len(raw_products))
    if args.limit:
        raw_products = raw_products[:args.limit]

    rows: list[Row] = []
    for p in raw_products:
        row = parse_product(p)
        if row is None:
            continue
        rows.append(row)
        log.info("[%s] %s  %s — %s%s",
                  row.vtex_id,
                  f"R$ {row.price:.2f}" if row.price is not None else "—",
                  row.artista[:25], row.titulo[:40],
                  "" if row.disponivel else "  (indisponível)")

    print_summary(rows)

    if args.dry_run:
        log.info("DRY-RUN — no database writes")
        return 0

    if not rows:
        log.warning("No rows parsed — skipping DB write.")
        return 1

    captured_at = datetime.now(timezone.utc)
    conn = get_connection()
    try:
        ensure_ean_column(conn)
        d, p = upsert_umusicstore(conn, rows, captured_at, sync_drop=not args.refresh_only)
        log.info("DB write complete — %d Disco upserts, %d price rows.", d, p)
    finally:
        conn.close()
    notify_revalidate(captured_at.isoformat())
    return 0


if __name__ == "__main__":
    sys.exit(main())
