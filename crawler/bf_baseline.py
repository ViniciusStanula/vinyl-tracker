#!/usr/bin/env python3
"""
bf_baseline.py — Materializes the Black Friday reference price per record.

/black-friday measures discounts against the median price from 1 Sep to 15 Oct
(baseline_window), not avg_30d: a price raised in early November inflates a
30-day average and makes the later "cut" look like a real discount. The window
closes before Amazon's "esquenta" (2025: started between 21 Oct and 3 Nov), whose
sale prices would otherwise shrink every discount measured against it.

The median scans ~1.3M HistoricoPreco rows, too slow for a page render, so this
writes it to bf_baseline (migrations/20261015_bf_baseline.sql). Run daily; the
window grows until BASELINE_END and is frozen after it, so later runs are skipped.

Also holds the Black Friday calendar shared with x_post.py; the frontend mirror
is frontend/lib/blackFriday.ts — keep the two in step.

Usage:
    python bf_baseline.py           # refresh this year's baseline if the window is open
    python bf_baseline.py --force   # recompute even after the window closed
"""

import logging
import sys
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg2.extras

log = logging.getLogger(__name__)

# Not imported from bot.py: bot.py imports this module for the roundup.
SAO_PAULO = ZoneInfo("America/Sao_Paulo")

# A record needs this much history inside the window for its median to mean
# anything; one capture on 14 Oct is not a "price before Black Friday".
MIN_SAMPLES = 20
MIN_DAYS    = 5


def black_friday(year: int) -> date:
    """The Friday after the fourth Thursday of November (US Thanksgiving)."""
    first = date(year, 11, 1)
    first_thursday = first + timedelta(days=(3 - first.weekday()) % 7)
    return first_thursday + timedelta(days=22)


def baseline_window(year: int) -> tuple[date, date]:
    """[start, end) of the reference-price window: 1 Sep through 15 Oct."""
    return date(year, 9, 1), date(year, 10, 16)


def bf_week(year: int) -> tuple[date, date]:
    """Monday before Black Friday through Cyber Monday, inclusive."""
    bf = black_friday(year)
    return bf - timedelta(days=4), bf + timedelta(days=3)


def in_bf_week(today: date) -> bool:
    start, end = bf_week(today.year)
    return start <= today <= end


def pick_bf_deals(conn, year: int, limit: int, exclude: list[str]) -> list[dict]:
    """Biggest real discounts vs the reference price, for the bot roundups.

    Same filter as the /black-friday page (frontend/lib/db/blackFriday.ts).
    `avg_30d` carries the baseline so x_post.build_roundup_text computes the
    discount against it unchanged.
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT d.asin,
                   COALESCE(NULLIF(d.titulo_seo, ''), d.titulo) AS titulo,
                   d.artista,
                   d."imgUrl"    AS img_url,
                   l.preco_brl,
                   b.baseline    AS avg_30d
            FROM bf_baseline b
            JOIN "Disco" d ON d.id = b.disco_id
            JOIN LATERAL (
                SELECT "precoBrl" AS preco_brl
                FROM "HistoricoPreco"
                WHERE "discoId" = d.id
                ORDER BY "capturadoEm" DESC
                LIMIT 1
            ) l ON TRUE
            WHERE b.year = %s
              AND d.disponivel = TRUE
              AND (d.format IS NULL OR d.format = 'vinyl')
              AND d.price_count >= 5
              AND d."imgUrl" IS NOT NULL AND d."imgUrl" <> ''
              AND l.preco_brl >= 30
              AND l.preco_brl <= b.baseline * 0.9
              AND d.asin <> ALL(%s)
            ORDER BY (b.baseline - l.preco_brl) / b.baseline DESC, d.id
            LIMIT %s
        """, (year, exclude, limit))
        return [dict(r) for r in cur.fetchall()]


def refresh(conn, year: int) -> int:
    """Rewrite the year's rows in one transaction, so records that no longer
    meet MIN_SAMPLES/MIN_DAYS (or a changed window) leave no stale baseline."""
    start, end = baseline_window(year)
    with conn.cursor() as cur:
        cur.execute("SET statement_timeout = '10min'")
        cur.execute("DELETE FROM bf_baseline WHERE year = %s", (year,))
        cur.execute("""
            INSERT INTO bf_baseline (year, disco_id, baseline, samples, days, computed_at)
            SELECT %(year)s, "discoId",
                   percentile_cont(0.5) WITHIN GROUP (ORDER BY "precoBrl"),
                   count(*),
                   count(DISTINCT ("capturadoEm" AT TIME ZONE 'America/Sao_Paulo')::date),
                   NOW()
            FROM "HistoricoPreco"
            WHERE "capturadoEm" >= (%(start)s::date)::timestamp AT TIME ZONE 'America/Sao_Paulo'
              AND "capturadoEm" <  (%(end)s::date)::timestamp AT TIME ZONE 'America/Sao_Paulo'
              AND "precoBrl" >= 30
            GROUP BY "discoId"
            HAVING count(*) >= %(min_samples)s
               AND count(DISTINCT ("capturadoEm" AT TIME ZONE 'America/Sao_Paulo')::date) >= %(min_days)s
        """, {"year": year, "start": start, "end": end,
              "min_samples": MIN_SAMPLES, "min_days": MIN_DAYS})
        n = cur.rowcount
    conn.commit()
    return n


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    today = datetime.now(SAO_PAULO).date()
    start, end = baseline_window(today.year)
    # Run one extra day past the window so the final day's captures land.
    if not (start <= today <= end) and "--force" not in sys.argv:
        log.info("BF baseline: window %s..%s not open today (%s), skipping", start, end, today)
        return
    from bot import connect
    conn = connect()
    try:
        n = refresh(conn, today.year)
        log.info("BF baseline %d: %d records written", today.year, n)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
