-- Black Friday reference prices
-- Generated: 2026-10-15
--
-- WHY
-- ---
-- /black-friday compares each record's current price with what it cost BEFORE
-- the Black Friday run-up, not with avg_30d: sellers raise prices in early
-- November and then "cut" them, which drags a 30-day average up and makes a
-- fake discount look real.
--
-- The reference is the median price from 1 Sep to 15 Oct, before Amazon's
-- "esquenta". Computing that median per record at render time scans ~1.3M
-- HistoricoPreco rows (15 s measured), so crawler/bf_baseline.py materializes it
-- here once a day until the window closes, after which the rows stay frozen.
--
-- HOW TO RUN
-- ----------
-- Raw SQL via node pg / psql (never prisma db push — see project notes).

CREATE TABLE IF NOT EXISTS bf_baseline (
    year        INT            NOT NULL,
    disco_id    TEXT           NOT NULL,
    baseline    DECIMAL(10,2)  NOT NULL,
    samples     INT            NOT NULL,
    days        INT            NOT NULL,
    computed_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    PRIMARY KEY (year, disco_id)
);
