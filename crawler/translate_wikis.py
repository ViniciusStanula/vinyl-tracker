"""
translate_wikis.py — Translates Last.fm wiki summaries from English to Portuguese.

Only translates albums with lastfm_listeners >= MIN_LISTENERS (default 500_000)
to stay within MyMemory's free tier rate limits.

Run standalone:  python translate_wikis.py
Also called from main.py as Phase 6.

With MYMEMORY_EMAIL set: 50,000 chars/day limit.
Without: 5,000 chars/day limit.
"""
import os
import time
import json
import logging
import urllib.parse
import urllib.request

from database import get_connection, fetch_albums_needing_translation, bulk_update_wiki_pt

log = logging.getLogger(__name__)

MIN_LISTENERS = 500_000


def translate_to_pt_br(text: str, email: str | None = None) -> str | None:
    """
    Translates text from English to Brazilian Portuguese via MyMemory API.
    Returns None on failure — never falls back to English.
    """
    params: dict = {"q": text, "langpair": "en|pt-BR"}
    if email:
        params["de"] = email
    url = "https://api.mymemory.translated.net/get?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = json.loads(resp.read())
        if data.get("responseStatus") != 200:
            log.debug("MyMemory status %s — skipping.", data.get("responseStatus"))
            return None
        return data.get("responseData", {}).get("translatedText") or None
    except Exception as exc:
        log.debug("Translation request failed: %s", exc)
        return None


def translate_wiki_summaries(
    conn,
    email: str | None = None,
    delay: float = 2.0,
    min_listeners: int = MIN_LISTENERS,
    limit: int = 100,
    deadline: float | None = None,
) -> int:
    """
    Translates lastfm_wiki_en → lastfm_wiki_pt for qualifying albums.
    Albums that fail translation stay NULL and are retried next run.
    Returns the number of albums successfully translated.
    """
    albums = fetch_albums_needing_translation(conn, min_listeners=min_listeners, limit=limit)
    if not albums:
        log.debug("Translation: no albums need wiki translation.")
        return 0

    log.info("Translation: %d album wikis to translate.", len(albums))
    updates: list[dict] = []

    for i, album in enumerate(albums, 1):
        if deadline is not None and time.monotonic() >= deadline:
            log.info("Translation: deadline reached — translated %d/%d.", len(updates), len(albums))
            break
        translated = translate_to_pt_br(album["wiki_en"], email=email)
        if translated:
            updates.append({"id": album["id"], "wiki_pt": translated})
            log.debug("[%d/%d] translated OK.", i, len(albums))
        else:
            log.debug("[%d/%d] failed — will retry next run.", i, len(albums))
        if i < len(albums):
            time.sleep(delay)

    return bulk_update_wiki_pt(conn, updates)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    _email = os.environ.get("MYMEMORY_EMAIL")
    _conn = get_connection()
    try:
        _count = translate_wiki_summaries(_conn, email=_email)
        print(f"Translated {_count} wiki summaries.")
    finally:
        _conn.close()
