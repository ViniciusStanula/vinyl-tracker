# Q4 Deferred: Canonical Tag Lookup Redesign

## The Problem

**Query** (source: `frontend/app/estilo/[slug]/page.tsx:51-66`):
- **1809 calls**, mean **1562ms**, **2.8M ms total** (6.5% of all DB time)
- `pg_stat_statements` key: canonical tag slug reverse-lookup

```sql
WITH tags AS (
  SELECT DISTINCT unnest(string_to_array(lastfm_tags, ', ')) AS tag
  FROM "Disco"
  WHERE lastfm_tags IS NOT NULL AND lastfm_tags != ''
)
SELECT tag FROM tags
WHERE regexp_replace(
        regexp_replace(translate(lower(tag), $accent_from, $accent_to), '[^a-z0-9]+', '-', 'g'),
        '^-+|-+$', '', 'g'
      ) = $slug
LIMIT 1
```

### Why it's slow

1. Full seqscan of `"Disco"` to find all non-null lastfm_tags rows
2. `unnest(string_to_array(...))` expands every tag from every row
3. Then applies `translate + regexp_replace` (the slug transform) on every expanded tag
4. No index can help: the expression operates on a *computed* value derived from a TEXT column,
   not on the column itself

### Why indexes don't fix it

- The GIN index `idx_disco_lastfm_tags_gin` indexes `string_to_array(lower(lastfm_tags), ', ')`.
  It supports `WHERE $tag = ANY(string_to_array(...))` membership checks — but not reverse lookups
  (slug → canonical tag name).
- A functional index on the tag unnest expression is not possible: indexes only work on stored
  column values, not on set-returning functions like `unnest()`.

---

## Recommended Fix: `tag_slug` Lookup Table

### Schema change

```sql
CREATE TABLE "EstiloTag" (
  slug       TEXT PRIMARY KEY,
  canonical  TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Population

Rebuild whenever `lastfm_tags` changes (or on a daily schedule):

```sql
INSERT INTO "EstiloTag" (slug, canonical)
SELECT DISTINCT
  regexp_replace(
    regexp_replace(
      translate(lower(tag), 'áàâãäåéèêëíìîïóòôõöúùûüçñý', 'aaaaaaeeeeiiiioooouuuucny'),
      '[^a-z0-9]+', '-', 'g'
    ),
    '^-+|-+$', '', 'g'
  ) AS slug,
  tag AS canonical
FROM (
  SELECT DISTINCT unnest(string_to_array(lastfm_tags, ', ')) AS tag
  FROM "Disco"
  WHERE lastfm_tags IS NOT NULL AND lastfm_tags != ''
) t
ON CONFLICT (slug) DO UPDATE SET canonical = EXCLUDED.canonical, updated_at = NOW();
```

### Frontend change

Replace the 1562ms CTE query with a single PK lookup:

```typescript
const row = await prisma.$queryRaw<{ canonical: string }[]>`
  SELECT canonical FROM "EstiloTag" WHERE slug = ${slug} LIMIT 1
`;
```

Expected: **~0.1ms** (PK index scan on small table).

### Alternative: application-level cache

If schema changes are undesirable, fetch the full `(slug, canonical)` map once at startup
and store in memory (or Redis). The tag set is small (~hundreds of distinct tags) and changes
infrequently.

```typescript
// Example: warm once, reuse across requests
const tagMap = new Map<string, string>(); // slug → canonical
```

---

## Effort estimate

| Approach | Schema change | Crawler change | Frontend change | Risk |
|----------|--------------|----------------|-----------------|------|
| `EstiloTag` table | Yes (new table) | Yes (populate after tag backfill) | Small (1 query) | Low |
| App-level cache | No | No | Medium (cache layer) | Low |

Both approaches eliminate the query entirely. Recommended: `EstiloTag` table — simpler,
consistent across multiple instances, no cache invalidation complexity.
