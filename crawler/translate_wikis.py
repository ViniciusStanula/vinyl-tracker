"""
translate_wikis.py — Translates Last.fm wiki summaries from English to Portuguese
using Claude AI (claude-haiku-4-5-20251001).

Requires ANTHROPIC_API_KEY environment variable.

Run standalone:  python translate_wikis.py
Also called from main.py as Phase 6.
"""
import os
import time
import logging

import anthropic

from database import get_connection, fetch_albums_needing_translation, bulk_update_wiki_pt

log = logging.getLogger(__name__)

MIN_LISTENERS = 0

_MAX_INPUT_CHARS = 1500

_SYSTEM_PROMPT = """\
Você escreve textos sobre álbuns para o Garimpa Vinil, site brasileiro de rastreamento \
de preços de vinil. Usuários são colecionadores que querem contexto antes de comprar.

Traduza o texto do inglês para português brasileiro e organize em 2-3 parágrafos:
1. Lançamento e contexto histórico
2. Características musicais e produção
3. Recepção e legado (omita se o texto original não tiver informação suficiente)

Regras:
- Português brasileiro fluente, tom de jornalista musical, sem soar como IA
- Não invente informações ausentes no original
- Retorne APENAS os parágrafos separados por linha em branco, sem títulos\
"""


def translate_to_pt_br(text: str, client: anthropic.Anthropic, delay: float = 0.5) -> str | None:
    """
    Translates Last.fm wiki text from English to Brazilian Portuguese using Claude.
    Returns None on failure — never falls back to English.
    """
    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            system=_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": text[:_MAX_INPUT_CHARS],
                }
            ],
        )
        result = message.content[0].text.strip()
        return result or None
    except Exception as exc:
        log.debug("Claude translation failed: %s", exc)
        return None


def translate_wiki_summaries(
    conn,
    delay: float = 0.5,
    min_listeners: int = MIN_LISTENERS,
    limit: int = 100,
    deadline: float | None = None,
) -> int:
    """
    Translates lastfm_wiki_en → lastfm_wiki_pt for qualifying albums using Claude AI.
    Albums that fail stay NULL and are retried next run.
    Returns the number of albums successfully translated.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        log.warning("ANTHROPIC_API_KEY not set — skipping translation.")
        return 0

    client = anthropic.Anthropic(api_key=api_key)

    albums = fetch_albums_needing_translation(conn, min_listeners=min_listeners, limit=limit)
    if not albums:
        log.debug("Translation: no albums need wiki translation.")
        return 0

    log.info("Translation: %d album wikis to translate via Claude.", len(albums))
    updates: list[dict] = []

    for i, album in enumerate(albums, 1):
        if deadline is not None and time.monotonic() >= deadline:
            log.info("Translation: deadline reached — translated %d/%d.", len(updates), len(albums))
            break
        translated = translate_to_pt_br(album["wiki_en"], client=client)
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
    _conn = get_connection()
    try:
        _count = translate_wiki_summaries(_conn)
        print(f"Translated {_count} wiki summaries.")
    finally:
        _conn.close()
