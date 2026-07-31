"""
fetch_release_details.py — pull label, catalogue number, barcode and release
country from MusicBrainz for records already matched to a release-group.

Fills the gaps found in a competitor audit: their release schema carries
recordLabel, catalogNumber and releasedEvent/country while ours carries none of
them. It also picks up the barcode, which they map to catalogNumber -- that's
semantically wrong (schema.org has gtin13 for barcodes; catalogNumber is the
label's own number), so we store the two separately and can emit both correctly.

Which release: a release-group holds many releases (reissues, regional
pressings). mb_tracklist.py picks the one with the most tracks. Fetching
recordings here just to mirror that choice would triple the response size for
every record, so instead we prefer the earliest dated release that actually has
a label -- normally the original pressing, which is the sensible thing to show
as "the label that put this out". On a reissue-heavy release-group this can
name the original label rather than the one on the specific pressing being
sold; that's an accepted, documented trade-off, not an oversight.

MusicBrainz allows ~1 request/sec per IP. Do NOT run alongside mb_enrich.py,
wikipedia_bio_fetch.py --apply-mb-fix, recover_artist_from_mb.py or
fetch_artist_urls.py.

Usage:
    python fetch_release_details.py --limit 10        # dry run
    python fetch_release_details.py --apply
"""
import argparse
import io
import json
import sys
import time
import urllib.parse
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from db_retry import connect_with_retry
from mb_enrich import MB_BASE, USER_AGENT

COLS = ("mb_label", "mb_catalog_number", "mb_barcode", "mb_release_country")


def column_exists(conn) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """SELECT count(*) FROM information_schema.columns
               WHERE table_name = 'Disco' AND column_name = 'mb_label'"""
        )
        return bool(cur.fetchone()[0])


def ensure_columns(conn) -> None:
    """Idempotent raw DDL. Raw SQL on purpose -- `prisma db push` is unsafe
    here (it drops crawler-added Disco columns absent from schema.prisma)."""
    if column_exists(conn):
        return
    with conn.cursor() as cur:
        cur.execute("SET LOCAL lock_timeout = '10s'")
        cur.execute(
            """ALTER TABLE "Disco"
                 ADD COLUMN IF NOT EXISTS mb_label            TEXT,
                 ADD COLUMN IF NOT EXISTS mb_catalog_number   TEXT,
                 ADD COLUMN IF NOT EXISTS mb_barcode          TEXT,
                 ADD COLUMN IF NOT EXISTS mb_release_country  TEXT"""
        )
    conn.commit()
    print("added Disco.mb_label / mb_catalog_number / mb_barcode / mb_release_country")


def fetch_details(rg_mbid: str) -> dict | None:
    url = f"{MB_BASE}release?release-group={urllib.parse.quote(rg_mbid, safe='')}&inc=labels&limit=25&fmt=json"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
    except Exception:
        return None

    releases = data.get("releases") or []
    if not releases:
        return {}

    # MusicBrainz editors sometimes type the literal word "none" (or "[none]")
    # into catalog-number rather than leaving it empty; seen live on Public
    # Image Ltd. Storing that would render "Catálogo: none" on the page.
    def clean_catno(v):
        if not v:
            return None
        s = str(v).strip()
        return None if s.lower().strip("[]") in ("none", "n/a", "-", "") else s

    def label_of(rel):
        for li in rel.get("label-info") or []:
            name = (li.get("label") or {}).get("name")
            if name:
                return name, clean_catno(li.get("catalog-number"))
        return None, None

    # Earliest dated release that actually names a label; undated releases sort
    # last so a dateless reissue never outranks a dated original.
    candidates = [r for r in releases if label_of(r)[0]]
    if not candidates:
        candidates = releases
    candidates.sort(key=lambda r: (r.get("date") or "9999"))
    best = candidates[0]

    label, catno = label_of(best)
    return {
        "mb_label": label,
        "mb_catalog_number": catno,
        # Barcodes are EAN/UPC; keep digits only so the frontend can decide
        # between gtin13 / gtin12 without re-parsing punctuation.
        "mb_barcode": (best.get("barcode") or "").strip() or None,
        "mb_release_country": best.get("country"),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--delay", type=float, default=1.1, help="MB courtesy delay; keep >= 1.1")
    args = ap.parse_args()

    conn = connect_with_retry()
    if args.apply:
        ensure_columns(conn)
    cur = conn.cursor()

    # Resumable: once the column exists, skip rows already filled.
    skip_done = "AND mb_label IS NULL" if column_exists(conn) else ""
    cur.execute(
        f"""
        SELECT slug, artista, titulo, mb_mbid FROM "Disco"
        WHERE mb_mbid IS NOT NULL AND mb_mbid <> ''
          AND disponivel = TRUE AND (format IS NULL OR format = 'vinyl')
          {skip_done}
        ORDER BY price_count DESC NULLS LAST
        """
    )
    rows = cur.fetchall()
    if args.limit:
        rows = rows[: args.limit]
    print(f"records to enrich: {len(rows)}  (mode: {'APPLY' if args.apply else 'DRY RUN'})\n")

    filled = 0
    for i, (slug, artista, titulo, mbid) in enumerate(rows, 1):
        det = fetch_details(mbid)
        time.sleep(args.delay)
        if det is None:
            print(f"  ERR  {artista[:22]} — {titulo[:34]}")
            continue
        if det.get("mb_label") or det.get("mb_release_country"):
            filled += 1
        if not args.apply or i <= 12:
            print(f"  {artista[:20]:20s} | {titulo[:30]:30s} | "
                  f"{str(det.get('mb_label'))[:22]:22s} {det.get('mb_release_country') or '--':4s} "
                  f"cat={str(det.get('mb_catalog_number'))[:14]}")
        if args.apply:
            cur.execute(
                """UPDATE "Disco" SET mb_label=%s, mb_catalog_number=%s,
                       mb_barcode=%s, mb_release_country=%s
                   WHERE slug=%s""",
                (det.get("mb_label"), det.get("mb_catalog_number"),
                 det.get("mb_barcode"), det.get("mb_release_country"), slug),
            )
            conn.commit()
        if i % 200 == 0:
            print(f"  ...{i}/{len(rows)} | with data: {filled}")

    print(f"\nrecords with label/country: {filled}/{len(rows)}")
    if not args.apply:
        print("DRY RUN — nothing written.")
    conn.close()


if __name__ == "__main__":
    main()
