-- Defense-in-depth DB gate (CD-leak audit, 2026-06-12).
-- Brand-new Disco rows must arrive positively identified as vinyl
-- (format = 'vinyl', set by the crawler's allowlist gate). Existing rows
-- are exempt: BEFORE INSERT fires before ON CONFLICT resolution, so
-- refresh upserts of legacy NULL-format rows must pass through untouched.
--
-- Loud by design: a violation aborts the batch and fails the workflow run,
-- surfacing any future regression in the Python gates immediately.

CREATE OR REPLACE FUNCTION disco_enforce_vinyl_insert() RETURNS trigger AS $$
BEGIN
  IF NEW.format IS DISTINCT FROM 'vinyl'
     AND NOT EXISTS (SELECT 1 FROM "Disco" WHERE asin = NEW.asin) THEN
    RAISE EXCEPTION 'Disco insert rejected: new ASIN % must have format=''vinyl'' (got %)',
      NEW.asin, COALESCE(NEW.format, 'NULL');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS disco_vinyl_insert_gate ON "Disco";
CREATE TRIGGER disco_vinyl_insert_gate
  BEFORE INSERT ON "Disco"
  FOR EACH ROW EXECUTE FUNCTION disco_enforce_vinyl_insert();
