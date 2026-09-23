"""Album-level wrapper over disco_sobre_writer.

A record page is a pressing, not an album, so the same album shows up several
times in the catalogue -- Rumours has six rows, Abbey Road two. The existing
rows written by hand treat that the way the catalogue already does: one text per
album, applied to every pressing of it. `Abbey Road` and `Abbey Road (180g)`
carry byte-identical sobre_pt today.

So the unit of writing is the album and the unit of storage is the slug. This
takes {album_key, text, source_url} and fans each text out to the pressings
named in record_targets.json, then hands the whole lot to disco_sobre_writer,
which keeps its own contract: check everything, write nothing if anything fails,
read back byte for byte, purge only what verified.

Usage:
    from album_sobre_writer import run_albums
    run_albums([{"slugs": [...], "text": ..., "source_url": ...}], apply=True)
"""
from __future__ import annotations

from disco_sobre_writer import run


def run_albums(albums: list[dict], *, apply: bool = True) -> dict:
    """albums: [{"slugs": [slug, ...], "text": str, "source_url": str}, ...]"""
    items, seen = [], set()
    for alb in albums:
        for slug in alb["slugs"]:
            if slug in seen:
                raise ValueError(f"slug appears in two albums: {slug}")
            seen.add(slug)
            items.append({"slug": slug,
                          "text": alb["text"],
                          "source_url": alb["source_url"]})
    print(f"{len(albums)} albums -> {len(items)} record pages")
    return run(items, apply=apply)
