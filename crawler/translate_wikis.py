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

MIN_LISTENERS = 0

_CHUNK_MAX = 480  # MyMemory free tier caps at ~500 chars/request


def _split_into_chunks(text: str, max_len: int = _CHUNK_MAX) -> list[str]:
    """
    Splits text into chunks of at most max_len characters, breaking on sentence
    boundaries ('. ', '! ', '? ') to avoid cutting mid-sentence.
    """
    if len(text) <= max_len:
        return [text]

    chunks: list[str] = []
    remaining = text
    while len(remaining) > max_len:
        # Search backwards from max_len for a sentence boundary
        cut = max_len
        for sep in (". ", "! ", "? "):
            idx = remaining.rfind(sep, 0, max_len)
            if idx > 0:
                cut = min(cut, idx + len(sep))  # include the separator in chunk
        # If no boundary found, cut at max_len (last resort)
        chunks.append(remaining[:cut].strip())
        remaining = remaining[cut:].strip()
    if remaining:
        chunks.append(remaining)
    return chunks


def _translate_chunks(chunks: list[str], email: str | None, delay: float) -> list[str] | None:
    """Translates a list of text chunks. Returns None if any chunk fails."""
    translated: list[str] = []
    for i, chunk in enumerate(chunks):
        params: dict = {"q": chunk, "langpair": "en|pt-BR"}
        if email:
            params["de"] = email
        url = "https://api.mymemory.translated.net/get?" + urllib.parse.urlencode(params)
        try:
            with urllib.request.urlopen(url, timeout=15) as resp:
                data = json.loads(resp.read())
            if data.get("responseStatus") != 200:
                log.debug("MyMemory status %s on chunk %d — skipping.", data.get("responseStatus"), i)
                return None
            part = data.get("responseData", {}).get("translatedText") or None
            if not part:
                return None
            translated.append(part)
        except Exception as exc:
            log.debug("Translation request failed on chunk %d: %s", i, exc)
            return None
        if i < len(chunks) - 1:
            time.sleep(delay)
    return translated


def translate_to_pt_br(text: str, email: str | None = None, delay: float = 0.5) -> str | None:
    """
    Translates text from English to Brazilian Portuguese via MyMemory API.
    Preserves paragraph breaks. Long paragraphs are split into chunks.
    Returns None if any chunk fails — never falls back to English.
    """
    paragraphs = text.split("\n\n")
    translated_paragraphs: list[str] = []

    for paragraph in paragraphs:
        stripped = paragraph.strip()
        if not stripped:
            translated_paragraphs.append("")
            continue
        chunks = _split_into_chunks(stripped)
        result = _translate_chunks(chunks, email=email, delay=delay)
        if result is None:
            return None
        translated_paragraphs.append(" ".join(result))

    return "\n\n".join(translated_paragraphs) or None


def translate_wiki_summaries(
    conn,
    email: str | None = None,
    delay: float = 2.0,
    chunk_delay: float = 0.5,
    min_listeners: int = MIN_LISTENERS,
    limit: int = 100,
    deadline: float | None = None,
) -> int:
    """
    Translates lastfm_wiki_en → lastfm_wiki_pt for qualifying albums.
    Long wikis are split into chunks; chunk_delay controls pause between chunks.
    delay controls pause between albums.
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
        translated = translate_to_pt_br(album["wiki_en"], email=email, delay=chunk_delay)
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
