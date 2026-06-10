"""
shadow.py — Creators API vs scraper parity comparison (Step B1)
───────────────────────────────────────────────────────────────────────────
Runs the API and the stealth scraper over the SAME ASIN set near-simultaneously,
writes NOTHING to product tables, and persists every comparison to shadow_diffs
(durable Postgres) so the parity verdict survives the runner.

On disagreement the pair is re-fetched once: if they converge it was timing skew
(benign); if it persists it is a real diff and the full offer detail is stored.
The scraper is NOT assumed to be ground truth — an API-correct / scraper-wrong
result is a migration win and is surfaced as such.

PARITY VERDICT (gates the Phase-0/3 cut):
  - coarse availability agreement >= 99%
  - price-within-tolerance (larger of R$1 or 2%) >= 95% among co-purchasable rows
  - every beyond-tolerance gap individually explained (converged on recheck)
  Any unexplained persisted residue => FAIL.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

log = logging.getLogger(__name__)

# Price tolerance: the larger of R$1.00 or 2% of the scraper price.
TOL_ABS_BRL = 1.0
TOL_PCT = 0.02
# Verdict thresholds.
AVAIL_AGREE_MIN = 0.99
PRICE_TOL_MIN = 0.95

_DDL = """
CREATE TABLE IF NOT EXISTS shadow_diffs (
    id            BIGSERIAL PRIMARY KEY,
    run_id        TEXT        NOT NULL,
    asin          TEXT        NOT NULL,
    checked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    api_price     DOUBLE PRECISION,
    api_currency  TEXT,
    api_in_stock  BOOLEAN,
    api_avail_type TEXT,
    scr_price     DOUBLE PRECISION,
    scr_in_stock  BOOLEAN,
    price_delta_abs DOUBLE PRECISION,
    price_delta_pct DOUBLE PRECISION,
    within_tol    BOOLEAN,
    avail_agree   BOOLEAN,
    co_purchasable BOOLEAN,
    verdict       TEXT,            -- agree | converged | persisted
    rechecked     BOOLEAN NOT NULL DEFAULT FALSE,
    detail        JSONB
);
CREATE INDEX IF NOT EXISTS shadow_diffs_run_idx ON shadow_diffs (run_id);
"""


def ensure_shadow_table(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(_DDL)
    conn.commit()
    log.info("ensure_shadow_table: shadow_diffs ready.")


def within_tolerance(api_price: float | None, scr_price: float | None) -> bool | None:
    """True/False when both prices exist; None when not co-purchasable."""
    if api_price is None or scr_price is None:
        return None
    tol = max(TOL_ABS_BRL, TOL_PCT * scr_price)
    return abs(api_price - scr_price) <= tol


def _avail_agree(api_in_stock: bool | None, scr_in_stock: bool | None) -> bool | None:
    if api_in_stock is None or scr_in_stock is None:
        return None
    return api_in_stock == scr_in_stock


def compare(api_res, scr_price: float | None, scr_in_stock: bool | None) -> dict:
    """Build a comparison dict from an API ItemResult + scraper price/stock."""
    api_price = getattr(api_res, "price", None) if api_res else None
    api_currency = getattr(api_res, "currency", None) if api_res else None
    api_in_stock = getattr(api_res, "in_stock", None) if api_res else None
    api_avail = getattr(api_res, "availability_type", None) if api_res else None

    delta_abs = delta_pct = None
    if api_price is not None and scr_price is not None:
        delta_abs = abs(api_price - scr_price)
        delta_pct = (delta_abs / scr_price * 100) if scr_price else None

    wt = within_tolerance(api_price, scr_price)
    aa = _avail_agree(api_in_stock, scr_in_stock)
    co_purchasable = api_price is not None and scr_price is not None

    # Disagreement = availability mismatch, or co-purchasable but beyond tolerance.
    disagree = (aa is False) or (co_purchasable and wt is False)

    return {
        "api_price": api_price, "api_currency": api_currency,
        "api_in_stock": api_in_stock, "api_avail_type": api_avail,
        "scr_price": scr_price, "scr_in_stock": scr_in_stock,
        "price_delta_abs": delta_abs, "price_delta_pct": delta_pct,
        "within_tol": wt, "avail_agree": aa, "co_purchasable": co_purchasable,
        "disagree": disagree,
    }


def persist_diff(conn, run_id: str, asin: str, cmp: dict, verdict: str,
                 rechecked: bool, detail: dict | None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO shadow_diffs (
                run_id, asin, checked_at, api_price, api_currency, api_in_stock,
                api_avail_type, scr_price, scr_in_stock, price_delta_abs,
                price_delta_pct, within_tol, avail_agree, co_purchasable,
                verdict, rechecked, detail
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                run_id, asin, datetime.now(timezone.utc),
                cmp["api_price"], cmp["api_currency"], cmp["api_in_stock"],
                cmp["api_avail_type"], cmp["scr_price"], cmp["scr_in_stock"],
                cmp["price_delta_abs"], cmp["price_delta_pct"], cmp["within_tol"],
                cmp["avail_agree"], cmp["co_purchasable"], verdict, rechecked,
                json.dumps(detail) if detail else None,
            ),
        )
    conn.commit()


def parity_verdict(conn, run_id: str) -> dict:
    """Compute PASS/FAIL from this run's shadow_diffs rows."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                count(*)                                              AS n,
                count(*) FILTER (WHERE avail_agree IS NOT NULL)       AS avail_n,
                count(*) FILTER (WHERE avail_agree IS TRUE)           AS avail_ok,
                count(*) FILTER (WHERE co_purchasable)                AS copur_n,
                count(*) FILTER (WHERE within_tol IS TRUE)            AS tol_ok,
                count(*) FILTER (WHERE verdict = 'persisted'
                                 AND (within_tol IS FALSE OR avail_agree IS FALSE)) AS unexplained
            FROM shadow_diffs
            WHERE run_id = %s
            """,
            (run_id,),
        )
        n, avail_n, avail_ok, copur_n, tol_ok, unexplained = cur.fetchone()

    avail_rate = (avail_ok / avail_n) if avail_n else 1.0
    price_rate = (tol_ok / copur_n) if copur_n else 1.0
    passed = (
        avail_rate >= AVAIL_AGREE_MIN
        and price_rate >= PRICE_TOL_MIN
        and unexplained == 0
    )
    return {
        "run_id": run_id, "records": n,
        "avail_n": avail_n, "avail_ok": avail_ok, "avail_rate": round(avail_rate, 4),
        "copurchasable": copur_n, "price_within_tol": tol_ok,
        "price_rate": round(price_rate, 4),
        "unexplained_residue": unexplained,
        "thresholds": {"avail_min": AVAIL_AGREE_MIN, "price_min": PRICE_TOL_MIN},
        "PASS": bool(passed),
    }


__all__ = [
    "ensure_shadow_table", "compare", "within_tolerance", "persist_diff",
    "parity_verdict", "TOL_ABS_BRL", "TOL_PCT",
]
