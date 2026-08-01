"""Per-record cache tags for targeted ISR revalidation.

The crawler used to finish a run with a single revalidateTag("prices"), which
marked every price-tagged cache stale — roughly 31,000 record pages plus the
artist and aggregate surfaces. A run only observes ~4,200 records, so ~27,000
untouched pages were being invalidated and then rebuilt by bot traffic. ISR
writes were 45% of the Vercel bill and scaled with catalogue size instead of
with crawl activity.

This module returns the tags for exactly the records a run touched.

Two things that look like optimisations and are not:

  * Purge on OBSERVATION, not on price change. A record's page changes on every
    observation even when the price is identical: the "Atual" timestamp, the
    price-history table and the chart each gain a row. Filtering to changed
    prices would freeze the "last checked" time, which is the one thing a price
    tracker must never show stale.

  * Only record pages are tagged per entity. Artist pages need
    `artista-<slug>`, where the slug comes from slugifyArtist() in TypeScript
    (accent folding plus "LAST, FIRST" comma inversion). Reproducing that here
    risks a silent mismatch that leaves an artist page stale, so artist and
    aggregate surfaces stay on the broad "prices" tag, which is still purged
    once per run. Disco is safe because Disco.slug is stored, not derived.

Mirrors lib/cacheTags.ts on the frontend.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)

# Keep in sync with the ENTITY_TAG regex in app/api/revalidate/route.ts.
DISCO_TAG_PREFIX = "disco-"


def observed_disco_tags(conn, since_iso: str) -> list[str]:
    """Tags for every record with a price observation at or after `since_iso`.

    `since_iso` should be the timestamp taken just before the run's first price
    write. Slightly over-selecting is harmless — an extra purge costs one
    rebuild — whereas under-selecting leaves a stale page, so the caller should
    err early rather than late.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT d.slug
            FROM "HistoricoPreco" h
            JOIN "Disco" d ON d.id = h."discoId"
            WHERE h."capturadoEm" >= %s
              AND d.slug IS NOT NULL AND d.slug <> ''
            """,
            (since_iso,),
        )
        return [DISCO_TAG_PREFIX + row[0] for row in cur.fetchall()]


def chunked(items: list[str], size: int = 200):
    """Split tags into request-sized batches.

    A run can touch several thousand records, which is too large for one
    request body and too many revalidateTag() calls for a single invocation.
    """
    for i in range(0, len(items), size):
        yield items[i : i + size]
