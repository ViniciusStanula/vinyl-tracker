-- Reverts 20260608_hreflang_tables.sql. Hreflang feature removed entirely
-- (frontend code, Prisma models, and these tables). NOTE: compute_hreflang.py
-- in the US-site repo still writes to these tables after each crawl — that
-- script must stop running (or be updated) before/after this migration runs,
-- or it will start failing on every crawl.
DROP TABLE IF EXISTS "HreflangSlug";
DROP TABLE IF EXISTS "HreflangRecord";
