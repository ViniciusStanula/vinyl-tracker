"""
creators_api_smoke.py — manual test harness for creators_api.py
───────────────────────────────────────────────────────────────────────────
NO DATABASE. Exercises the Creators API client against LIVE credentials and
prints exactly the facts the Phase-2 report needs:
  (a) field coverage — raw OffersV2 JSON per ASIN + parsed price/avail/Prime,
      and whether review_count appears anywhere.
  (b) observed rate-limit behavior — TPS throttling + daily-budget decrement,
      plus any rate-limit headers the API returns.
  (c) token lifecycle — minted expires_in + refresh-on-401 behavior.

Credentials come from env only (CREATORS_CLIENT_ID / CREATORS_CLIENT_SECRET,
ASSOCIATE_TAG, CREATORS_TPS, CREATORS_TPD, …). Hardcodes nothing.

Usage:
  # Offline checks (no creds, no network): rate limiter + token cache logic
  python creators_api_smoke.py --offline

  # Live run (needs creds in env): real getItems against your ASINs
  python creators_api_smoke.py --asins B0XXXXXXXX,B0YYYYYYYY --raw
  python creators_api_smoke.py --asins B0XXXXXXXX --burst 8   # exercise limiter
"""
from __future__ import annotations

import os
import sys
import json
import time
import logging
import argparse

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-7s  %(message)s")
log = logging.getLogger("smoke")

from creators_api import (
    CreatorsConfig, CreatorsClient, RateLimiter, TokenManager, BudgetExhausted,
    _TokenBucket, _DailyBudget,
)


# ─────────────────────────────────────────────────────────────
#  Offline checks — no credentials, no network
# ─────────────────────────────────────────────────────────────
def run_offline() -> int:
    print("\n=== OFFLINE: rate limiter + token-cache logic (no network) ===\n")
    ok = True

    # TPS bucket: fire 6 acquires at 2 TPS, expect ~2.5s for the last 5.
    tps = 2.0
    bucket = _TokenBucket(tps)
    t0 = time.monotonic()
    waits = [bucket.acquire() for _ in range(6)]
    elapsed = time.monotonic() - t0
    # 6 requests at 2 TPS, capacity≈2 -> ~ (6-2)/2 = 2.0s minimum of waiting.
    print(f"TPS bucket: 6 acquires @ {tps} TPS took {elapsed:.2f}s "
          f"(per-acquire waits: {[round(w,2) for w in waits]})")
    if elapsed < 1.5:
        print("  !! expected throttling (≥~2s); bucket may not be pacing"); ok = False
    else:
        print("  OK — bucket paced requests instead of bursting")

    # Daily budget: limit 3 -> 4th consume raises BudgetExhausted.
    budget = _DailyBudget(3)
    consumed = 0
    try:
        for _ in range(5):
            budget.consume(); consumed += 1
    except BudgetExhausted:
        pass
    print(f"\nDaily budget: limit=3, consumed before exhaustion={consumed}, "
          f"remaining={budget.remaining()}")
    if consumed != 3 or budget.remaining() != 0:
        print("  !! budget accounting wrong"); ok = False
    else:
        print("  OK — budget stops at limit and reports 0 remaining")

    # Token cache: monkeypatch the LWA call, confirm 2nd get_token() is cached
    # and force=True re-mints.
    print("\nToken cache:")
    cfg = _fake_cfg()
    tm = TokenManager(cfg)
    mint_count = {"n": 0}

    def fake_refresh():
        mint_count["n"] += 1
        tm._token = f"tok{mint_count['n']}"
        tm._expires_at = time.monotonic() + 3600
        tm.last_expires_in = 3600
        return tm._token

    tm._refresh_locked = fake_refresh  # type: ignore
    a = tm.get_token()
    b = tm.get_token()            # cached -> no new mint
    mints_after_cached = mint_count["n"]
    c = tm.get_token(force=True)  # forced -> new mint
    print(f"  get_token x2 -> mints={mints_after_cached} (expect 1), tokens {a}=={b}")
    print(f"  get_token(force=True) -> mints={mint_count['n']} (expect 2), new token {c}")
    if not (a == b and mints_after_cached == 1 and mint_count["n"] == 2 and c != a):
        print("  !! token caching/refresh logic wrong"); ok = False
    else:
        print("  OK — token cached until forced refresh")

    print("\n=== OFFLINE RESULT:", "PASS ===" if ok else "FAIL ===")
    return 0 if ok else 1


def _fake_cfg() -> CreatorsConfig:
    return CreatorsConfig(
        client_id="x", client_secret="y", partner_tag="tag-20",
        marketplace="www.amazon.com.br",
        token_url="https://example.invalid/token",
        api_base="https://example.invalid/catalog/v1",
        scope="creatorsapi::default", tps=1.0, tpd=10,
        # Kept in step with CreatorsConfig: tpd_per_run was added to the
        # dataclass without updating this fake, which broke --offline entirely.
        tpd_per_run=10,
        credential_version=None,
    )


# ─────────────────────────────────────────────────────────────
#  Live run — needs creds in env
# ─────────────────────────────────────────────────────────────
def run_live(asins: list[str], show_raw: bool, burst: int) -> int:
    cfg = CreatorsConfig.from_env()
    print("\n=== LIVE Creators API smoke ===")
    print(f"marketplace={cfg.marketplace}  api_base={cfg.api_base}")
    print(f"partner_tag={cfg.partner_tag}  TPS={cfg.tps}  TPD={cfg.tpd}  "
          f"credential_version={cfg.credential_version or '(v3.x / none)'}")
    print(f"resources={cfg.resources}\n")

    client = CreatorsClient(cfg)

    # (c) token lifecycle — mint once, report expires_in.
    print("--- token lifecycle ---")
    client.tokens.get_token()
    print(f"minted token; expires_in={client.tokens.last_expires_in}s "
          f"(cache until ~{(client.tokens.last_expires_in or 0) - 60}s)\n")

    # (a) field coverage — fetch and dump.
    print(f"--- getItems on {len(asins)} ASIN(s) ---")
    t0 = time.monotonic()
    results = client.get_items(asins)
    print(f"returned {len(results)} item(s) in {time.monotonic()-t0:.2f}s\n")

    review_field_seen = False
    for r in results:
        print(f"ASIN {r.asin}")
        print(f"  price        : {r.price} {r.currency or ''}")
        print(f"  availability : {r.availability_type}  in_stock={r.in_stock}")
        print(f"  prime        : {r.is_prime}")
        print(f"  condition    : {r.condition}  buybox_winner={r.is_buybox_winner}")
        print(f"  merchant     : {r.merchant_name}")
        print(f"  reviews      : count={r.review_count}  stars={r.star_rating}")
        print(f"  title        : {(r.title or '')[:60]}")
        blob = json.dumps(r.raw).lower()
        if "customerreviews" in blob or r.review_count is not None or r.star_rating is not None:
            review_field_seen = True
            print("  NOTE: customerReviews data present in raw — inspect raw JSON")
        if show_raw:
            print("  raw:")
            print(json.dumps(r.raw, indent=2, ensure_ascii=False))
        print()

    print("--- (a) review_count coverage ---")
    print(f"customerReviews data returned for any item: {review_field_seen}")
    if not review_field_seen:
        print("  customerReviews.count/starRating are valid resources but returned EMPTY "
              "for these ASINs. Test a known-reviewed product before relying on it.\n")

    # (b) rate-limit behavior — optional burst.
    if burst > 0:
        print(f"--- (b) rate-limit / burst: firing {burst} getItems calls ---")
        first = asins[:1] or ["B000000000"]
        t0 = time.monotonic()
        for i in range(burst):
            b0 = time.monotonic()
            try:
                client.get_items(first)
            except BudgetExhausted as exc:
                print(f"  call {i+1}: budget exhausted — {exc}")
                break
            print(f"  call {i+1}: +{time.monotonic()-b0:.2f}s  "
                  f"budget_remaining={client.budget_remaining()}")
        print(f"  total {burst} calls in {time.monotonic()-t0:.2f}s "
              f"(TPS={cfg.tps} -> expect pacing)\n")

    print("--- client stats ---")
    print(json.dumps(client.stats, indent=2))
    print(f"budget_remaining={client.budget_remaining()} / {cfg.tpd}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Creators API smoke test (no DB).")
    ap.add_argument("--offline", action="store_true",
                    help="Run limiter/token logic checks with no creds and no network.")
    ap.add_argument("--asins", default="",
                    help="Comma-separated ASINs for the live getItems call.")
    ap.add_argument("--raw", action="store_true", help="Print full raw JSON per item.")
    ap.add_argument("--burst", type=int, default=0,
                    help="Fire N extra getItems calls to exercise the rate limiter.")
    args = ap.parse_args()

    if args.offline:
        return run_offline()

    asins = [a.strip().upper() for a in args.asins.split(",") if a.strip()]
    if not asins:
        print("No --asins given. For a live run pass real ASINs, e.g.:\n"
              "  python creators_api_smoke.py --asins B0CXXXX,B0DYYYY --raw\n"
              "Or run offline logic checks:\n"
              "  python creators_api_smoke.py --offline")
        return 2
    return run_live(asins, args.raw, args.burst)


if __name__ == "__main__":
    sys.exit(main())
