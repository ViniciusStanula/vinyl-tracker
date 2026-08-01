"""Re-fetch cover images for records stuck on Amazon's "no image" placeholder.

Amazon serves a 60x40 blank (images/I/01AodW1Gh-L and three siblings) when a
listing has no cover art. The crawler stored that URL like any other, so 439
records render a blank box instead of the site's own fallback icon.

Two distinct cases, and the API tells them apart:

  * Amazon has since added a cover. Re-querying returns a real URL — the record
    the bug was reported on (FKA twigs, B0H5JJRY7G) now resolves to a 500x500
    image. These get fixed.

  * Amazon still has no cover. The API returns the same placeholder, at 60x40.
    These are set to NULL so the frontend shows its own vinyl icon, which looks
    deliberate rather than broken.

Detection is by image ID prefix rather than by dimensions alone: every
placeholder observed lives under images/I/01..., and a real cover has never
been seen with that prefix (439 of 439 `01` rows are placeholders, and all four
distinct IDs return 782-1445 bytes against ~9KB for a real cover).

    python repair_placeholder_images.py            # dry run
    python repair_placeholder_images.py --apply
"""
import argparse
import io
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from db_retry import connect_with_retry
from creators_api import CreatorsConfig, CreatorsClient, BudgetExhausted

# Amazon's placeholder assets all sit under images/I/01... . Matching the prefix
# rather than the four known IDs so a fifth variant cannot slip through.
PLACEHOLDER_RE = re.compile(r"/images/I/01", re.IGNORECASE)


def is_placeholder(url: str | None) -> bool:
    return bool(url) and PLACEHOLDER_RE.search(url) is not None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int, help="cap ASINs processed (budget control)")
    args = ap.parse_args()

    conn = connect_with_retry()
    conn.autocommit = True
    with conn.cursor() as cur:
        # Listable records first: those are the ones actually visible on the site.
        cur.execute(
            """
            SELECT asin, slug, "imgUrl"
            FROM "Disco"
            WHERE "imgUrl" ~* '/images/I/01'
              AND asin IS NOT NULL AND asin <> ''
            ORDER BY (disponivel AND price_count >= 5) DESC, price_count DESC NULLS LAST
            """
        )
        rows = cur.fetchall()

    if args.limit:
        rows = rows[: args.limit]
    print(f"records on placeholder: {len(rows)}  (mode: {'APPLY' if args.apply else 'DRY RUN'})\n")
    if not rows:
        return

    by_asin = {asin: slug for asin, slug, _ in rows}

    cfg = CreatorsConfig.from_env()
    # Ride the same getItems call the price refresh uses; images are just extra
    # resources on a request we are already paying TPS/TPD for.
    cfg.resources = list(cfg.resources) + ["images.primary.large"]
    client = CreatorsClient(cfg)

    fixed = still_missing = errored = 0
    try:
        results = client.get_items(list(by_asin))
    except BudgetExhausted as exc:
        print(f"API budget exhausted before start: {exc}")
        return

    for r in results:
        slug = by_asin.get(r.asin)
        if slug is None:
            continue
        url = (((r.raw.get("images") or {}).get("primary") or {}).get("large") or {}).get("url")

        if url and not is_placeholder(url):
            if args.apply:
                with conn.cursor() as cur:
                    cur.execute('UPDATE "Disco" SET "imgUrl" = %s WHERE asin = %s', (url, r.asin))
            fixed += 1
            print(f"  FIXED  {slug[:44]:46s} -> {url.rsplit('/', 1)[-1]}")
        elif url:
            # Amazon still has no cover. NULL lets the frontend draw its own
            # fallback instead of embedding a 60x40 blank.
            if args.apply:
                with conn.cursor() as cur:
                    cur.execute('UPDATE "Disco" SET "imgUrl" = NULL WHERE asin = %s', (r.asin,))
            still_missing += 1
        else:
            errored += 1

    print(
        f"\nfixed with a real cover : {fixed}"
        f"\nstill no cover (NULLed) : {still_missing}"
        f"\nno image in response    : {errored}"
    )
    if not args.apply:
        print("\nDRY RUN — nothing written. Re-run with --apply.")


if __name__ == "__main__":
    main()
