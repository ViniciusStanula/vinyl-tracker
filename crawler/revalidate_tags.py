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

  * Artist tags are NOT built here. `artista-<slug>` needs slugifyArtist() from
    TypeScript (NFD accent folding, "LAST, FIRST" comma inversion, 60-char cut)
    and a Python copy of those rules could drift, silently leaving an artist
    page stale forever. So this module returns raw artist NAMES and
    /api/revalidate slugifies them with the real function. Disco is different
    because Disco.slug is stored, not derived, so the tag is safe to build here.

    Style tags and country codes follow the same rule: `estilo-<slug>` needs
    slugifyStyle() and `pais-<slug>` needs the ISO2->slug lookup table, both
    TypeScript-only, so this module sends raw style-tag strings and raw ISO2
    codes and /api/revalidate maps them.

    Aggregate surfaces (home, /disco, /ofertas, search, hub indexes, and the
    per-decade record listing, which shares queryDiscosWithCache with those
    other surfaces) stay on the broad "prices" tag, which is still purged once
    per run.

Mirrors lib/cacheTags.ts on the frontend.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)

# Keep in sync with the ENTITY_TAG regex in app/api/revalidate/route.ts.
DISCO_TAG_PREFIX = "disco-"


def observed_disco_tags(conn, since_iso: str) -> list[str]:
    """Tags for every record observed at or after `since_iso`.

    Two sources, because a price observation alone does not cover everything the
    page renders:

    1. A new HistoricoPreco row — the record was seen with a price.
    2. A record that went out of stock. mark_unavailable() writes NO price row
       (there is no price to record), so such records are invisible to (1). They
       were therefore never purged, and the page kept serving a working "Ver na
       Amazon" button for something nobody can buy. Observed 2026-08-24 on
       dynasty-disco-de-vinil-gfijm8, stale for over a day in the other
       direction. mark_unavailable() does bump updatedAt, which is what (2) keys
       off.

    Coming back in stock is already covered by (1): the record is re-crawled with
    a price, so a HistoricoPreco row is written.

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

            UNION

            SELECT DISTINCT d.slug
            FROM "Disco" d
            WHERE d."updatedAt" >= %s
              AND d.disponivel = FALSE
              AND d.slug IS NOT NULL AND d.slug <> ''
            """,
            (since_iso, since_iso),
        )
        return [DISCO_TAG_PREFIX + row[0] for row in cur.fetchall()]


def observed_artist_names(conn, since_iso: str) -> list[str]:
    """Raw artist names for every record observed at or after `since_iso`.

    Names, not slugs — see the module docstring. Deduped here so the request
    bodies stay small; /api/revalidate dedupes again after slugifying, since
    two spellings can fold to the same slug.

    Same two sources as observed_disco_tags(), for the same reason: the artist
    page renders its unavailable records in a separate greyed-out block, so a
    record going out of stock changes that page too and must purge it.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT d.artista
            FROM "HistoricoPreco" h
            JOIN "Disco" d ON d.id = h."discoId"
            WHERE h."capturadoEm" >= %s
              AND d.artista IS NOT NULL AND d.artista <> ''

            UNION

            SELECT DISTINCT d.artista
            FROM "Disco" d
            WHERE d."updatedAt" >= %s
              AND d.disponivel = FALSE
              AND d.artista IS NOT NULL AND d.artista <> ''
            """,
            (since_iso, since_iso),
        )
        return [row[0] for row in cur.fetchall()]


def observed_style_tags(conn, since_iso: str) -> list[str]:
    """Raw style-tag strings (lastfm_tags + discogs_styles) for records
    observed at or after `since_iso` — one entry per tag, not per record.

    Raw strings, not slugs — see the module docstring. /estilo/[slug] treats
    a record as a member of a style if EITHER column names it (lib/db/estilo.ts),
    so both are sourced here to match. Same two-source (price row / went
    out of stock) pattern as observed_disco_tags().
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            WITH touched AS (
                SELECT DISTINCT d.id
                FROM "HistoricoPreco" h
                JOIN "Disco" d ON d.id = h."discoId"
                WHERE h."capturadoEm" >= %s

                UNION

                SELECT DISTINCT d.id
                FROM "Disco" d
                WHERE d."updatedAt" >= %s
                  AND d.disponivel = FALSE
            )
            SELECT DISTINCT tag
            FROM (
                SELECT unnest(string_to_array(d.lastfm_tags, ', ')) AS tag
                FROM "Disco" d
                JOIN touched t ON t.id = d.id
                WHERE d.lastfm_tags IS NOT NULL AND d.lastfm_tags <> ''

                UNION ALL

                SELECT unnest(string_to_array(d.discogs_styles, ', ')) AS tag
                FROM "Disco" d
                JOIN touched t ON t.id = d.id
                WHERE d.discogs_styles IS NOT NULL AND d.discogs_styles <> ''
            ) tags
            WHERE tag <> ''
            """,
            (since_iso, since_iso),
        )
        return [row[0] for row in cur.fetchall()]


def observed_country_codes(conn, since_iso: str) -> list[str]:
    """Raw ISO2 country codes (ArtistMeta.country) for artists of records
    observed at or after `since_iso`.

    /pais/[slug] membership is a JOIN on ArtistMeta.country, not a Disco
    column (lib/db/pais.ts) — same two-source pattern as observed_disco_tags().
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT am.country
            FROM "HistoricoPreco" h
            JOIN "Disco" d ON d.id = h."discoId"
            JOIN "ArtistMeta" am ON am.artista = d.artista
            WHERE h."capturadoEm" >= %s
              AND am.country IS NOT NULL AND am.country <> ''

            UNION

            SELECT DISTINCT am.country
            FROM "Disco" d
            JOIN "ArtistMeta" am ON am.artista = d.artista
            WHERE d."updatedAt" >= %s
              AND d.disponivel = FALSE
              AND am.country IS NOT NULL AND am.country <> ''
            """,
            (since_iso, since_iso),
        )
        return [row[0] for row in cur.fetchall()]


def tags_and_artists_for_ids(conn, disco_ids) -> tuple[list[str], list[str]]:
    """Same purge inputs, for the backfill scripts that work by Disco id.

    Those scripts change titles, genres and tracklists rather than prices, so
    they cannot select by observation time — they know exactly which rows they
    touched. Returns (disco tags, artist names): a title fix shows on both the
    record page and the artist's listing.
    """
    ids = list(disco_ids)
    if not ids:
        return [], []
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT slug, artista FROM "Disco" WHERE id = ANY(%s)
            """,
            (ids,),
        )
        rows = cur.fetchall()
    tags = [DISCO_TAG_PREFIX + r[0] for r in rows if r[0]]
    artists = sorted({r[1] for r in rows if r[1]})
    return tags, artists


def chunked(items: list[str], size: int = 200):
    """Split tags into request-sized batches.

    A run can touch several thousand records, which is too large for one
    request body and too many revalidateTag() calls for a single invocation.
    """
    for i in range(0, len(items), size):
        yield items[i : i + size]


def post_purge(
    url: str,
    secret: str,
    tags=(),
    artist_names=(),
    style_tags=(),
    country_codes=(),
    timeout: int = 20,
) -> int:
    """POST entity purges in batches. Returns how many entities were accepted.

    Best-effort by design: every caller still has the 4h ISR TTL underneath, so
    a failed batch means a page is stale for up to 4h, never indefinitely.
    Never raises — a purge failure must not fail a crawl.
    """
    import requests as _requests

    sent = 0
    for key, items in (
        ("tags", list(tags)),
        ("artistNames", list(artist_names)),
        ("styleTags", list(style_tags)),
        ("countryCodes", list(country_codes)),
    ):
        for batch in chunked(items):
            try:
                resp = _requests.post(
                    url, json={"secret": secret, key: batch}, timeout=timeout
                )
                if resp.status_code == 200:
                    sent += len(batch)
                else:
                    log.warning(
                        "Purge batch (%s) failed — HTTP %s: %s",
                        key, resp.status_code, resp.text[:200],
                    )
            except Exception as exc:
                log.warning("Purge batch (%s) failed (non-fatal): %s", key, exc)
    return sent
