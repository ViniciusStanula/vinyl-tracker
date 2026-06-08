-- HreflangSlug: precomputed set of genre/artist slugs that have a peer on the US site.
-- Populated by scripts/compute_hreflang.py after each crawl. Full-replace on every run.
CREATE TABLE IF NOT EXISTS "HreflangSlug" (
  type TEXT NOT NULL,
  slug TEXT NOT NULL,
  PRIMARY KEY (type, slug)
);

-- HreflangRecord: precomputed ASIN → US slug mapping for record-level hreflang.
-- Populated by scripts/compute_hreflang.py after each crawl. Full-replace on every run.
CREATE TABLE IF NOT EXISTS "HreflangRecord" (
  asin      TEXT PRIMARY KEY,
  peer_slug TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
