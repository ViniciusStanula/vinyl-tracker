"""
backfill_titulo_seo.py — adds the SEO title columns to "Disco" and computes
them for every vinyl record, using the rules in titulo_seo.py.

    python backfill_titulo_seo.py --apply             # write for real
    python backfill_titulo_seo.py                     # dry run, no writes
    python backfill_titulo_seo.py --apply --limit 500  # smaller batch

New columns:
    titulo_seo               TEXT        -- final H1 / <title> / JSON-LD name
    vinil_cor                TEXT        -- e.g. "Vermelho", "Splatter Colorido"; NULL if unknown
    vinil_edicao              TEXT        -- e.g. "Edição Deluxe", "Record Store Day"; NULL if unknown
    vinil_versao              TEXT        -- e.g. "Ao Vivo", "Remix"; NULL if unknown
    vinil_gramatura          TEXT        -- "180g" / "200g"; NULL if unknown
    vinil_reedicao           BOOLEAN     -- TRUE repress, FALSE original, NULL unknown
    titulo_seo_atualizado_em TIMESTAMPTZ -- when this row's values last CHANGED

Every vinyl row is recomputed on each run, but only rows whose computed values
differ from the stored ones are written -- rewriting a page with the values it
already holds costs a Vercel ISR write and buys nothing. So the timestamp marks
the last change, not the last computation, and a row can sit indefinitely with
an older timestamp than the enrichment that fed it. That is the no-op case, not
a backlog.

Re-running is safe and cheap: only rows where discogs_title / mb_title /
discogs_format_desc changed since titulo_seo_atualizado_em need recomputing,
so this is meant to run on the same daily schedule as the enrichment jobs
that feed it, not just once.
"""
import argparse
import io
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present
load_dotenv_if_present()

import psycopg2

from db_retry import connect_with_retry
from titulo_seo import compose

_COLUMNS = {
    "titulo_seo", "vinil_cor", "vinil_edicao", "vinil_versao",
    "vinil_gramatura", "vinil_reedicao", "titulo_seo_atualizado_em",
}
CHUNK_SIZE = 500

_UPDATE_SQL = """UPDATE "Disco"
                 SET titulo_seo = %s, vinil_cor = %s, vinil_edicao = %s, vinil_versao = %s,
                     vinil_gramatura = %s, vinil_reedicao = %s,
                     titulo_seo_atualizado_em = now()
                 WHERE slug = %s"""


def write_chunk(conn, chunk: list[tuple], attempts: int = 4) -> int:
    """Writes one chunk in its own transaction, retrying on deadlock."""
    for attempt in range(attempts):
        try:
            with conn.cursor() as cur:
                cur.executemany(_UPDATE_SQL, chunk)
            conn.commit()
            return len(chunk)
        except psycopg2.errors.DeadlockDetected:
            conn.rollback()
            if attempt == attempts - 1:
                raise
            wait = 2.0 * (attempt + 1)
            print(f"  deadlock, retry {attempt + 1}/{attempts} in {wait:.0f}s")
            time.sleep(wait)
    return 0


def ensure_columns(conn) -> None:
    """Same fast-path pattern as discogs_enrich.ensure_columns: skip the DDL
    (and its ACCESS EXCLUSIVE lock) entirely once the columns already exist,
    so this doesn't fight the price crawler or a sibling backfill for the
    table lock on every run."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT count(*) FROM information_schema.columns
               WHERE table_name = 'Disco' AND column_name = ANY(%s)""",
            (list(_COLUMNS),),
        )
        if cur.fetchone()[0] == len(_COLUMNS):
            return
    with conn.cursor() as cur:
        cur.execute(
            """ALTER TABLE "Disco"
                 ADD COLUMN IF NOT EXISTS titulo_seo               TEXT,
                 ADD COLUMN IF NOT EXISTS vinil_cor                TEXT,
                 ADD COLUMN IF NOT EXISTS vinil_edicao             TEXT,
                 ADD COLUMN IF NOT EXISTS vinil_versao             TEXT,
                 ADD COLUMN IF NOT EXISTS vinil_gramatura          TEXT,
                 ADD COLUMN IF NOT EXISTS vinil_reedicao           BOOLEAN,
                 ADD COLUMN IF NOT EXISTS titulo_seo_atualizado_em TIMESTAMPTZ"""
        )
    conn.commit()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    conn = connect_with_retry()
    ensure_columns(conn)

    cur = conn.cursor()
    # The stored values come back too: a run that rewrites all ~40k rows with
    # the values they already hold costs a Vercel ISR write for every page whose
    # output it touches, for nothing. Only rows the rules now answer differently
    # are written.
    query = """SELECT slug, artista, titulo, discogs_title, mb_title, discogs_format_desc,
                      titulo_seo, vinil_cor, vinil_edicao, vinil_versao,
                      vinil_gramatura, vinil_reedicao
               FROM "Disco"
               WHERE disponivel = TRUE AND (format IS NULL OR format = 'vinyl')"""
    if args.limit:
        query += f" LIMIT {int(args.limit)}"
    cur.execute(query)
    rows = cur.fetchall()
    print(f"candidates: {len(rows)} | mode: {'APPLY' if args.apply else 'DRY RUN'}")

    updates, changes = [], []
    for (slug, artista, titulo, dt, mt, fdesc,
         old_h1, old_cor, old_ed, old_ver, old_gram, old_reed) in rows:
        h1, base, cor, edicao, versao, gramatura, reedicao = compose(artista, titulo, dt, mt, fdesc)
        if (h1, cor, edicao, versao, gramatura, reedicao) == (
            old_h1, old_cor, old_ed, old_ver, old_gram, old_reed
        ):
            continue
        updates.append((h1, cor, edicao, versao, gramatura, reedicao, slug))
        changes.append((slug, old_h1, h1))

    print(f"changed: {len(updates)} of {len(rows)}")

    if not args.apply:
        for slug, old_h1, h1 in changes[:20]:
            print(f"  {slug[:45]:47s}\n      was: {old_h1}\n      now: {h1}")
        print(f"\n(dry run -- {len(updates)} rows would be written; re-run with --apply)")
        return

    # One 31k-row transaction deadlocked against the price crawler, which
    # updates the same rows in its own order. Write in slug-sorted chunks so
    # both sides take row locks in a consistent order, and retry the chunk on
    # the deadlocks that consistent ordering can't rule out.
    updates.sort(key=lambda u: u[-1])
    written = 0
    for start in range(0, len(updates), CHUNK_SIZE):
        written += write_chunk(conn, updates[start:start + CHUNK_SIZE])
    print(f"wrote titulo_seo for {written} records")


if __name__ == "__main__":
    main()
