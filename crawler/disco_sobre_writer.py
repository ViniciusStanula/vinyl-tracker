"""Gated writer for Disco.sobre_pt.

Contract, in order: every text in a batch is checked; if ANY text fails, NOTHING
is written. Then each row is read back and compared byte for byte, and only the
verified rows are cache-purged.

This exists because the earlier write_sobre*.py scripts printed their rule
violations and saved anyway, which is how a flagged text once reached the DB.

Usage:
    from sobre_lib import run
    run([{"slug": ..., "text": ..., "source_url": ...}, ...])
"""
from __future__ import annotations

import os
import re
import sys
import unicodedata

from preflight import load_dotenv_if_present
from db_retry import connect_with_retry
import revalidate_tags

# Word-anchored: a bare substring match fires "lendári" inside "ca-lendári-o".
_BANNED = [
    "lendári", "épic", "bombástic", "impactante", "sem dúvida",
    "é conhecido por", "é conhecida por", "ao longo dos anos",
    "ao longo de sua carreira", "ao longo da carreira",
    "no cenário musical", "marco na história", "obra-prima",
]

# A few entries need a right-hand guard as well as the left one. "ao longo dos
# anos" is filler only when it stands alone; followed by a decade it is a plain
# date -- "ao longo dos anos 1990" is "throughout the 1990s" and says something
# the rewrite would lose. The substring rule cannot tell those apart and was
# rejecting 12 correct bios for every 8 padded ones.
_BANNED_SUFFIX_GUARD = {
    "ao longo dos anos": r"(?!\s*\d)",
}
_BANNED_RE = [
    (b, re.compile(r"(?<![a-zA-ZÀ-ÿ])" + re.escape(b)
                   + _BANNED_SUFFIX_GUARD.get(b, ""), re.I))
    for b in _BANNED
]

_MIN_CHARS = 250          # below this the row did not support a page
_TWO_PARA_ABOVE = 700     # padding a short source into two paragraphs is worse
_MAX_CHARS = 2600


def check(slug: str, text: str, source_url: str | None) -> list[str]:
    """Returns a list of problems. Empty list means the text may be written."""
    p: list[str] = []
    t = (text or "").strip()
    if not t:
        return ["empty text"]
    if len(t) < _MIN_CHARS:
        p.append(f"too short: {len(t)} < {_MIN_CHARS}")
    if len(t) > _MAX_CHARS:
        p.append(f"too long: {len(t)} > {_MAX_CHARS}")
    for label, rx in _BANNED_RE:
        if rx.search(t):
            p.append(f"banned phrase: {label!r}")
    if re.search(r"https?://|www\.", t):
        p.append("contains a URL")
    # Markdown SYNTAX, not the bare characters. A blunt [*_#`] class produced
    # false positives on legitimate prose: chart positions ("chegaram a #7, #13
    # e #20"), a song title ("Rainy Day Women #12 & 35") and censored profanity
    # in an album name ("God Get Me The F*** Out Of Here"). Acting on those
    # would have damaged correct text.
    # Bold/italic must be a matched PAIR wrapping text, otherwise censored
    # profanity ("F***") reads as an unclosed bold marker.
    if re.search(r"\*\*[^*\n]+\*\*|__[^_\n]+__|`|\[[^\]]+\]\([^)]*\)"
                 r"|^\s{0,3}#{1,6}\s|^\s*[*-]\s+",
                 t, re.M):
        p.append("contains markdown")
    if "–" in t or "—" in t:
        p.append("contains an en/em dash (use a plain hyphen)")
    if "  " in t or "\n\n\n" in t:
        p.append("double space or triple newline")
    paras = [x for x in t.split("\n\n") if x.strip()]
    if len(t) > _TWO_PARA_ABOVE and len(paras) < 2:
        p.append("long text in a single paragraph")
    if not source_url or not re.match(r"^https?://", source_url):
        p.append("missing or malformed source_url")
    # A stray "Fonte:" line means the source leaked into the prose.
    if re.search(r"(?i)\bfonte\s*:", t):
        p.append("source attribution inside the text")
    # Self-referential claims. Two drafts called a record the most sought-after
    # "among the ones researched here" — a fact about the writing batch, not
    # about the record, and nothing a reader of the page can check.
    if re.search(
        r"(pesquisad|analisad|levantad)[oa]s?\s+(aqui|nest[ae])"
        r"|entre os (discos |t[ií]tulos )?(do cat[áa]logo )?(pesquisad|analisad)"
        r"|nesta leva|neste levantamento|n[ao] nossa (pesquisa|amostra)",
        t,
        re.I,
    ):
        p.append("self-referential claim about the writing batch")
    return p


def run(items: list[dict], *, apply: bool = True) -> dict:
    """Check every item, then write+verify+purge. Returns a small report."""
    load_dotenv_if_present()

    problems = {it["slug"]: check(it["slug"], it["text"], it.get("source_url")) for it in items}
    failed = {s: p for s, p in problems.items() if p}
    if failed:
        print(f"REFUSED — {len(failed)} of {len(items)} texts failed the check; nothing written.")
        for s, p in failed.items():
            print(f"  {s}: {'; '.join(p)}")
        return {"written": 0, "failed": failed}

    if not apply:
        print(f"OK — {len(items)} texts pass. (apply=False, nothing written)")
        return {"written": 0, "failed": {}}

    conn = connect_with_retry()
    cur = conn.cursor()
    for it in items:
        cur.execute(
            """UPDATE "Disco"
                  SET sobre_pt = %s, sobre_pt_source_url = %s, sobre_generated_at = NOW()
                WHERE slug = %s""",
            (it["text"].strip(), it["source_url"], it["slug"]),
        )
    conn.commit()

    verified, bad = [], []
    for it in items:
        cur.execute('SELECT sobre_pt, sobre_pt_source_url FROM "Disco" WHERE slug = %s', (it["slug"],))
        row = cur.fetchone()
        if row and row[0] == it["text"].strip() and row[1] == it["source_url"]:
            verified.append(it["slug"])
        else:
            bad.append(it["slug"])

    tags = [f"{revalidate_tags.DISCO_TAG_PREFIX}{s}" for s in verified]
    url, secret = os.environ.get("REVALIDATE_URL"), os.environ.get("REVALIDATE_SECRET")
    purged = revalidate_tags.post_purge(url, secret, tags=tags) if (url and secret and tags) else 0

    print(f"written+verified {len(verified)}/{len(items)}; purged {purged}")
    if bad:
        print(f"  READ-BACK MISMATCH (not purged): {bad}")
    return {"written": len(verified), "failed": {}, "mismatch": bad}


def resolve(fragment: str) -> str:
    """Return the one slug containing `fragment`, or raise.

    Slugs get typed by hand from console listings that truncate them, and a
    wrong slug makes the UPDATE match zero rows -- caught by the read-back, but
    only after the batch has run. Resolving from the DB removes the guess:
    pass any distinctive fragment and get the real slug, or a loud failure
    naming the candidates.
    """
    load_dotenv_if_present()
    cur = connect_with_retry().cursor()
    cur.execute(
        """SELECT slug FROM "Disco"
            WHERE slug LIKE %s AND disponivel AND (format IS NULL OR format='vinyl')""",
        (f"%{fragment}%",),
    )
    hits = [r[0] for r in cur.fetchall()]
    if len(hits) == 1:
        return hits[0]
    raise LookupError(
        f"{fragment!r} matched {len(hits)} slugs"
        + (f": {hits[:6]}" if hits else " (no such record)")
    )
