/**
 * Cache tags for on-demand revalidation.
 *
 * The crawler used to end every run with a single `revalidateTag("prices")`,
 * which invalidated all 22 price-tagged caches at once — roughly 42,000 pages
 * (~31k disco + ~11k artista, plus the aggregates). But a crawl only observes
 * ~4,200 records, so ~27,000 of those pages were being marked stale without
 * having been looked at, and were then rebuilt by bot traffic. ISR writes were
 * 45% of the Vercel bill and growing with catalogue size rather than with
 * activity.
 *
 * Per-entity tags let the crawler purge exactly what it touched.
 *
 * IMPORTANT — a record's page changes on every observation, not only when the
 * price moves: the "Atual" timestamp, the price-history table and the chart all
 * gain a row. So the crawler must purge on OBSERVATION, never on price-change.
 * Purging only on change would freeze the "last checked" time, which is the one
 * thing a price tracker must never show stale.
 *
 * The broad "prices" tag is kept for the aggregate surfaces (home, /disco,
 * /ofertas, search, the hub indexes, and the paginated listings whose ?page=
 * variants cannot be enumerated). Those are a handful of routes, so purging
 * them every run is cheap — the cost was never there.
 *
 * Record pages moved off "prices" first; artist pages followed (see
 * artistaTag below for how the slug problem was solved). Style, country and
 * decade pages are still on "prices" — a few thousand pages, worth doing next
 * if the bill still shows it.
 *
 * These strings are mirrored in crawler/revalidate_tags.py. Change both.
 */

/** Per-record: /disco/[slug] and everything keyed off that record. */
export const discoTag = (slug: string) => `disco-${slug}`;

/**
 * Per-artist: /artista/[slug]. Takes the canonical artist slug.
 *
 * The crawler cannot build this slug itself — slugifyArtist() folds accents via
 * NFD, inverts "LAST, FIRST" and cuts at 60 chars, and a Python copy of those
 * rules could drift and leave an artist page stale forever. So the crawler
 * posts raw artist NAMES to /api/revalidate and the route slugifies them with
 * the real function. One copy of the rule, no drift.
 */
export const artistaTag = (slug: string) => `artista-${slug}`;

/** Per-style: /estilo/[slug]. */
export const estiloTag = (slug: string) => `estilo-${slug}`;

/** Per-country: /pais/[slug]. */
export const paisTag = (slug: string) => `pais-${slug}`;

/** Per-decade: /decada/[decada]. */
export const decadaTag = (decada: string | number) => `decada-${decada}`;

/**
 * Broad tag, still purged once per crawl. Aggregate surfaces only — do not add
 * it to anything that exists once per record or per artist, or the per-entity
 * tags stop buying anything.
 */
export const PRICES_TAG = "prices";
