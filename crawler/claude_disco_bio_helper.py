"""
claude_disco_bio_helper.py — fetch/save helpers for hand-written (Claude Code) album "Sobre" text.

Album-level counterpart to claude_bio_helper.py. Fetches grounded data (MB
tracklist/genres/release date, existing Last.fm wiki, artist's short bio for
tone continuity), the sobre text is written by Claude Code itself, then saved
back via `save`. Only run `save` for slugs the batch check (sobre_batch_check.py)
placed in the "ready" bucket — vinyl, disponivel, complete tracklist/genres/year.

Usage:
    python claude_disco_bio_helper.py fetch <slug>
        Prints JSON: {"slug", "titulo", "artista", "mb_tracklist", "mb_genres",
                      "mb_first_release_date", "mb_primary_type",
                      "lastfm_wiki_pt", "lastfm_tags", "artist_bio_short"}

    python claude_disco_bio_helper.py save <slug> --sobre-file F [--source-url URL]
        Ensures the sobre_pt/sobre_generated_at columns exist, saves the text.
        --source-url should be the candidate's wiki_url (from
        wikipedia_bio_fetch.py's output JSON) when the bio is grounded on a
        Wikipedia extract -- shown on-page as the "Dados: Wikipedia" credit
        link. Omit only for bios not sourced from a specific URL.
        Prints JSON: {"slug", "saved": true/false}
"""
import argparse
import io
import json
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from database import (
    get_connection,
    fetch_disco_bio_context,
    save_disco_bio,
    ensure_disco_bio_columns,
)


def cmd_fetch(slug: str) -> None:
    conn = get_connection()
    try:
        context = fetch_disco_bio_context(conn, slug)
        if not context:
            print(json.dumps({"slug": slug, "error": "slug_not_found"}))
            return
        print(json.dumps(context, ensure_ascii=False, default=str))
    finally:
        conn.close()


def cmd_save(slug: str, sobre_file: str, source_url: str | None) -> None:
    with open(sobre_file, encoding="utf-8") as f:
        sobre_pt = f.read().strip()

    conn = get_connection()
    try:
        ensure_disco_bio_columns(conn)
        context = fetch_disco_bio_context(conn, slug)
        if not context:
            print(json.dumps({"slug": slug, "error": "slug_not_found"}))
            return
        saved = save_disco_bio(conn, slug, sobre_pt, source_url)
        print(json.dumps({"slug": slug, "saved": saved}, ensure_ascii=False))
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    p_fetch = sub.add_parser("fetch")
    p_fetch.add_argument("slug")

    p_save = sub.add_parser("save")
    p_save.add_argument("slug")
    p_save.add_argument("--sobre-file", required=True)
    p_save.add_argument("--source-url", default=None,
                         help="wiki_url from the bio candidate JSON, shown on-page as the 'Dados: Wikipedia' credit")

    args = parser.parse_args()

    if args.command == "fetch":
        cmd_fetch(args.slug)
    elif args.command == "save":
        cmd_save(args.slug, args.sobre_file, args.source_url)


if __name__ == "__main__":
    main()
