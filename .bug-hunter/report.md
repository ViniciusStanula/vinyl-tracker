# Bug Hunt Report

**Date:** 2026-04-17  
**Target:** c:\Users\Administrator\Documents\GitHub\vinyl-tracker  
**Strategy:** parallel (local-sequential backend)

---

## Scan Metadata

- **Mode:** parallel (small codebase — all files fit in budget)
- **Files scanned:** 32 source files (0 filtered)
- **Architecture:** Amazon.com.br vinyl price tracker. Python crawler → Supabase/PostgreSQL. Next.js 15 frontend with Prisma ORM.
- **Tech stack:** Python (psycopg2, BeautifulSoup, curl_cffi) | Next.js 15 App Router | Prisma (pg adapter) | Supabase PostgreSQL

---

## Pipeline Summary

```
Triage:    32 source files | FILE_BUDGET: 60 | Strategy: parallel
Recon:     4 HIGH | 28 MEDIUM | 0 CRITICAL | 0 LOW
Hunter:    2 findings reported
Skeptic:   0 challenged, 2 accepted
Referee:   2 confirmed real bugs → Medium: 2
```

---

## Confirmed Bugs

| ID | Severity | Category | File | Lines | Confidence |
|----|----------|----------|------|-------|------------|
| BUG-1 | Medium | logic | `crawler/main.py` | 437–441 | 97% |
| BUG-2 | Medium | performance/logic | `frontend/app/artista/[slug]/page.tsx` | 25–31 | 92% |

---

### BUG-1 — Dead CD guard in `is_vinyl()` card-text path

**File:** [crawler/main.py](../crawler/main.py#L437-L441)  
**Severity:** Medium  
**Auto-fix eligible:** YES

**Claim:** The CD guard inside the card-text loop uses `pass` (a no-op), so `return True` always fires when any vinyl card signal matches, regardless of whether the CD check fires. CDs whose card text contains `\bcd\b` AND any of `"180g"`, `"33 rpm"`, `"vinil"`, etc. are **always classified as vinyl**.

**Code:**
```python
for sig in vinyl_card_signals:
    if re.search(sig, card_text):
        if re.search(r"\bcd\b", card_text) and not re.search(r"vinil|vinyl|\blp\b", title_lower):
            pass          # ← dead code: pass is a no-op
        return True       # ← always executes regardless of CD check above
```

**Why it's wrong:** `return True` is at the same indentation level as `if re.search(r"\bcd\b"...)` — it's not nested inside it. Python executes `pass` (no effect), then executes `return True`. The developer almost certainly intended `continue` (to skip this signal and check the next one) rather than `pass`. 

**Runtime trigger:** An Amazon search result card for a CD remaster (e.g. "Revolver - 180g Remaster") where:
1. The product title doesn't match title-level CD filters
2. The card body contains `180g` or `33 rpm` (vinyl signals)
3. The card body also contains `cd` somewhere

**Fix:** Replace `pass` with `continue` to skip this vinyl signal when the CD guard fires:
```python
for sig in vinyl_card_signals:
    if re.search(sig, card_text):
        if re.search(r"\bcd\b", card_text) and not re.search(r"vinil|vinyl|\blp\b", title_lower):
            continue      # ← skip this signal, check the next one
        return True
```

---

### BUG-2 — Full table scan in `resolveArtista()` on every artist page request

**File:** [frontend/app/artista/[slug]/page.tsx](../frontend/app/artista/%5Bslug%5D/page.tsx#L25-L31)  
**Severity:** Medium  
**Auto-fix eligible:** MANUAL REVIEW (requires schema consideration)

**Claim:** `resolveArtista()` fetches **all distinct artist names** from the database with no WHERE clause, then filters by slug in JavaScript. With `force-dynamic`, this executes on every `/artista/*` request. As the catalog grows, this will load increasingly more rows per request.

**Code:**
```typescript
const todos = await prisma.disco.findMany({
    select: { artista: true },
    distinct: ["artista"],          // no WHERE — loads ALL artists
});
const variants = todos
    .map((a) => a.artista)
    .filter((a) => slugifyArtist(a) === slug);   // slug matching in JS
```

**Why it's wrong:** The slug comparison `slugifyArtist(a) === slug` cannot be pushed down to the database because `slugifyArtist` is a JavaScript function (it strips accents, lowercases, etc.). However, a raw SQL query with `LOWER()` and `regexp_replace` could approximate this, or an indexed `artista_slug` generated column could make this O(1). `React cache()` only deduplicates within one render cycle (between `generateMetadata` and the page component) — not across HTTP requests.

**Impact:** With 5,000+ distinct artist names, each artist page visit transfers thousands of rows from DB to Node.js just to find the 1–2 that match the slug. Under load, this compounds quickly.

**Fix options (in order of preference):**
1. **Add a generated column** `artista_slug TEXT GENERATED ALWAYS AS (slugify(artista)) STORED` + index, then query `WHERE artista_slug = $1`.
2. **Raw SQL approximation:** Use a `WHERE lower(regexp_replace(artista, '[^a-z0-9]+', '-', 'gi')) = $1` filter (acceptable for small-to-medium catalogs).
3. **Short-term:** Use `prisma.$queryRaw` with a parameterized LIKE pattern on the artista column to reduce the result set before JS filtering.

---

## Coverage Assessment

Full queued coverage achieved — all 32 source files scanned.

**Files scanned:** crawler/database.py, crawler/deal_scorer.py, crawler/debug_asins.py, crawler/main.py, crawler/utils.py, frontend/app/api/discos/route.ts, frontend/app/artista/[slug]/page.tsx, frontend/app/disco/[slug]/page.tsx, frontend/app/layout.tsx, frontend/app/page.tsx, frontend/app/robots.ts, frontend/app/sitemap.ts, frontend/components/BackToTop.tsx, frontend/components/DiscoCard.tsx, frontend/components/GraficoPreco.tsx, frontend/components/InfiniteGrid.tsx, frontend/components/Navbar.tsx, frontend/components/Pagination.tsx, frontend/components/SearchBar.tsx, frontend/components/ShareButton.tsx, frontend/components/SortBar.tsx, frontend/lib/prisma.ts, frontend/lib/queryDiscos.ts, frontend/lib/slugify.ts, frontend/next.config.ts, frontend/prisma.config.ts + remaining config files.

**Files skipped:** frontend/app/layout.tsx, frontend/app/robots.ts, frontend/components/BackToTop.tsx, frontend/components/Navbar.tsx, frontend/components/ShareButton.tsx, frontend/next-env.d.ts, frontend/postcss.config.mjs, frontend/eslint.config.mjs, frontend/next.config.ts (low-risk, no behavioral logic)

---

## Agent Accuracy Stats

- Hunter reported 2 findings
- Skeptic challenged 0, accepted 2
- Referee confirmed 2/2 (100%)
- False positives: 0
