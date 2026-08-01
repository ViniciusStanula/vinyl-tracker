"""
backfill_ean.py — fetch barcodes for records crawled before EAN capture existed.

Why
---
Disco.ean feeds two things: schema.org gtin13, and — far more valuable —
discogs_enrich.py, which resolves a barcode to the exact physical pressing and
is the only route we have to vinyl sides, real catalogue numbers and real
pressing countries.

EAN capture was added to the Creators API resource list on 2026-07-31, so it
only fills on crawl. The tiered crawl schedule visits low-traffic records
rarely by design, so coverage would take a long time to arrive on its own:

    2026-07-29:      0 / 1,838 crawled rows had an EAN
    2026-07-31:  3,005 / 7,621
    2026-08-01: 10,269 / 21,171

That leaves 17,753 available vinyl records without a barcode, every one of
which has an ASIN. getItems already returns externalIds, so this is a sweep,
not new API surface.

Budget
------
10 ASINs per call, so ~1,776 calls for the full set against a daily cap of
8,640. The per-run cap (CREATORS_TPD_PER_RUN, default 1000) is respected rather
than raised: the 3-hourly price refresh draws on the same budget, and starving
it to finish a backfill sooner is the wrong trade. Run twice.

Resumable: rows that gain an EAN drop out of the candidate query.

    python backfill_ean.py --limit 200        # dry run
    python backfill_ean.py --apply
"""
from __future__ import annotations

import argparse
import io
import logging
import sys

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from db_retry import connect_with_retry
from database import ensure_ean_column, save_ean
from creators_api import CreatorsConfig, CreatorsClient, BudgetExhausted

log = logging.getLogger(__name__)


def fetch_candidates(conn, limit: int | None) -> list[tuple[str, str, str]]:
    """Available vinyl rows with an ASIN and no barcode, most-tracked first.

    price_count DESC puts the records that actually get traffic — and that
    Discogs enrichment will reach first — at the front, so a partial run still
    lands where it matters.
    """
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id, asin, slug
            FROM "Disco"
            WHERE ean IS NULL
              AND asin IS NOT NULL AND asin <> ''
              AND disponivel = TRUE
              AND (format IS NULL OR format = 'vinyl')
            ORDER BY price_count DESC NULLS LAST
            {'LIMIT %s' if limit else ''}
            """,
            (limit,) if limit else (),
        )
        return cur.fetchall()


def main() -> None:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    conn = connect_with_retry()
    conn.autocommit = True
    ensure_ean_column(conn)

    rows = fetch_candidates(conn, args.limit)
    by_asin = {asin: (disco_id, slug) for disco_id, asin, slug in rows}
    print(
        f"records without a barcode: {len(rows)} | "
        f"mode: {'APPLY' if args.apply else 'DRY RUN'}\n"
    )
    if not rows:
        return

    client = CreatorsClient(CreatorsConfig.from_env())
    print(f"API budget remaining this run: {client.budget_remaining()} calls\n")

    # Fetched and written in slices rather than one 1,776-call call. Passing the
    # whole list to get_items() blocks until every call returns and only writes
    # afterwards, so hitting the per-run budget cap raised BudgetExhausted and
    # discarded every barcode fetched up to that point — spending the API budget
    # and saving nothing. Committing per slice means an interrupted run keeps
    # what it earned and the next run resumes from there.
    SLICE = 100  # 10 API calls per slice
    asins = list(by_asin)
    found = missing = seen = 0

    for i in range(0, len(asins), SLICE):
        chunk = asins[i : i + SLICE]
        try:
            results = client.get_items(chunk)
        except BudgetExhausted as exc:
            print(f"\nAPI budget reached after {seen} items — {exc}")
            print("Progress is saved. Re-run to continue.")
            break

        for r in results:
            entry = by_asin.get(r.asin)
            if entry is None:
                continue
            disco_id, slug = entry
            seen += 1
            if r.ean:
                found += 1
                if args.apply:
                    save_ean(conn, disco_id, r.ean)
                else:
                    print(f"  {slug[:52]:54s} -> {r.ean}")
            else:
                missing += 1

        if args.apply and (i // SLICE) % 10 == 0:
            log.info("%d/%d processed — %d barcodes stored", seen, len(asins), found)

    total = seen or 1
    print(
        f"\nitems processed   : {seen}"
        f"\n  with a barcode  : {found}  ({100*found/total:.0f}%)"
        f"\n  no barcode      : {missing}"
        f"\nAPI calls left    : {client.budget_remaining()}"
    )
    if not args.apply:
        print("\nDRY RUN — nothing written.")
    else:
        print("\nRe-run discogs_enrich.py afterwards: these rows are new candidates.")


if __name__ == "__main__":
    main()
