"""Gated writer for Disco.lastfm_wiki_pt (hand-written translations of lastfm_wiki_en).

Same contract as disco_sobre_writer: every text in a batch is checked; if ANY
fails, NOTHING is written. Rows are read back byte for byte and only verified
rows are purged.

Extra rules for translations:
  - never overwrite: the row must have no lastfm_wiki_pt and no sobre_pt;
  - distinct wording: the text must not closely copy the prose already on
    another pressing of the same album (same mb_mbid), nor another text in
    the same batch. Duplicate pressings are the normal case for UMusic rows.

Usage:
    python disco_wikipt_writer.py queue N [--marketplace umusicstore] > q.json
    from disco_wikipt_writer import run
    run([{"slug": ..., "text": ...}, ...])
"""
from __future__ import annotations

import difflib
import io
import json
import os
import sys

from preflight import load_dotenv_if_present
from db_retry import connect_with_retry
import revalidate_tags
from disco_sobre_writer import check as _sobre_check

_MIN_CHARS = 120          # short Last.fm sources legitimately give short texts
_MAX_SIMILARITY = 0.6     # difflib ratio vs sibling pressings / batch mates
_MIN_SOURCE = 120         # below this the Last.fm "wiki" is a stub or tag note


def _similar(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, a, b, autojunk=False).ratio()


def check(slug: str, text: str, siblings: list[str]) -> list[str]:
    # Reuse the sobre rules; a translation has no source_url and a lower floor.
    p = [x for x in _sobre_check(slug, text, "https://www.last.fm")
         if not x.startswith("too short")]
    if len((text or "").strip()) < _MIN_CHARS:
        p.append(f"too short: {len((text or '').strip())} < {_MIN_CHARS}")
    for s in siblings:
        r = _similar(text.strip(), s)
        if r >= _MAX_SIMILARITY:
            p.append(f"too close to another pressing's text (ratio {r:.2f})")
            break
    return p


def _siblings(cur, slug: str) -> tuple[bool, list[str]]:
    """(row is writable, prose already on other pressings of the same album)."""
    cur.execute('SELECT mb_mbid, lastfm_wiki_pt, sobre_pt FROM "Disco" WHERE slug = %s', (slug,))
    row = cur.fetchone()
    if not row:
        raise LookupError(f"no such slug {slug!r}")
    mbid, wiki_pt, sobre = row
    writable = wiki_pt is None and sobre is None
    if not mbid:
        return writable, []
    cur.execute(
        """SELECT lastfm_wiki_pt, sobre_pt FROM "Disco"
            WHERE mb_mbid = %s AND slug <> %s
              AND (lastfm_wiki_pt IS NOT NULL OR sobre_pt IS NOT NULL)""",
        (mbid, slug),
    )
    return writable, [t for r in cur.fetchall() for t in r if t]


def run(items: list[dict], *, apply: bool = True) -> dict:
    load_dotenv_if_present()
    conn = connect_with_retry()
    cur = conn.cursor()

    failed: dict[str, list[str]] = {}
    for i, it in enumerate(items):
        writable, sibs = _siblings(cur, it["slug"])
        mates = [o["text"].strip() for j, o in enumerate(items) if j != i]
        p = check(it["slug"], it["text"], sibs + mates)
        if not writable:
            p.append("row already has lastfm_wiki_pt or sobre_pt")
        if p:
            failed[it["slug"]] = p
    if failed:
        print(f"REFUSED - {len(failed)} of {len(items)} texts failed the check; nothing written.")
        for s, p in failed.items():
            print(f"  {s}: {'; '.join(p)}")
        return {"written": 0, "failed": failed}
    if not apply:
        print(f"OK - {len(items)} texts pass. (apply=False, nothing written)")
        return {"written": 0, "failed": {}}

    for it in items:
        cur.execute(
            """UPDATE "Disco" SET lastfm_wiki_pt = %s
                WHERE slug = %s AND lastfm_wiki_pt IS NULL AND sobre_pt IS NULL""",
            (it["text"].strip(), it["slug"]),
        )
    conn.commit()

    verified, bad = [], []
    for it in items:
        cur.execute('SELECT lastfm_wiki_pt FROM "Disco" WHERE slug = %s', (it["slug"],))
        row = cur.fetchone()
        (verified if row and row[0] == it["text"].strip() else bad).append(it["slug"])

    tags = [f"{revalidate_tags.DISCO_TAG_PREFIX}{s}" for s in verified]
    url, secret = os.environ.get("REVALIDATE_URL"), os.environ.get("REVALIDATE_SECRET")
    purged = revalidate_tags.post_purge(url, secret, tags=tags) if (url and secret and tags) else 0
    print(f"written+verified {len(verified)}/{len(items)}; purged {purged}")
    if bad:
        print(f"  READ-BACK MISMATCH (not purged): {bad}")
    return {"written": len(verified), "failed": {}, "mismatch": bad}


def queue(n: int, marketplace: str | None, skip: set[str]) -> list[dict]:
    """Next n in-stock vinyl rows with a usable English wiki and no Portuguese
    prose, most-listened first."""
    load_dotenv_if_present()
    cur = connect_with_retry().cursor()
    cur.execute(
        """SELECT slug, artista, titulo, mb_title, discogs_title, lastfm_wiki_en
             FROM "Disco"
            WHERE disponivel AND format = 'vinyl'
              AND lastfm_wiki_pt IS NULL AND sobre_pt IS NULL
              AND length(lastfm_wiki_en) >= %s
              AND (%s::text IS NULL OR marketplace = %s)
            ORDER BY lastfm_listeners DESC NULLS LAST, slug""",
        (_MIN_SOURCE, marketplace, marketplace),
    )
    out = []
    for slug, artista, titulo, mbt, dgt, wiki in cur.fetchall():
        if slug in skip:
            continue
        # Shown so the new text can be worded away from it up front.
        _, sibs = _siblings(cur, slug)
        out.append({"slug": slug, "artista": artista, "titulo": titulo,
                    "mb_title": mbt, "discogs_title": dgt, "wiki_en": wiki,
                    "sibling_texts": sibs})
        if len(out) >= n:
            break
    return out


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    if len(sys.argv) >= 3 and sys.argv[1] == "queue":
        mk = sys.argv[sys.argv.index("--marketplace") + 1] if "--marketplace" in sys.argv else None
        skip_file = sys.argv[sys.argv.index("--skip") + 1] if "--skip" in sys.argv else None
        skip = set(open(skip_file, encoding="utf-8").read().split()) if skip_file and os.path.exists(skip_file) else set()
        print(json.dumps(queue(int(sys.argv[2]), mk, skip), ensure_ascii=False, indent=1))
    else:
        print(__doc__)
