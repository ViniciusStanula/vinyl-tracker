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
    titulo_seo_atualizado_em TIMESTAMPTZ -- when this row's titulo_seo was last computed

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

_COLUMNS = {"titulo_seo", "vinil_cor", "vinil_edicao", "vinil_versao", "titulo_seo_atualizado_em"}
CHUNK_SIZE = 500

_UPDATE_SQL = """UPDATE "Disco"
                 SET titulo_seo = %s, vinil_cor = %s, vinil_edicao = %s, vinil_versao = %s,
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
    query = """SELECT slug, artista, titulo, discogs_title, mb_title, discogs_format_desc
               FROM "Disco"
               WHERE disponivel = TRUE AND (format IS NULL OR format = 'vinyl')"""
    if args.limit:
        query += f" LIMIT {int(args.limit)}"
    cur.execute(query)
    rows = cur.fetchall()
    print(f"candidates: {len(rows)} | mode: {'APPLY' if args.apply else 'DRY RUN'}")

    updates = []
    for slug, artista, titulo, dt, mt, fdesc in rows:
        h1, base, cor, edicao, versao = compose(artista, titulo, dt, mt, fdesc)
        updates.append((h1, cor, edicao, versao, slug))

    if not args.apply:
        for h1, cor, edicao, versao, slug in updates[:20]:
            print(f"  {slug[:45]:47s} -> {h1}")
        print(f"\n(dry run -- {len(updates)} rows would be written; re-run with --apply)")
        return

    # One 31k-row transaction deadlocked against the price crawler, which
    # updates the same rows in its own order. Write in slug-sorted chunks so
    # both sides take row locks in a consistent order, and retry the chunk on
    # the deadlocks that consistent ordering can't rule out.
    updates.sort(key=lambda u: u[4])
    written = 0
    for start in range(0, len(updates), CHUNK_SIZE):
        written += write_chunk(conn, updates[start:start + CHUNK_SIZE])
    print(f"wrote titulo_seo for {written} records")


if __name__ == "__main__":
    main()
