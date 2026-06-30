"""
llm_parse.py — Local-LLM fallback that extracts {artist, album} from a messy
Amazon vinyl title when the regex cleaner (clean_album_title) fails to produce
a Last.fm-matchable name.

Runs against a local Ollama server (no API cost, no network egress).
Forced JSON output keeps the model on rails for this extraction-only task.

Requires Ollama running locally with a text-capable model pulled, e.g.:
    ollama pull qwen2.5:7b
Default model is read from OLLAMA_PARSE_MODEL (falls back to qwen2.5vl:7b,
which is what this box has installed).
"""
import os
import json
import logging
import urllib.request

log = logging.getLogger(__name__)

OLLAMA_URL   = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.environ.get("OLLAMA_PARSE_MODEL", "qwen2.5vl:7b")

_SYSTEM = (
    "You extract the recording artist and the album title from a noisy "
    "vinyl-record product listing. The listing mixes the artist, the album, "
    "and format/edition junk (vinyl, LP, 2LP, signed, booklet, gatefold, "
    "coloured, exclusive, anniversary, remastered, box set). It may repeat or "
    "scramble the artist name. Return ONLY the canonical artist and album, "
    "with the edition junk removed. If you cannot identify a real music album "
    "(e.g. the listing is a non-music product), return empty strings.\n"
    'Respond with JSON only: {"artist": "...", "album": "..."}'
)


def llm_parse_title(raw_title: str, model: str = OLLAMA_MODEL) -> dict | None:
    """
    Returns {"artist": str, "album": str} extracted from raw_title, or None on
    error / empty extraction. Both fields are guaranteed non-empty when a dict
    is returned.
    """
    payload = json.dumps({
        "model":  model,
        "prompt": f"{_SYSTEM}\n\nListing: {raw_title}",
        "format": "json",
        "stream": False,
        "options": {"temperature": 0},
    }).encode()

    req = urllib.request.Request(
        OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            outer = json.loads(resp.read())
        parsed = json.loads(outer.get("response", "") or "{}")
    except Exception as exc:
        log.debug("llm_parse_title failed for %.60r: %s", raw_title, exc)
        return None

    artist = (parsed.get("artist") or "").strip()
    album  = (parsed.get("album") or "").strip()
    if not artist or not album:
        return None
    return {"artist": artist, "album": album}


if __name__ == "__main__":
    # Smoke test with the user's reference example.
    sample = ("New Road Black Country Black Country New Road Forever Howlong "
              "Exclusive Vinyl 2LP Signed Cover, 20-page colour booklet")
    print(llm_parse_title(sample))
