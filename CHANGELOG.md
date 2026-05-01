# Changelog

## 2026-05-01 — Continuous crawler operation + stale-phase record cap removed

### Problem 1 — stale phase stopped at an arbitrary record count

`main.py` had a hardcoded fallback of `10_000` records when `--stale-max 0`
(unlimited) was passed. With 9,500+ discos and growing, Phase 3 could hit
that ceiling and leave the remaining time budget idle — even though the
deadline mechanism was already in place to stop processing gracefully.

**Fix (`crawler/main.py`):**
- Fallback changed from `10_000` → `999_999`
- Phase 3 now fetches all stale records and relies solely on the existing
  deadline (`phase3_deadline = hard_deadline − 10 min`) to stop gracefully
- Log message updated: shows `"unlimited"` instead of `999999` when
  `--stale-max 0` is used
- Workflow updated: `--stale-max 2000` → `--stale-max 0`

### Problem 2 — 2-hour gaps between crawler runs

The workflow ran on a `0 */2 * * *` cron schedule, leaving up to 2 hours
of crawl capacity unused per cycle.

**Fix (`.github/workflows/crawler.yml`):**

| Change | Detail |
|--------|--------|
| Self-trigger step added | Final step runs `gh workflow run crawler.yml` via GitHub CLI on job completion (success or failure). Skipped only on manual cancel. |
| `actions: write` permission added | Required for the built-in `GITHUB_TOKEN` to trigger new workflow runs |
| Schedule changed to `0 */6 * * *` | Cron is now a 6-hour safety net only; under normal operation the self-trigger handles continuity |

**Result:** ~30–60 second gap between runs instead of up to 2 hours.
Crawler runs 24/7 back-to-back, maximising records crawled per day.

---

## 2026-05-01 — Query performance overhaul + 5-datapoint minimum filter

### Problem
Three page types (disco detail, estilo/genre, homepage/search) were scanning
the entire `HistoricoPreco` table on every request before filtering down to
the relevant discos. The carousel had the same issue. This caused full
sequential scans proportional to the total price history size, not the number
of discos being displayed.

---

### Fix 1: Eliminate full HistoricoPreco table scans

**Root cause:** `latest` and `avgd` CTEs (or `hp_avg` LEFT JOIN) aggregated
all HistoricoPreco rows first, then joined to Disco — backwards from optimal.

**Pattern applied across all pages:**
Move the Disco filter into a `candidates` CTE that runs first. Then scope
`latest`/`avgd`/`hp_avg` to `WHERE "discoId" IN (SELECT id FROM candidates)`.
HistoricoPreco scans drop from O(entire table) to O(rows for matching discos).

| File | Change |
|------|--------|
| `frontend/app/disco/[slug]/page.tsx` | Added `candidates` CTE using `Disco_deal_score_idx` to pick 4 related disco IDs; `latest`/`avgd` scoped to those 4 |
| `frontend/app/estilo/[slug]/page.tsx` | Added `candidates` CTE filtering by `lastfm_tags`; `latest`/`avgd` scoped to matching genre discos |
| `frontend/lib/queryDiscos.ts` | Converted global `hp_avg` LEFT JOIN (full 30-day table scan) to `LATERAL` correlated subquery scoped per disco row |
| `frontend/lib/carousel.ts` | Same `hp_avg` → `LATERAL` fix as queryDiscos |

**Supabase index added manually:**
```sql
CREATE INDEX "HistoricoPreco_discoId_capturadoEm_idx"
  ON public."HistoricoPreco" ("discoId", "capturadoEm" DESC);
```
Required for LATERAL subqueries to run as index seeks instead of sequential
scans. Without this, each correlated subquery would still scan all rows for
that disco without an ordered index to short-circuit.

---

### Fix 2: Hide discos with fewer than 5 price datapoints

**Why:** Products with very few crawls have insufficient price history for
meaningful deal scoring, sparklines, and discount calculations.

**Implementation:** Denormalized `price_count INTEGER` column on `Disco`.
Storing the count avoids a subquery on every request.

**Migration (run in Supabase):** `frontend/prisma/price_count_migration.sql`
```sql
ALTER TABLE "Disco" ADD COLUMN IF NOT EXISTS price_count INTEGER DEFAULT 0;
UPDATE "Disco" SET price_count = (SELECT COUNT(*) FROM "HistoricoPreco" WHERE "discoId" = "Disco".id);
CREATE INDEX IF NOT EXISTS "Disco_price_count_idx" ON "Disco" (price_count);
```
Backfill result: 9,540 discos qualify (≥ 5 datapoints), avg = 16, max = 190.

**Filter applied to:**

| File | Filter location |
|------|----------------|
| `frontend/lib/queryDiscos.ts` | Both the COUNT query (pagination total) and the `base` CTE WHERE clause |
| `frontend/app/estilo/[slug]/page.tsx` | `candidates` CTE WHERE clause |
| `frontend/app/disco/[slug]/page.tsx` | `candidates` CTE WHERE clause |
| `frontend/lib/carousel.ts` | `best_per_artist` WHERE clause |
| `frontend/app/artista/[slug]/page.tsx` | JS filter after Prisma `findMany` (`d.precos.length >= 5`, scoped to last 12 months) |

**Crawler updated** (`crawler/database.py`) to maintain `price_count` on every insert:
- `upsert_batch()`: CTE insert (`WITH ins AS ... RETURNING "discoId"`) atomically
  increments `price_count + 1` only when a HistoricoPreco row is actually written.
  Discos skipped by the `deal_score IS NOT NULL` guard do not increment.
- `mark_stale_price()`: Added `price_count = price_count + 1` to the existing
  Disco UPDATE that runs after every Phase 3 insert.
- `ensure_schema_extras()`: Column and index registered for self-healing on fresh DBs.
  Column count check bumped from 12 → 13.

---

### Deploy order (important)

For future deployments that add new DB columns referenced in raw SQL:

1. Run the SQL migration in Supabase first
2. Deploy frontend/crawler code second

Deploying code before the column exists causes PostgreSQL errors on all pages
that reference the missing column.
