"""
shadow_run.py — run Creators-API-vs-scraper shadow parity (Step B1)
───────────────────────────────────────────────────────────────────────────
Isolated runner. Writes ONLY to shadow_diffs — never to Disco/HistoricoPreco.
Compares the API and the stealth scraper over the active Phase-0 deal set
(or a stale-record sample), persists every comparison, prints the parity verdict.

Usage:
  python shadow_run.py                 # all active deals
  python shadow_run.py --limit 200     # cap the set
  python shadow_run.py --from-stale 200  # sample stale records if few deals
"""
from __future__ import annotations

import sys
import json
import time
import random
import logging
import argparse

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-7s  %(message)s")
log = logging.getLogger("shadow")

from preflight import load_dotenv_if_present, check_env
load_dotenv_if_present()

from database import get_connection, fetch_active_deals, fetch_stale_records
from creators_api import CreatorsConfig, CreatorsClient
from metrics import RUN_ID
import shadow as S
# Scraper primitives reused from the crawler (importing main is side-effect free
# beyond config/regex setup; main() is not invoked).
from main import (
    make_session, warm_up, _quick_warmup, get_proxy_pool,
    fetch_product_page, parse_product_page, affiliate_link,
)


def _chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def _scraper_fetch(session, proxy, asin):
    """Return (price, in_stock, session, proxy). (None, None) on bot/transient."""
    url = affiliate_link(asin)
    soup, status, session, proxy = fetch_product_page(session, url, proxy=proxy)
    if soup is None:
        return None, None, session, proxy, status
    price, in_stock, _reviews = parse_product_page(soup)
    return price, in_stock, session, proxy, status


def run(limit: int, from_stale: int, delay: float) -> int:
    check_env(require_creators=True)
    conn = get_connection()
    S.ensure_shadow_table(conn)

    deals = fetch_active_deals(conn)
    if from_stale and len(deals) < from_stale:
        extra = fetch_stale_records(conn, seen_asins=set(), limit=from_stale)
        seen = {d["asin"] for d in deals}
        deals += [r for r in extra if r["asin"] not in seen]
    if limit:
        deals = deals[:limit]
    asins = [d["asin"] for d in deals]
    if not asins:
        log.warning("No active deals (and no stale sample requested) — nothing to compare.")
        return 0

    log.info("Shadow run %s — comparing %d ASIN(s). Writing only to shadow_diffs.",
             RUN_ID, len(asins))

    cfg = CreatorsConfig.from_env()
    api = CreatorsClient(cfg)

    proxy = get_proxy_pool().acquire()
    session, _ = make_session(proxy=proxy)
    warm_up(session)

    agree = converged = persisted = no_scraper_data = 0

    for chunk in _chunks(asins, 10):
        api_map = {r.asin: r for r in api.get_items(chunk)}
        for asin in chunk:
            api_res = api_map.get(asin)
            scr_price, scr_in_stock, session, proxy, status = _scraper_fetch(session, proxy, asin)
            if scr_price is None and scr_in_stock is None and status is None:
                # Scraper hit bot-detection — rotate once and retry.
                proxy = get_proxy_pool().acquire()
                session, _ = make_session(proxy=proxy)
                _quick_warmup(session)
                scr_price, scr_in_stock, session, proxy, status = _scraper_fetch(session, proxy, asin)

            cmp = S.compare(api_res, scr_price, scr_in_stock)

            if not cmp["disagree"]:
                S.persist_diff(conn, RUN_ID, asin, cmp, verdict="agree",
                               rechecked=False, detail=None)
                agree += 1
            else:
                # Re-fetch both once; convergence => benign timing skew.
                time.sleep(random.uniform(1.0, 2.5))
                api2 = {r.asin: r for r in api.get_items([asin])}.get(asin)
                scr_price2, scr_in_stock2, session, proxy, _st = _scraper_fetch(session, proxy, asin)
                cmp2 = S.compare(api2, scr_price2, scr_in_stock2)
                if not cmp2["disagree"]:
                    S.persist_diff(conn, RUN_ID, asin, cmp2, verdict="converged",
                                   rechecked=True, detail=None)
                    converged += 1
                else:
                    detail = {
                        "api_raw": getattr(api2, "raw", None),
                        "scr_price": scr_price2, "scr_in_stock": scr_in_stock2,
                        "first_pass": {k: cmp[k] for k in
                                       ("api_price", "scr_price", "api_in_stock", "scr_in_stock")},
                    }
                    S.persist_diff(conn, RUN_ID, asin, cmp2, verdict="persisted",
                                   rechecked=True, detail=detail)
                    persisted += 1
                    log.warning(
                        "[persisted-diff] %s api_price=%s scr_price=%s "
                        "api_stock=%s scr_stock=%s",
                        asin, cmp2["api_price"], cmp2["scr_price"],
                        cmp2["api_in_stock"], cmp2["scr_in_stock"],
                    )
            if cmp["scr_price"] is None and cmp["scr_in_stock"] is None:
                no_scraper_data += 1
            time.sleep(delay + random.uniform(0.3, 1.0))

    log.info("Shadow done — agree=%d converged=%d persisted=%d no_scraper_data=%d",
             agree, converged, persisted, no_scraper_data)

    verdict = S.parity_verdict(conn, RUN_ID)
    print("\n=== PARITY VERDICT ===")
    print(json.dumps(verdict, indent=2))
    print("\nRESULT:", "PASS — safe to cut Phase 0/3 to API"
          if verdict["PASS"] else "FAIL — do NOT cut; inspect persisted diffs")
    get_proxy_pool().log_stats()
    conn.close()
    return 0 if verdict["PASS"] else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="Creators-API-vs-scraper shadow parity (no product writes).")
    ap.add_argument("--limit", type=int, default=0, help="Cap the number of ASINs compared.")
    ap.add_argument("--from-stale", type=int, default=0,
                    help="If active deals < N, top up the set with stale records.")
    ap.add_argument("--delay", type=float, default=1.5, help="Base delay between scraper hits.")
    args = ap.parse_args()
    return run(args.limit, args.from_stale, args.delay)


if __name__ == "__main__":
    sys.exit(main())
