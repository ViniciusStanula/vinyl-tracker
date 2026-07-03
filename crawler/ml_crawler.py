"""
ml_crawler.py — Mercado Livre Brazil vinyl price crawler → main Disco catalog
──────────────────────────────────────────────────────────────────────────────
Reads a curated list of Mercado Livre vinyl products from crawler/ml_products.csv
and upserts them into the SAME "Disco" / "HistoricoPreco" tables the Amazon
crawler uses, tagged marketplace='mercadolivre'. This lets ML records reuse the
whole enrichment + frontend stack (artist pages, genre pages, price history)
exactly like Amazon records.

Amazon-only crawler jobs are fenced by `marketplace = 'amazon'` (see
fetch_stale_records / fetch_active_deals / format_sweep / purge_primevideo), so
ML rows are never scraped against amazon.com.br/dp/{asin}.

Why the official API (not HTML scraping): ML serves a JS-shell to non-browser
requests (no price in HTML); headless Playwright gets IP-rate-limited after a
few hits. The official catalog API returns price + name + image as JSON.

The CSV is the source of truth for the ML product list:
    • add a row  → new record enters the catalog next run
    • edit a link→ display URL / price-check id updates next run
    • remove a row → that record is marked disponivel=false (never hard-deleted)

Per row, two URLs stay deliberately separate:
    • price-check id — the ORIGINAL product page's MLB id (/p/MLB…); queried on the API
    • url (display)  — affiliate link (meli.la/…) when present, else the original link

Usage:
    python ml_crawler.py                 # sync all rows into Disco
    python ml_crawler.py --dry-run       # crawl but don't write to DB
    python ml_crawler.py --limit 5       # only first 5 rows (smoke test)

Environment (crawler/.env):
    ML_CLIENT_ID, ML_CLIENT_SECRET   — Mercado Livre app credentials
    DATABASE_URL                     — Supabase Postgres (shared with Amazon crawler)
"""
import os
import re
import csv
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
from database import get_connection
from utils import gerar_slug
from domain import UNKNOWN_ARTIST, normalize_artist, _is_plausible_artist

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────
CSV_PATH = os.environ.get(
    "ML_CSV_PATH",
    os.path.join(os.path.dirname(__file__), "ml_products.csv"),
)
API_BASE = "https://api.mercadolibre.com"
CLIENT_ID = os.environ.get("ML_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("ML_CLIENT_SECRET", "")

DELAY_RANGE = (0.5, 1.5)   # jittered pause between products; API is tolerant
MAX_ATTEMPTS = 3

_MLB_RE = re.compile(r"/(MLB-?\d+)", re.IGNORECASE)

# ─────────────────────────────────────────────────────────────
#  Logging  (mirror main.py: stdout + file)
# ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            os.path.join(os.path.dirname(__file__), "ml_crawler.log"),
            encoding="utf-8",
        ),
    ],
)
log = logging.getLogger("ml_crawler")


# ─────────────────────────────────────────────────────────────
#  CSV reader  (source of truth for the ML product list)
# ─────────────────────────────────────────────────────────────
@dataclass
class Row:
    mlb_id: str
    display_url: str              # affiliate if present, else original — stored as Disco.url
    price_check_url: str          # ORIGINAL product page — its MLB id is queried
    # Filled during the run:
    titulo: str = ""
    artista: str = UNKNOWN_ARTIST
    estilo: str | None = None
    img_url: str | None = None
    price: float | None = None
    status: str = "pending"       # ok | no_offers | not_found | error
    detail: str = ""


def read_csv(path: str) -> list[Row]:
    """Parse ml_products.csv → Row list. Columns: url_original, titulo, url_afiliado.
    display_url falls back to the original link when the affiliate cell is empty."""
    rows: list[Row] = []
    with open(path, encoding="utf-8", newline="") as f:
        for rec in csv.DictReader(f):
            original = (rec.get("url_original") or "").strip()
            afiliado = (rec.get("url_afiliado") or "").strip()
            if not original:
                continue
            m = _MLB_RE.search(original)
            if not m:
                log.warning("No MLB id in URL, skipping: %s", original[:80])
                continue
            rows.append(Row(
                mlb_id=m.group(1).upper().replace("-", ""),
                display_url=afiliado or original,   # ← fallback rule
                price_check_url=original,
            ))
    return rows


# ─────────────────────────────────────────────────────────────
#  Artist derivation from the catalog title
# ─────────────────────────────────────────────────────────────
_TITLE_NOISE_RE = re.compile(
    r"^[\s\-]*"                                  # leading dashes/space
    r"(box\s?set\s+)?"                           # optional "Boxset"
    r"(vinil|lp|disco de vinil|cd)\b[\s:\-]*",   # format word + separators
    re.IGNORECASE,
)


def derive_artist(title: str) -> str:
    """Best-effort artist from an ML vinyl title like
    'Vinil Engenheiros Do Hawaii - Tchau Radar! ...' → 'Engenheiros Do Hawaii'.
    Enrichment / the unknown-artist re-attribution pipeline corrects the rest."""
    if not title:
        return UNKNOWN_ARTIST
    t = _TITLE_NOISE_RE.sub("", title).strip()
    cand = t.split(" - ", 1)[0].strip() if " - " in t else ""
    # Trailing qualifiers sellers tack on before the dash are rare; a length
    # cap + plausibility check keeps obvious junk out.
    cand = normalize_artist(cand)
    if cand and len(cand) <= 60 and _is_plausible_artist(cand):
        return cand
    return UNKNOWN_ARTIST


# ─────────────────────────────────────────────────────────────
#  Mercado Livre API client
# ─────────────────────────────────────────────────────────────
class MLClient:
    """client_credentials client with token caching + light retry/backoff."""

    def __init__(self, client_id: str, client_secret: str):
        if not client_id or not client_secret:
            raise RuntimeError("ML_CLIENT_ID / ML_CLIENT_SECRET not set (see crawler/.env).")
        self._id = client_id
        self._secret = client_secret
        self._session = cffi_requests.Session(impersonate="chrome124")
        self._token: str | None = None
        self._token_exp: float = 0.0

    def _ensure_token(self) -> str:
        if self._token and time.monotonic() < self._token_exp - 60:
            return self._token
        resp = self._session.post(
            f"{API_BASE}/oauth/token",
            data={"grant_type": "client_credentials",
                  "client_id": self._id, "client_secret": self._secret},
            headers={"Accept": "application/json"}, timeout=30,
        )
        resp.raise_for_status()
        j = resp.json()
        self._token = j["access_token"]
        self._token_exp = time.monotonic() + int(j.get("expires_in", 21600))
        log.info("Obtained ML access token (expires in %ss).", j.get("expires_in"))
        return self._token

    def get(self, path: str):
        """GET an API path → (status_code, json_or_none). Retries transient errors;
        429 = hard rate-limit (back off), 401 = force token refresh."""
        for attempt in range(1, MAX_ATTEMPTS + 1):
            token = self._ensure_token()
            try:
                resp = self._session.get(
                    f"{API_BASE}{path}",
                    headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
                    timeout=30,
                )
            except Exception as exc:
                log.warning("Request error %s (attempt %d/%d): %s", path, attempt, MAX_ATTEMPTS, exc)
                if attempt < MAX_ATTEMPTS:
                    time.sleep((2 ** attempt) / 2 + random.uniform(0, (2 ** attempt) / 2))
                    continue
                return None, None

            if resp.status_code == 429:
                wait = float(resp.headers.get("Retry-After", "0") or 0) or (2 ** attempt)
                log.warning("429 rate-limited on %s — sleeping %.0fs", path, wait)
                time.sleep(wait)
                continue
            if resp.status_code == 401:
                self._token = None
                continue
            try:
                return resp.status_code, resp.json()
            except Exception:
                return resp.status_code, None
        return None, None


def notify_revalidate() -> None:
    """Purge the Next.js 'prices' cache tag so updated ML prices show immediately
    instead of waiting on the ISR TTL. Same webhook contract as the Amazon crawler
    (main.py _notify_revalidate). Non-fatal: a purge failure never fails the run."""
    url = os.environ.get("REVALIDATE_URL")
    secret = os.environ.get("REVALIDATE_SECRET")
    if not url or not secret:
        log.warning("REVALIDATE_URL/SECRET not set — skipping cache purge")
        return
    for attempt, backoff in enumerate((5, 15, 0), 1):
        try:
            resp = cffi_requests.post(url, json={"secret": secret, "tag": "prices"}, timeout=10)
            if resp.status_code == 200:
                log.info("Revalidation: HTTP 200 (attempt %d) — 'prices' cache purged", attempt)
                return
            log.warning("Revalidation attempt %d — HTTP %s: %s", attempt, resp.status_code, resp.text[:120])
        except Exception as exc:
            log.warning("Revalidation attempt %d failed — %s", attempt, exc)
        if backoff:
            time.sleep(backoff)
    log.warning("Revalidation failed after retries — ML prices will refresh on the ISR TTL.")


def _best_price(items: list[dict]) -> float | None:
    """Buy-box = lowest current offer price (what ML surfaces on the product page)."""
    priced = [it["price"] for it in items if isinstance(it.get("price"), (int, float))]
    return float(min(priced)) if priced else None


def fetch_row(client: MLClient, row: Row) -> None:
    """Populate `row` with catalog metadata (clean title, cover image, genre,
    derived artist) and the best offer price."""
    # 1) Catalog product → clean name, image, genre, 404 signal.
    pstatus, product = client.get(f"/products/{row.mlb_id}")
    if pstatus == 404:
        row.status, row.detail = "not_found", "catalog product not found (removed)"
        log.warning("[%s] not found", row.mlb_id)
        return
    if pstatus == 200 and isinstance(product, dict):
        name = (product.get("name") or "").strip()
        if name:
            row.titulo = name
            row.artista = derive_artist(name)
        pics = product.get("pictures") or []
        if pics and pics[0].get("url"):
            row.img_url = pics[0]["url"]
        attrs = {a.get("id"): a.get("value_name") for a in (product.get("attributes") or [])}
        row.estilo = (attrs.get("GENRE") or "").strip() or None

    if not row.titulo:
        # No catalog metadata at all — cannot build a Disco row safely.
        row.status, row.detail = "error", f"no product metadata (status {pstatus})"
        log.warning("[%s] no metadata status=%s", row.mlb_id, pstatus)
        return

    # 2) Seller offers → buy-box price.
    status, body = client.get(f"/products/{row.mlb_id}/items")
    if status != 200 or not isinstance(body, dict):
        row.status, row.detail = "error", f"items API status {status}"
        log.warning("[%s] items error status=%s", row.mlb_id, status)
        return

    price = _best_price(body.get("results") or [])
    if price is None:
        row.status, row.detail = "no_offers", "no active offers (out of stock)"
        log.warning("[%s] no offers — %s", row.mlb_id, row.titulo[:45])
        return

    row.price, row.status = price, "ok"
    log.info("[%s] R$ %.2f  %s — %s", row.mlb_id, price, row.artista[:25], row.titulo[:40])


# ─────────────────────────────────────────────────────────────
#  Storage — upsert into the shared Disco / HistoricoPreco tables
# ─────────────────────────────────────────────────────────────
def upsert_ml(conn, rows: list[Row], captured_at: datetime) -> tuple[int, int]:
    """Upsert every attempted ML row into Disco (marketplace='mercadolivre');
    append a HistoricoPreco row for each with a price. Sync-driven: ML Disco rows
    whose MLB id is no longer in the CSV are marked disponivel=false.
    Returns (disco_upserts, price_rows)."""
    import psycopg2.extras

    have_meta = [r for r in rows if r.titulo]   # rows we can build/refresh a Disco row for
    priced = [r for r in rows if r.status == "ok" and r.price is not None]

    with conn.cursor() as cur:
        # ── Disco upsert ──────────────────────────────────────────────────
        disco_rows = [
            (
                r.mlb_id,                       # asin ← MLB id
                r.titulo,
                r.artista,
                gerar_slug(r.titulo, r.mlb_id),
                r.estilo,
                r.img_url,
                r.display_url,                  # url ← affiliate (fallback original)
                (r.status == "ok"),             # disponivel
            )
            for r in have_meta
        ]
        psycopg2.extras.execute_batch(
            cur,
            """
            INSERT INTO "Disco" (
                id, asin, titulo, artista, slug, estilo, "imgUrl", url,
                disponivel, format, marketplace, "createdAt", "updatedAt", last_crawled_at
            )
            VALUES (
                gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s,
                %s, 'vinyl', 'mercadolivre', NOW(), NOW(), NOW()
            )
            ON CONFLICT (asin) DO UPDATE SET
                titulo          = EXCLUDED.titulo,
                artista         = CASE
                                      WHEN "Disco".artista IS DISTINCT FROM 'Artista não identificado'
                                      THEN "Disco".artista
                                      ELSE EXCLUDED.artista
                                  END,
                estilo          = COALESCE(EXCLUDED.estilo, "Disco".estilo),
                "imgUrl"        = COALESCE(EXCLUDED."imgUrl", "Disco"."imgUrl"),
                url             = EXCLUDED.url,
                disponivel      = EXCLUDED.disponivel,
                "updatedAt"     = NOW(),
                last_crawled_at = NOW()
            """,
            disco_rows,
            page_size=500,
        )

        # ── asin → id map ─────────────────────────────────────────────────
        mlb_ids = [r.mlb_id for r in have_meta]
        cur.execute('SELECT asin, id FROM "Disco" WHERE asin = ANY(%s)', (mlb_ids,))
        id_map = {row[0]: row[1] for row in cur.fetchall()}

        # ── HistoricoPreco append (authoritative API price; no deal guard) ─
        preco_rows = [
            (str(id_map[r.mlb_id]), r.price, captured_at)
            for r in priced if r.mlb_id in id_map
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

        # ── Sync: ML rows dropped from the CSV → mark unavailable ──────────
        cur.execute(
            """
            UPDATE "Disco" SET disponivel = FALSE, "updatedAt" = NOW()
            WHERE marketplace = 'mercadolivre'
              AND asin <> ALL(%s)
              AND disponivel = TRUE
            """,
            (mlb_ids or ["__none__"],),
        )
        dropped = cur.rowcount

    conn.commit()
    if dropped:
        log.info("Sync: marked %d ML row(s) unavailable (removed from CSV).", dropped)
    return len(disco_rows), len(preco_rows)


# ─────────────────────────────────────────────────────────────
#  Run summary
# ─────────────────────────────────────────────────────────────
def print_summary(rows: list[Row]) -> None:
    buckets: dict[str, list[Row]] = {}
    for r in rows:
        buckets.setdefault(r.status, []).append(r)
    unknown = sum(1 for r in rows if r.status == "ok" and r.artista == UNKNOWN_ARTIST)
    log.info("═" * 60)
    log.info("SUMMARY  total=%d  ok=%d  no_offers=%d  not_found=%d  error=%d  (unknown-artist=%d)",
             len(rows), len(buckets.get("ok", [])), len(buckets.get("no_offers", [])),
             len(buckets.get("not_found", [])), len(buckets.get("error", [])), unknown)
    for kind in ("error", "not_found", "no_offers"):
        for r in buckets.get(kind, []):
            log.info("  [%s] %s — %s (%s)", kind.upper(), r.mlb_id, r.titulo[:45], r.detail)
    log.info("═" * 60)


# ─────────────────────────────────────────────────────────────
#  Entrypoint
# ─────────────────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(description="Mercado Livre vinyl crawler → Disco")
    ap.add_argument("--dry-run", action="store_true", help="crawl but don't write to DB")
    ap.add_argument("--limit", type=int, default=0, help="only crawl first N rows (0 = all)")
    args = ap.parse_args()

    if not os.path.exists(CSV_PATH):
        log.error("CSV not found: %s", CSV_PATH)
        return 1

    rows = read_csv(CSV_PATH)
    if args.limit:
        rows = rows[:args.limit]
    log.info("Loaded %d ML rows from %s", len(rows), os.path.basename(CSV_PATH))
    if args.dry_run:
        log.info("DRY-RUN — no database writes")

    client = MLClient(CLIENT_ID, CLIENT_SECRET)
    captured_at = datetime.now(timezone.utc)

    for i, row in enumerate(rows, 1):
        log.info("(%d/%d) %s", i, len(rows), row.mlb_id)
        fetch_row(client, row)
        if i < len(rows):
            time.sleep(random.uniform(*DELAY_RANGE))

    print_summary(rows)

    if not args.dry_run:
        if not any(r.titulo for r in rows):
            log.warning("No metadata captured — skipping DB write.")
        else:
            conn = get_connection()
            try:
                d, p = upsert_ml(conn, rows, captured_at)
                log.info("DB write complete — %d Disco upserts, %d price rows.", d, p)
            finally:
                conn.close()
            notify_revalidate()   # purge 'prices' cache so new ML prices show immediately

    errors = sum(1 for r in rows if r.status == "error")
    return 2 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
