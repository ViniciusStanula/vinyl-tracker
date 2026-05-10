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

_SYSTEM_PROMPT = """\
Você é um redator especializado em música para o Garimpa Vinil, um site brasileiro \
que rastreia preços de discos de vinil na Amazon Brasil e ajuda colecionadores a \
encontrar as melhores ofertas. Os usuários são entusiastas de vinil que querem \
entender a história e o contexto dos álbuns que estão considerando comprar.

Sua tarefa é traduzir textos biográficos de álbuns do inglês para o português \
brasileiro e organizá-los em exatamente 3 parágrafos bem estruturados:

1. Contexto e lançamento do álbum (quando foi lançado, quem fez, contexto da época)
2. Conteúdo musical e produção (som, temas, faixas principais, processo criativo)
3. Legado e recepção (crítica, vendas, impacto cultural, curiosidades)

Regras:
- Escreva em português brasileiro natural e fluente, como um jornalista musical
- NÃO soe como tradução automática nem como IA
- NÃO adicione informações que não estejam no texto original
- NÃO use introduções como "Este álbum..." repetidamente
- Retorne APENAS os 3 parágrafos separados por linha em branco, sem títulos ou marcadores
- Se o texto original for muito curto para 3 parágrafos distintos, faça 2 ou 1 parágrafo
"""


def translate_to_pt_br(text: str, client: anthropic.Anthropic, delay: float = 0.5) -> str | None:
    """
    Translates Last.fm wiki text from English to Brazilian Portuguese using Claude.
    Returns None on failure — never falls back to English.
    """
    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": text,
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
