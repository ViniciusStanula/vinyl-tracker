"""
generate_seo_content.py — Generates SEO bio content for artist and style pages.

For each artist/style in the queue:
  1. Fetches bio text from Last.fm (artist.getInfo / tag.getInfo)
  2. Rewrites via Claude with a vinyl-collector angle in PT-BR
  3. Saves intro (2-3 sentences) + bio (2-3 paragraphs) to DB

Idempotent: skips records where bio_generated_at IS NOT NULL.

Requires:
  LASTFM_API_KEY    — Last.fm API key
  ANTHROPIC_API_KEY — Anthropic API key
  DATABASE_URL      — Supabase connection string

Usage:
    python generate_seo_content.py [--limit N] [--mode artists|styles|both] [--dry-run]

Options:
    --limit N        Max items to process per run (default: 20)
    --mode           artists | styles | both  (default: both)
    --dry-run        Print generated content without saving to DB
"""
import argparse
import json
import logging
import os
import re
import time
import urllib.parse
import urllib.request

import anthropic

from database import (
    get_connection,
    ensure_seo_content_schema,
    fetch_artists_needing_bio,
    fetch_styles_needing_bio,
    save_artist_bio,
    save_estilo_bio,
)

log = logging.getLogger(__name__)

LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/"
LASTFM_RATE  = 0.25   # seconds between Last.fm requests
CLAUDE_RATE  = 0.5    # seconds between Claude requests
CLAUDE_MODEL = "claude-haiku-4-5-20251001"

_MAX_SOURCE_CHARS = 5000

_SYSTEM_PROMPT = """\
Você escreve conteúdo para o Garimpa Vinil, site brasileiro de rastreamento de \
preços de discos de vinil na Amazon Brasil. O público são colecionadores que \
querem contexto sobre artistas e gêneros antes de comprar.

Regras obrigatórias:
- Português brasileiro fluente, voz de colecionador de vinil, não de jornalista
- Foco na história do artista/gênero e no contexto do catálogo físico
- Mencione edições notáveis, relançamentos e fatos relevantes para quem coleciona
- Nunca especule sobre movimentos de preço ou tendências de mercado
- Nunca use travessão (—)
- Evite padrões de IA: "é conhecido por", "ao longo dos anos", "ao longo de sua carreira", "sem dúvida"
- Baseie o conteúdo apenas no texto fornecido, não invente fatos
- Sem markdown, sem asteriscos, sem negrito, sem títulos
- Parágrafos separados por linha em branco

Retorne APENAS um JSON válido com exatamente duas chaves:
{
  "intro": "2-3 frases apresentando o artista/estilo para um colecionador",
  "bio": "2-3 parágrafos separados por \\n\\n com a história e contexto"
}\
"""


# ── Last.fm helpers ──────────────────────────────────────────────────────────

def _lastfm_get(params: dict) -> dict | None:
    api_key = os.environ.get("LASTFM_API_KEY")
    if not api_key:
        log.warning("LASTFM_API_KEY not set.")
        return None
    params = {**params, "api_key": api_key, "format": "json"}
    url = LASTFM_BASE + "?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except Exception as exc:
        log.debug("Last.fm request failed: %s", exc)
        return None


def fetch_artist_bio(artist_name: str) -> str | None:
    """Returns Last.fm artist wiki content or None if unavailable."""
    data = _lastfm_get({"method": "artist.getInfo", "artist": artist_name, "lang": "en"})
    if not data:
        return None
    try:
        content = data["artist"]["bio"]["content"]
        # Strip the trailing "Read more on Last.fm" anchor Last.fm appends
        content = re.sub(r'\s*<a href="[^"]*">Read more on Last\.fm</a>\.?', "", content)
        return content.strip() or None
    except (KeyError, TypeError):
        return None


def fetch_tag_bio(tag: str) -> str | None:
    """Returns Last.fm tag wiki content or None if unavailable."""
    data = _lastfm_get({"method": "tag.getInfo", "tag": tag, "lang": "en"})
    if not data:
        return None
    try:
        content = data["tag"]["wiki"]["content"]
        content = re.sub(r'\s*<a href="[^"]*">Read more on Last\.fm</a>\.?', "", content)
        return content.strip() or None
    except (KeyError, TypeError):
        return None


# ── Claude helper ────────────────────────────────────────────────────────────

def generate_content(
    source_text: str,
    subject: str,
    kind: str,
    client: anthropic.Anthropic,
) -> tuple[str, str] | None:
    """
    Calls Claude to generate (intro, bio) from the Last.fm source text.
    kind: "artista" or "estilo"
    Returns (intro, bio) or None on failure.
    """
    user_msg = (
        f"Texto fonte do Last.fm sobre o {kind} \"{subject}\":\n\n"
        f"{source_text[:_MAX_SOURCE_CHARS]}\n\n"
        f"Gere o intro e a bio para a página deste {kind} no Garimpa Vinil."
    )
    try:
        message = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1200,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw = message.content[0].text.strip()
        # Strip possible markdown code fences
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)
        intro = data.get("intro", "").strip()
        bio   = data.get("bio", "").strip()
        if not intro or not bio:
            log.warning("Claude returned empty intro or bio for %s.", subject)
            return None
        return intro, bio
    except (json.JSONDecodeError, KeyError, IndexError) as exc:
        log.warning("Claude response parse failed for %s: %s", subject, exc)
        return None
    except Exception as exc:
        log.warning("Claude call failed for %s: %s", subject, exc)
        return None


# ── Main runners ─────────────────────────────────────────────────────────────

def run_artists(conn, client: anthropic.Anthropic, limit: int, dry_run: bool) -> int:
    artists = fetch_artists_needing_bio(conn, limit=limit)
    if not artists:
        log.info("Artists: no pending bios.")
        return 0

    log.info("Artists: %d to process.", len(artists))
    done = 0

    for i, row in enumerate(artists, 1):
        artista = row["artista"]
        log.info("[%d/%d] %s (listeners: %s)", i, len(artists), artista, row["listeners"])

        source = fetch_artist_bio(artista)
        time.sleep(LASTFM_RATE)

        if not source:
            log.info("  Last.fm returned no bio — skipping.")
            continue

        result = generate_content(source, artista, "artista", client)
        time.sleep(CLAUDE_RATE)

        if not result:
            log.info("  Claude generation failed — will retry next run.")
            continue

        intro, bio = result

        if dry_run:
            print(f"\n{'='*60}")
            print(f"ARTISTA: {artista}")
            print(f"\n--- INTRO ---\n{intro}")
            print(f"\n--- BIO ---\n{bio}")
        else:
            saved = save_artist_bio(conn, artista, intro, bio)
            if saved:
                log.info("  Saved OK.")
                done += 1
            else:
                log.warning("  DB save failed — will retry next run.")

    return done


def run_styles(conn, client: anthropic.Anthropic, limit: int, dry_run: bool) -> int:
    tags = fetch_styles_needing_bio(conn, limit=limit)
    if not tags:
        log.info("Styles: no pending bios.")
        return 0

    log.info("Styles: %d to process.", len(tags))
    done = 0

    for i, tag in enumerate(tags, 1):
        log.info("[%d/%d] %s", i, len(tags), tag)

        source = fetch_tag_bio(tag)
        time.sleep(LASTFM_RATE)

        if not source:
            log.info("  Last.fm returned no bio — skipping.")
            # Insert placeholder so it is not re-queued indefinitely
            if not dry_run:
                save_estilo_bio(conn, tag, "", "", None)
            continue

        result = generate_content(source, tag, "estilo", client)
        time.sleep(CLAUDE_RATE)

        if not result:
            log.info("  Claude generation failed — will retry next run.")
            continue

        intro, bio = result

        if dry_run:
            print(f"\n{'='*60}")
            print(f"ESTILO: {tag}")
            print(f"\n--- INTRO ---\n{intro}")
            print(f"\n--- BIO ---\n{bio}")
        else:
            saved = save_estilo_bio(conn, tag, intro, bio, source)
            if saved:
                log.info("  Saved OK.")
                done += 1
            else:
                log.warning("  DB save failed — will retry next run.")

    return done


# ── Entry point ──────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate SEO bio content for artist/style pages.")
    parser.add_argument("--limit", type=int, default=20, help="Max items per run (default: 20)")
    parser.add_argument("--mode", choices=["artists", "styles", "both"], default="both")
    parser.add_argument("--dry-run", action="store_true", help="Print output without saving to DB")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        log.error("ANTHROPIC_API_KEY not set.")
        return

    client = anthropic.Anthropic(api_key=api_key)
    conn = get_connection()

    try:
        ensure_seo_content_schema(conn)

        total = 0
        if args.mode in ("artists", "both"):
            total += run_artists(conn, client, limit=args.limit, dry_run=args.dry_run)
        if args.mode in ("styles", "both"):
            total += run_styles(conn, client, limit=args.limit, dry_run=args.dry_run)

        if args.dry_run:
            print(f"\nDry run complete. Would have saved {total} items.")
        else:
            log.info("Done. Saved %d items.", total)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
