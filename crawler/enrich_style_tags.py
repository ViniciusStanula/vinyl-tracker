"""
enrich_style_tags.py — Fills in missing Disco.lastfm_tags using a local LLM.

Last.fm's artist.getTopTags (backfill_tags.py) misses genres it doesn't know
about for that artist, and is blind to soundtrack/anime/game releases whose
artista field is broken (e.g. "Various", "Neon Genesis", combined names) —
those rows end up with lastfm_tags = ''. This script looks at each row's own
title/artist/existing style hint and asks a local Ollama model to pick
matching tags from the site's own existing tag vocabulary, so results stay
consistent with what /estilo pages already recognize.

Only rows with lastfm_tags = '' are touched — rows already carrying real
Last.fm tags are left alone. Default is DRY-RUN.

Usage:
    python enrich_style_tags.py --limit 200          # dry-run preview
    python enrich_style_tags.py --write               # commit
    python enrich_style_tags.py --write --limit 5000

Requires:
    DATABASE_URL in environment (or .env file).
    Ollama running locally with qwen2.5vl:7b pulled (OLLAMA_HOST optional).
"""
import argparse
import json
import logging
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    for _line in _env_path.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

from database import get_connection  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger(__name__)

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = "qwen2.5vl:7b"

# Same inclusion threshold /estilo uses so the vocabulary matches real pages.
_VOCAB_QUERY = """
    SELECT tag, COUNT(*) AS n
    FROM (
        SELECT unnest(string_to_array(lastfm_tags, ', ')) AS tag
        FROM "Disco"
        WHERE lastfm_tags IS NOT NULL AND lastfm_tags != ''
    ) t
    WHERE tag != ''
    GROUP BY tag
    HAVING COUNT(*) > 3
    ORDER BY COUNT(*) DESC
    LIMIT 200
"""

_CANDIDATES_QUERY = """
    SELECT asin, titulo, artista, estilo, lastfm_tags
    FROM "Disco"
    WHERE lastfm_tags = ''
      AND disponivel = TRUE
      AND (format IS NULL OR format = 'vinyl')
    ORDER BY "createdAt" DESC
    {limit_clause}
"""

# --augment mode: rows that already have Last.fm tags, but Last.fm's per-artist
# folksonomy can still miss a franchise tag a specific release obviously has
# (e.g. Utada's "One Last Kiss" tagged pop/j-pop but not "anime" despite the
# title naming Evangelion). Only rows still missing "anime"/"game"/"soundtrack"
# are considered — cheap pre-filter, model does the real judgment call.
_AUGMENT_CANDIDATES_QUERY = """
    SELECT asin, titulo, artista, estilo, lastfm_tags
    FROM "Disco"
    WHERE lastfm_tags IS NOT NULL AND lastfm_tags != ''
      AND NOT (lastfm_tags ILIKE '%%anime%%' OR lastfm_tags ILIKE '%%game%%' OR lastfm_tags ILIKE '%%soundtrack%%')
      AND disponivel = TRUE
      AND (format IS NULL OR format = 'vinyl')
    ORDER BY "createdAt" DESC
    {limit_clause}
"""

_PROMPT_TEMPLATE = """You catalog vinyl records for a Brazilian marketplace. Given a release, \
pick 0 to 3 style/genre tags that best describe it, chosen ONLY from this list:

{vocab}

Release:
  Title: {titulo}
  Artist: {artista}
  Existing category hint: {estilo}
  Tags it already has: {existing_tags}

Rules:
- Only pick tags from the list above — do not invent new ones.
- If the title or artist clearly references a specific anime, video game, or movie \
franchise (soundtrack, theme song, character names), include the matching tag \
(e.g. "anime", "game", "soundtrack") even if the artist name looks generic or broken.
- "anime" means Japanese animation specifically (e.g. Evangelion, Samurai Champloo, \
Studio Ghibli). Do NOT use "anime" for Western/American cartoons or animated shows \
(e.g. Steven Universe, The Simpsons) — those get "soundtrack" only, not "anime".
- Do not repeat tags it already has — only return tags it is MISSING.
- If nothing in the list clearly applies beyond what it already has, return an empty list.
- Return ONLY a valid JSON object, no markdown: {{"tags": ["tag1", "tag2"]}}
"""


def _fetch_vocab(conn) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(_VOCAB_QUERY)
        return [row[0] for row in cur.fetchall()]


def _fetch_candidates(conn, limit: int | None, augment: bool) -> list[tuple]:
    query = _AUGMENT_CANDIDATES_QUERY if augment else _CANDIDATES_QUERY
    limit_clause = f"LIMIT {limit}" if limit else ""
    with conn.cursor() as cur:
        cur.execute(query.format(limit_clause=limit_clause))
        return cur.fetchall()


# Catalog boilerplate that leaks the Portuguese word "disco" (= vinyl record)
# into titles and gets misread by the model as the music genre "disco".
_TITLE_BOILERPLATE_RE = re.compile(
    r"[\[\(]?\s*disco\s+de\s+vinil\s*[\]\)]?", re.IGNORECASE
)


def _clean_titulo(titulo: str | None) -> str:
    if not titulo:
        return ""
    return _TITLE_BOILERPLATE_RE.sub("", titulo).strip()


def _ask_ollama(
    titulo: str, artista: str, estilo: str | None, existing_tags: str, vocab: list[str]
) -> list[str] | None:
    prompt = _PROMPT_TEMPLATE.format(
        vocab=", ".join(vocab),
        titulo=_clean_titulo(titulo) or "",
        artista=artista or "",
        estilo=estilo or "(none)",
        existing_tags=existing_tags or "(none)",
    )
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.0},
    }
    try:
        resp = requests.post(f"{OLLAMA_HOST}/api/chat", json=payload, timeout=120)
        resp.raise_for_status()
        raw = resp.json()["message"]["content"]
        parsed = json.loads(raw)
        tags = parsed.get("tags", []) if isinstance(parsed, dict) else None
        if not isinstance(tags, list):
            return None
        vocab_set = set(vocab)
        have = {t.strip() for t in existing_tags.split(",")} if existing_tags else set()
        return [t for t in tags if isinstance(t, str) and t in vocab_set and t not in have]
    except json.JSONDecodeError as exc:
        log.warning("Ollama returned non-JSON: %s", exc)
        return None
    except Exception as exc:
        log.warning("Ollama request failed: %s", exc)
        return None


def _write_tags(conn, asin: str, tags: list[str]) -> bool:
    """Fill mode: only ever writes into a currently-empty lastfm_tags."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE "Disco"
            SET lastfm_tags = %s, "updatedAt" = NOW()
            WHERE asin = %s AND lastfm_tags = ''
            """,
            (", ".join(tags), asin),
        )
        updated = cur.rowcount
    conn.commit()
    return updated > 0


def _augment_tags(conn, asin: str, existing_tags: str, new_tags: list[str]) -> bool:
    """
    Augment mode: appends new_tags to existing_tags, never removes anything.
    Guarded by WHERE lastfm_tags = <snapshot> so a concurrent update elsewhere
    can't get silently clobbered.
    """
    merged = existing_tags + ", " + ", ".join(new_tags)
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE "Disco"
            SET lastfm_tags = %s, "updatedAt" = NOW()
            WHERE asin = %s AND lastfm_tags = %s
            """,
            (merged, asin, existing_tags),
        )
        updated = cur.rowcount
    conn.commit()
    return updated > 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Fill/augment Disco.lastfm_tags via local LLM")
    parser.add_argument("--limit", type=int, default=None, help="Max candidates to process")
    parser.add_argument("--write", action="store_true", help="Commit changes to DB (default: dry-run)")
    parser.add_argument("--delay", type=float, default=0.0, help="Seconds between Ollama calls")
    parser.add_argument(
        "--augment", action="store_true",
        help="Add missing anime/game/soundtrack tags to rows that already have "
             "other tags, instead of only filling blank rows (additive only).",
    )
    args = parser.parse_args()

    try:
        resp = requests.get(f"{OLLAMA_HOST}", timeout=5)
        resp.raise_for_status()
    except Exception as exc:
        log.error("Ollama not reachable at %s: %s", OLLAMA_HOST, exc)
        sys.exit(1)

    conn = get_connection()

    vocab = _fetch_vocab(conn)
    if not vocab:
        log.error("No existing style vocabulary found — aborting.")
        conn.close()
        sys.exit(1)
    log.info("Vocabulary: %d tags (top: %s)", len(vocab), ", ".join(vocab[:10]))

    candidates = _fetch_candidates(conn, args.limit, args.augment)
    log.info(
        "Mode: %s%s | candidates: %d | Ollama: %s",
        "WRITE" if args.write else "DRY-RUN",
        " AUGMENT" if args.augment else "",
        len(candidates),
        OLLAMA_HOST,
    )

    log_dir = Path(__file__).parent / "logs"
    log_dir.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    prefix = "augment_style_tags" if args.augment else "enrich_style_tags"
    log_path = log_dir / f"{prefix}_{ts}.jsonl"
    log_fh = log_path.open("w", encoding="utf-8")

    def _log_record(rec: dict) -> None:
        log_fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
        log_fh.flush()

    stats = {"processed": 0, "written": 0, "tagged": 0, "empty": 0, "errors": 0}

    for asin, titulo, artista, estilo, existing_tags in candidates:
        stats["processed"] += 1
        tags = _ask_ollama(titulo, artista, estilo, existing_tags or "", vocab)

        if tags is None:
            log.info("[%s] SKIP ollama_parse_failed — %s", asin, (titulo or "")[:50])
            _log_record({"asin": asin, "titulo": titulo, "artista": artista, "tags": None, "dry_run": not args.write})
            stats["errors"] += 1
            continue

        if tags:
            stats["tagged"] += 1
        else:
            stats["empty"] += 1

        log.info(
            "[%s] %s %r (%s) → +%s — %s",
            asin,
            "WRITE" if args.write else "DRY-RUN",
            artista,
            existing_tags or "(none)",
            tags or "(none)",
            (titulo or "")[:50],
        )
        _log_record({
            "asin": asin, "titulo": titulo, "artista": artista,
            "existing_tags": existing_tags, "tags": tags, "dry_run": not args.write,
        })

        if args.write and tags:
            if args.augment:
                ok = _augment_tags(conn, asin, existing_tags or "", tags)
            else:
                ok = _write_tags(conn, asin, tags)
            if ok:
                stats["written"] += 1

        if args.delay:
            time.sleep(args.delay)

    conn.close()
    log_fh.close()

    log.info(
        "Done. processed=%d written=%d tagged=%d empty=%d errors=%d | log=%s",
        stats["processed"], stats["written"], stats["tagged"], stats["empty"], stats["errors"],
        log_path,
    )


if __name__ == "__main__":
    main()
