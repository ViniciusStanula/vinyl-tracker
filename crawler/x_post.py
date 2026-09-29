#!/usr/bin/env python3
"""
x_post.py — Posts the best current deals to X (@garimpa_vinil) through Buffer's API.

X's own API charges per post ($0.20 with a link); Buffer's free plan posts
through Buffer's integration instead. Free-plan limits are 250 requests/day and
3,000/30 days, and this runs every ~15 min, so Buffer is only called when a post
is actually due, and the channel id is cached in bot_state.

Cadence: at most X_POSTS_PER_DAY posts per Sao Paulo day, X_GAP_MINUTES apart,
inside the same 08:00–22:00 window as the Telegram bot. Picks the highest
priority_score deal (see bridge.priority_for) not posted to X in X_REPOST_DAYS.
Tweets cannot be edited, so there is no edit / sold-out pass like bot.py has.

On SPECIAL_DAYS the day's first post is a roundup of current deals instead of a
single deal: top 5 (Sunday), records at their all-time low (Wednesday), or a
"which one would you play first?" question meant to draw replies (Friday).

Usage:
    python x_post.py            # post if one is due
    python x_post.py --dry-run  # print the next post's text, no Buffer call
    python x_post.py --dry-run --kind top5|atl|question  # preview a roundup
"""

import logging
import os
import sys
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
import requests

from bot import (
    ATL_TOLERANCE, SAO_PAULO, SITE_URL, _brl, _clean_titulo, _hashtags,
    connect, within_send_window,
)

log = logging.getLogger(__name__)

BUFFER_API_KEY  = os.environ.get("BUFFER_API_KEY")
BUFFER_API      = "https://api.buffer.com"

X_POSTS_PER_DAY = 5
X_GAP_MINUTES   = 150
X_REPOST_DAYS   = 30
X_MAX_CHARS     = 280
X_URL_CHARS     = 23   # X counts every link as 23 chars (t.co)
SYNC_MAX_AGE_MINUTES = 10  # bridge.py runs a few seconds earlier in the same job
X_MAX_IMAGES    = 4   # also the roundup size, so list item N is image N
ROUNDUP_REPEAT_DAYS = 6  # a record appears in at most one roundup per week

# Sao Paulo weekday (Mon=0) -> roundup posted as that day's first post.
SPECIAL_DAYS    = {6: "top5", 2: "atl", 4: "question"}

_SCHEMA = """
CREATE TABLE IF NOT EXISTS bot_x_sent (
    id             SERIAL PRIMARY KEY,
    asin           TEXT NOT NULL,
    sent_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    preco_brl      DECIMAL(10,2) NOT NULL,
    buffer_post_id TEXT
);
CREATE INDEX IF NOT EXISTS bot_x_sent_asin_idx ON bot_x_sent (asin, sent_at DESC);
-- Roundup posts cover several records, so they have no single asin/price.
ALTER TABLE bot_x_sent ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'deal';
ALTER TABLE bot_x_sent ALTER COLUMN asin DROP NOT NULL;
ALTER TABLE bot_x_sent ALTER COLUMN preco_brl DROP NOT NULL;
ALTER TABLE bot_x_sent ADD COLUMN IF NOT EXISTS roundup_asins TEXT[];
"""


# ---------------------------------------------------------------------------
# Post text
# ---------------------------------------------------------------------------

def build_text(deal: dict) -> str:
    price = float(deal["preco_brl"])
    avg   = float(deal["avg_30d"])
    pct   = round((avg - price) / avg * 100)
    low   = deal.get("low_all_time")
    # Links to the album page on the site (price history + buy button), not
    # straight to Amazon.
    url   = f"{SITE_URL}/disco/{deal['slug']}"

    price_line = f"💿 R$ {_brl(price)} ({pct}% abaixo da média de 30 dias)"
    atl_line   = "🏆 Menor preço histórico\n" if low is not None and price <= float(low) * ATL_TOLERANCE else ""
    tags       = " ".join(t for t in (_hashtags(deal.get("estilo")), "#vinil") if t)

    def render(album: str) -> str:
        return (
            f"🔥 {deal['artista']} — {album}\n"
            f"{atl_line}"
            f"{price_line}\n\n"
            f"{tags}\n"
            f"{url}"
        )

    album = _clean_titulo(deal["titulo"])
    # Trim the album title if the post would exceed X's limit (link counts as 23).
    overflow = len(render(album)) - len(url) + X_URL_CHARS - X_MAX_CHARS
    if overflow > 0:
        album = album[: max(len(album) - overflow - 1, 10)].rstrip() + "…"
    return render(album)


def _x_len(text: str) -> int:
    """Length as X counts it: links are 23 chars, emoji and CJK count double."""
    n = 0
    for line in text.split("\n"):
        for w in line.split(" "):
            if w.startswith("https://"):
                n += X_URL_CHARS
            else:
                n += sum(2 if ord(ch) > 0x10FF else 1 for ch in w)
        n += line.count(" ") + 1
    return n - 1


def build_roundup_text(kind: str, deals: list[dict]) -> str:
    url = f"{SITE_URL}/ofertas"
    header = {
        "top5":     "🔥 As melhores ofertas de vinil da semana",
        "atl":      "🏆 No menor preço histórico esta semana",
        "question": "Qual desses você colocaria pra tocar primeiro? 👇",
    }[kind]
    footer = f"Todos em oferta: {url}" if kind == "question" else f"#vinil\n{url}"

    def line(i: int, d: dict, cap: int) -> str:
        album = _clean_titulo(d["titulo"])
        if len(album) > cap:
            album = album[: max(cap - 1, 0)].rstrip() + "…"
        name = f"{d['artista']} — {album}" if cap else d["artista"]
        if kind == "question":
            return f"{i}. {name}"
        price, avg = float(d["preco_brl"]), float(d["avg_30d"])
        return f"{i}. {name}: R$ {round(price)} (-{round((avg - price) / avg * 100)}%)"

    # Shorten album titles until the post fits; artist-only as the last resort.
    for cap in (40, 30, 22, 15, 0):
        lines = "\n".join(line(i, d, cap) for i, d in enumerate(deals, 1))
        text = f"{header}\n\n{lines}\n\n{footer}"
        if _x_len(text) <= X_MAX_CHARS:
            break
    return text


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def post_is_due(conn) -> bool:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                COUNT(*) FILTER (
                    WHERE (sent_at AT TIME ZONE 'America/Sao_Paulo')::date
                        = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
                ),
                MAX(sent_at)
            FROM bot_x_sent
        """)
        today, last = cur.fetchone()
    if today >= X_POSTS_PER_DAY:
        log.info("X: %d posts today (cap %d), skipping", today, X_POSTS_PER_DAY)
        return False
    if last is not None:
        mins = (datetime.now(timezone.utc) - last).total_seconds() / 60
        if mins < X_GAP_MINUTES:
            log.info("X: %.0f min since last post (need %d), skipping", mins, X_GAP_MINUTES)
            return False
    return True


def pick_deal(conn) -> dict | None:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT bp.*
            FROM bot_pending bp
            -- Only rows bridge.py refreshed in this job: anything older is a
            -- deal that's no longer active, with a frozen price.
            WHERE bp.synced_at > NOW() - make_interval(mins => %s)
              AND bp.img_url IS NOT NULL AND bp.img_url <> ''
              AND bp.slug IS NOT NULL AND bp.slug <> ''
              AND bp.avg_30d > bp.preco_brl
              AND NOT EXISTS (
                  SELECT 1 FROM bot_x_sent x
                  WHERE x.asin = bp.asin
                    AND x.sent_at > NOW() - make_interval(days => %s)
              )
            ORDER BY bp.priority_score DESC NULLS LAST
            LIMIT 1
        """, (SYNC_MAX_AGE_MINUTES, X_REPOST_DAYS))
        row = cur.fetchone()
    return dict(row) if row else None


def special_due(conn) -> str | None:
    """Today's roundup kind, unless it already went out today."""
    kind = SPECIAL_DAYS.get(datetime.now(SAO_PAULO).weekday())
    if kind is None:
        return None
    with conn.cursor() as cur:
        cur.execute("""
            SELECT 1 FROM bot_x_sent
            WHERE kind = %s
              AND (sent_at AT TIME ZONE 'America/Sao_Paulo')::date
                = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
        """, (kind,))
        return None if cur.fetchone() else kind


def pick_roundup(conn, kind: str) -> list[dict]:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT bp.*
            FROM bot_pending bp
            WHERE bp.synced_at > NOW() - make_interval(mins => %s)
              AND bp.img_url IS NOT NULL AND bp.img_url <> ''
              AND bp.avg_30d > bp.preco_brl
              AND (NOT %s OR bp.preco_brl <= bp.low_all_time * %s)
              AND NOT EXISTS (
                  SELECT 1 FROM bot_x_sent x
                  WHERE bp.asin = ANY(x.roundup_asins)
                    AND x.sent_at > NOW() - make_interval(days => %s)
              )
            ORDER BY bp.priority_score DESC NULLS LAST
            LIMIT %s
        """, (SYNC_MAX_AGE_MINUTES, kind == "atl", ATL_TOLERANCE,
              ROUNDUP_REPEAT_DAYS, X_MAX_IMAGES))
        return [dict(r) for r in cur.fetchall()]


def _state(conn, key: str) -> str | None:
    with conn.cursor() as cur:
        cur.execute("SELECT value FROM bot_state WHERE key = %s", (key,))
        row = cur.fetchone()
    return row[0] if row else None


def _set_state(conn, key: str, value: str) -> None:
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO bot_state (key, value) VALUES (%s, %s)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        """, (key, value))
    conn.commit()


# ---------------------------------------------------------------------------
# Buffer API
# ---------------------------------------------------------------------------

def _gql(query: str, variables: dict | None = None) -> dict:
    resp = requests.post(
        BUFFER_API,
        json={"query": query, "variables": variables or {}},
        headers={"Authorization": f"Bearer {BUFFER_API_KEY}"},
        timeout=30,
    )
    for h in resp.headers.get("RateLimit", "").split(","):
        if h.strip():
            log.info("Buffer rate limit: %s", h.strip())
    resp.raise_for_status()
    body = resp.json()
    if body.get("errors"):
        raise RuntimeError(f"Buffer GraphQL errors: {body['errors']}")
    return body["data"]


def x_channel_id(conn) -> str:
    cached = _state(conn, "buffer_x_channel_id")
    if cached:
        return cached
    orgs = _gql("query { account { organizations { id } } }")["account"]["organizations"]
    for org in orgs:
        channels = _gql(
            "query($org: OrganizationId!) { channels(input: {organizationId: $org}) { id service name } }",
            {"org": org["id"]},
        )["channels"]
        for ch in channels:
            if ch["service"].lower() in ("twitter", "x"):
                log.info("Buffer X channel: %s (@%s)", ch["id"], ch["name"])
                _set_state(conn, "buffer_x_channel_id", ch["id"])
                return ch["id"]
    raise RuntimeError("No X channel connected in Buffer")


def create_post(channel_id: str, text: str, img_urls: list[str]) -> str:
    data = _gql("""
        mutation($input: CreatePostInput!) {
            createPost(input: $input) {
                ... on PostActionSuccess { post { id } }
                ... on MutationError { message }
            }
        }
    """, {"input": {
        "channelId":      channel_id,
        "text":           text,
        "schedulingType": "automatic",
        "mode":           "shareNow",
        "assets":         [{"image": {"url": u}} for u in img_urls[:X_MAX_IMAGES]],
    }})
    result = data["createPost"]
    if "post" not in result:
        raise RuntimeError(f"Buffer createPost failed: {result.get('message')}")
    return result["post"]["id"]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    dry_run = "--dry-run" in sys.argv
    forced_kind = sys.argv[sys.argv.index("--kind") + 1] if "--kind" in sys.argv else None

    if not dry_run and not BUFFER_API_KEY:
        log.error("BUFFER_API_KEY is required")
        sys.exit(1)
    if not dry_run and not within_send_window():
        log.info("X: outside send window, exiting")
        return

    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(_SCHEMA)
        conn.commit()

        if not dry_run and not post_is_due(conn):
            return

        kind = forced_kind or special_due(conn)
        if kind:
            deals = pick_roundup(conn, kind)
            # Too few records for a list (e.g. no all-time lows this week):
            # fall back to a normal single-deal post.
            if len(deals) < 3:
                log.info("X: only %d records for %s roundup, posting a single deal", len(deals), kind)
                kind = None
        if kind:
            text = build_roundup_text(kind, deals)
            if dry_run:
                print(text)
                return
            post_id = create_post(x_channel_id(conn), text, [d["img_url"] for d in deals])
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO bot_x_sent (kind, roundup_asins, buffer_post_id) VALUES (%s, %s, %s)",
                    (kind, [d["asin"] for d in deals], post_id),
                )
            conn.commit()
            log.info("X: posted %s roundup (%d records) — buffer post %s", kind, len(deals), post_id)
            return

        deal = pick_deal(conn)
        if not deal:
            log.info("X: no eligible deal")
            return

        text = build_text(deal)
        if dry_run:
            print(text)
            return

        post_id = create_post(x_channel_id(conn), text, [deal["img_url"]])
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO bot_x_sent (asin, preco_brl, buffer_post_id) VALUES (%s, %s, %s)",
                (deal["asin"], float(deal["preco_brl"]), post_id),
            )
        conn.commit()
        log.info("X: posted ASIN %s — R$%.2f — buffer post %s",
                 deal["asin"], float(deal["preco_brl"]), post_id)
    except Exception as exc:
        log.error("X post error: %s", exc)
        try:
            conn.rollback()
        except Exception:
            pass
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
