"""
build_tag_goldset.py — draw a stratified sample of records to hand-label.

Every tag change so far has been judged by eye. That is how "Dirty Dancing"
survived as a game record for weeks: it looked fine. Without a fixed answer key
there is no way to tell an enrichment run that helped from one that hurt.

This draws a sample once and writes a CSV to fill in by hand. Scoring is
score_tags.py, which re-reads the same ASINs from the database, so the answer
key stays valid as tags change — that is the point of it.

Stratified deliberately, because a uniform sample is ~77% three-tag artist-level
rows and would say nothing about the cases that actually go wrong:

  populares    high price_count — what most visitors actually see
  cauda        listed but few prices — where enrichment is thinnest
  sem_tags     lastfm_tags = '' — the gap the LLM pass is meant to close
  trilhas      soundtrack/game/anime tagged — where categories get fabricated
  um_tag       exactly one tag — under-described
  varios       Various Artists / unknown artist — the buckets that got clobbered

Fill in per row:
  verdict      ok | wrong | incompleto        (required)
  tags_certas  the tags you would expect, comma-separated (optional but
               strongly preferred — it turns scoring from a rate into a diff)
  nota         free text

Leave `verdict` blank to skip a row; score_tags.py ignores unlabelled rows and
reports how much of the set is still unlabelled.

Usage:
    python build_tag_goldset.py                  # 200 rows, default strata
    python build_tag_goldset.py --per-stratum 50
    python build_tag_goldset.py --seed 7         # different draw
"""
import io
import os
import csv
import argparse

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from database import get_connection

GOLDSET_CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           "tag_goldset.csv")

VINYL = "disponivel = TRUE AND (format IS NULL OR format = 'vinyl')"

STRATA = {
    "populares": f"{VINYL} AND price_count >= 20 AND lastfm_tags <> ''",
    "cauda":     f"{VINYL} AND price_count BETWEEN 5 AND 19 AND lastfm_tags <> ''",
    "sem_tags":  f"{VINYL} AND price_count >= 5 AND (lastfm_tags = '' OR lastfm_tags IS NULL)",
    "trilhas":   f"{VINYL} AND (lastfm_tags ILIKE '%%soundtrack%%' "
                 f"OR lastfm_tags ILIKE '%%game%%' OR lastfm_tags ILIKE '%%anime%%')",
    "um_tag":    f"{VINYL} AND lastfm_tags <> '' "
                 f"AND array_length(string_to_array(lastfm_tags, ','), 1) = 1",
    "varios":    f"{VINYL} AND lastfm_tags <> '' AND artista IN "
                 f"('Various Artists', 'Various', 'Artista não identificado')",
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-stratum", type=int, default=34)
    ap.add_argument("--seed", type=float, default=0.42,
                    help="postgres setseed value; same seed = same sample")
    args = ap.parse_args()

    if os.path.exists(GOLDSET_CSV):
        print(f"{GOLDSET_CSV} already exists — refusing to overwrite hand-labelled\n"
              f"work. Delete it first if you really want a fresh sample.")
        raise SystemExit(1)

    conn = get_connection()
    cur = conn.cursor()

    rows = []
    seen: set[str] = set()
    for name, where in STRATA.items():
        cur.execute("SELECT setseed(%s)", (args.seed,))
        cur.execute(f"""
            SELECT asin, artista, titulo, COALESCE(lastfm_tags, ''), estilo,
                   mb_genres, price_count
            FROM "Disco" WHERE {where}
            ORDER BY random() LIMIT %s
        """, (args.per_stratum,))
        got = 0
        for asin, artista, titulo, tags, estilo, mb, pc in cur.fetchall():
            if asin in seen:
                continue
            seen.add(asin)
            got += 1
            rows.append({
                "asin": asin, "estrato": name, "artista": artista,
                "titulo": titulo, "tags_atuais": tags,
                "estilo": estilo or "", "mb_genres": mb or "",
                "price_count": pc,
                "verdict": "", "tags_certas": "", "nota": "",
            })
        print(f"  {name:10s} {got:3d} row(s)")

    conn.close()

    with io.open(GOLDSET_CSV, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    print(f"\n{len(rows)} row(s) -> {GOLDSET_CSV}")
    print("Fill in `verdict` (ok | wrong | incompleto) and ideally `tags_certas`,")
    print("then run: python score_tags.py")


if __name__ == "__main__":
    main()
