"""
score_tags.py — score current tags against the hand-labelled answer key.

Reads tag_goldset.csv for the labels and re-reads the tags from the database, so
the same answer key measures every future enrichment run. Run it before and
after a change; if the numbers do not move, the change did not help.

Reported:
  acuracia     share of labelled rows currently verdict-worthy as `ok`, using
               tags_certas where given
  precisao     of the tags currently on the records, how many the label kept
  cobertura    of the tags the label expected, how many are present
  vazios       labelled rows currently carrying no tags at all

Precision and coverage are only computed over rows where tags_certas was filled
in — a bare verdict says a row is wrong but not what right looks like.

Rows whose ASIN has left the catalog are reported and skipped, not counted as
failures.

Usage:
    python score_tags.py
    python score_tags.py --by-stratum
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


def parse_tags(s: str) -> set[str]:
    return {t.strip().lower() for t in (s or "").split(",") if t.strip()}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--by-stratum", action="store_true")
    args = ap.parse_args()

    if not os.path.exists(GOLDSET_CSV):
        print("No tag_goldset.csv — run build_tag_goldset.py first.")
        raise SystemExit(1)

    with io.open(GOLDSET_CSV, encoding="utf-8") as fh:
        gold = list(csv.DictReader(fh))

    labelled = [g for g in gold if (g.get("verdict") or "").strip()]
    print(f"answer key : {len(gold)} row(s), {len(labelled)} labelled "
          f"({len(gold) - len(labelled)} still blank)")
    if not labelled:
        print("Nothing labelled yet — fill in `verdict` in tag_goldset.csv.")
        return

    conn = get_connection()
    cur = conn.cursor()
    cur.execute('SELECT asin, COALESCE(lastfm_tags, \'\') FROM "Disco" '
                "WHERE asin = ANY(%s)", ([g["asin"] for g in labelled],))
    current = dict(cur.fetchall())
    conn.close()

    gone = [g for g in labelled if g["asin"] not in current]
    scored = [g for g in labelled if g["asin"] in current]

    ok = empty = 0
    tp = fp = fn = 0
    per_stratum: dict[str, list[int]] = {}

    for g in scored:
        now = parse_tags(current[g["asin"]])
        expected = parse_tags(g.get("tags_certas", ""))
        verdict_ok = False

        if expected:
            tp += len(now & expected)
            fp += len(now - expected)
            fn += len(expected - now)
            verdict_ok = now == expected
        else:
            verdict_ok = (g["verdict"].strip().lower() == "ok")

        if verdict_ok:
            ok += 1
        if not now:
            empty += 1

        bucket = per_stratum.setdefault(g.get("estrato", "?"), [0, 0])
        bucket[1] += 1
        if verdict_ok:
            bucket[0] += 1

    n = len(scored)
    print(f"\nacuracia   : {ok}/{n} = {ok / n:.1%}")
    if tp + fp:
        print(f"precisao   : {tp}/{tp + fp} = {tp / (tp + fp):.1%}"
              f"   (rows with tags_certas only)")
    if tp + fn:
        print(f"cobertura  : {tp}/{tp + fn} = {tp / (tp + fn):.1%}")
    print(f"vazios     : {empty}/{n}")
    if gone:
        print(f"fora do catalogo (ignorados): {len(gone)}")

    if args.by_stratum:
        print("\npor estrato:")
        for name, (good, total) in sorted(per_stratum.items()):
            print(f"  {name:10s} {good:3d}/{total:3d} = {good / total:.0%}")


if __name__ == "__main__":
    main()
