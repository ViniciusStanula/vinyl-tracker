#!/usr/bin/env python3
"""
bot.py — Reads bot_pending from Supabase and dispatches deals to a Telegram channel.

Drip strategy: at most one message per 30 minutes, within 08:00–22:00 Sao Paulo time.
Edit pass: silently updates captions for already-sent deals whose price dropped ≥5%.
Send pass: picks the highest-priority pending deal and sends it as a new photo message.
"""

import logging
import os
import re
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import psycopg2
import psycopg2.extras
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger(__name__)

DATABASE_URL      = os.environ.get("DATABASE_URL")
BOT_TOKEN         = os.environ.get("TELEGRAM_BOT_TOKEN")
CHANNEL_ID        = os.environ.get("TELEGRAM_CHANNEL_ID")

SAO_PAULO         = ZoneInfo("America/Sao_Paulo")
SEND_HOUR_START   = 8
SEND_HOUR_END     = 22
DRIP_MINUTES      = 20
EDIT_THRESHOLD    = 0.95   # edit if current price < ref * 0.95 (≥5% drop)
RESEND_THRESHOLD  = 0.90   # bridge re-opens at this level; bot just sends normally

TG_API = f"https://api.telegram.org/bot{BOT_TOKEN}"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def connect() -> psycopg2.extensions.connection:
    if not DATABASE_URL:
        log.error("DATABASE_URL not set")
        sys.exit(1)
    try:
        conn = psycopg2.connect(DATABASE_URL, connect_timeout=10)
        conn.autocommit = False
        return conn
    except psycopg2.OperationalError as exc:
        log.error("DB connection failed: %s", exc)
        sys.exit(1)


def get_last_sent_at(conn) -> datetime | None:
    with conn.cursor() as cur:
        cur.execute("SELECT value FROM bot_state WHERE key = 'last_sent_at'")
        row = cur.fetchone()
    if not row:
        return None
    return datetime.fromisoformat(row[0])


def set_last_sent_at(conn) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO bot_state (key, value) VALUES ('last_sent_at', %s)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        """, (now_iso,))
    conn.commit()


# ---------------------------------------------------------------------------
# Telegram API
# ---------------------------------------------------------------------------

def _tg(endpoint: str, payload: dict) -> dict | None:
    try:
        resp = requests.post(f"{TG_API}/{endpoint}", json=payload, timeout=30)
    except requests.RequestException as exc:
        log.error("Telegram %s error: %s", endpoint, exc)
        return None
    if not resp.ok:
        log.error("Telegram %s failed (%s): %s", endpoint, resp.status_code, resp.text)
        return None
    return resp.json().get("result")


def send_photo(photo_url: str, caption: str) -> int | None:
    """Send photo by URL; falls back to download+upload if URL is rejected."""
    result = _tg("sendPhoto", {
        "chat_id":    CHANNEL_ID,
        "photo":      photo_url,
        "caption":    caption,
        "parse_mode": "MarkdownV2",
    })
    if result:
        return result.get("message_id")

    # Fallback: download image and upload as multipart
    log.warning("URL-based sendPhoto failed, attempting upload fallback")
    try:
        img = requests.get(photo_url, timeout=15)
        img.raise_for_status()
    except requests.RequestException as exc:
        log.error("Image download failed: %s", exc)
        return None
    try:
        resp = requests.post(
            f"{TG_API}/sendPhoto",
            data={"chat_id": CHANNEL_ID, "caption": caption, "parse_mode": "MarkdownV2"},
            files={"photo": ("cover.jpg", img.content, "image/jpeg")},
            timeout=60,
        )
    except requests.RequestException as exc:
        log.error("sendPhoto upload failed: %s", exc)
        return None
    if resp.ok:
        return resp.json()["result"].get("message_id")
    log.error("sendPhoto upload failed (%s): %s", resp.status_code, resp.text)
    return None


def edit_caption(message_id: int, caption: str) -> bool:
    result = _tg("editMessageCaption", {
        "chat_id":    CHANNEL_ID,
        "message_id": message_id,
        "caption":    caption,
        "parse_mode": "MarkdownV2",
    })
    return result is not None


# ---------------------------------------------------------------------------
# Caption formatting
# ---------------------------------------------------------------------------

_MD_ESCAPE = re.compile(r'([_*\[\]()~`>#+\-=|{}.!\\])')


def _esc(value) -> str:
    """Escape a value for Telegram MarkdownV2."""
    return _MD_ESCAPE.sub(r'\\\1', str(value))


def build_caption(titulo: str, artista: str, estilo: str | None,
                  preco_brl: float, avg_30d: float | None,
                  low_all_time: float | None, affiliate_url: str) -> str:
    genre = _esc(estilo or "Vinil")

    if avg_30d and avg_30d > preco_brl:
        pct = round((avg_30d - preco_brl) / avg_30d * 100)
        price_line = (
            f"💸 *{_esc(pct)}% abaixo da média* — "
            f"de R\\${_esc(f'{avg_30d:.2f}')} por R\\${_esc(f'{preco_brl:.2f}')}\n"
        )
    else:
        price_line = f"💸 R\\${_esc(f'{preco_brl:.2f}')}\n"

    atl_badge = ""
    if low_all_time is not None and preco_brl <= float(low_all_time):
        atl_badge = "🏆 Menor preço histórico\\!\n"

    return (
        f"🎵 *{_esc(titulo)}* — {_esc(artista)}\n"
        f"💿 Gênero: {genre}\n\n"
        f"{price_line}"
        f"{atl_badge}"
        f"\n🛒 [Comprar na Amazon]({affiliate_url})"
    )


# ---------------------------------------------------------------------------
# Send-window and drip control
# ---------------------------------------------------------------------------

def within_send_window() -> bool:
    hour = datetime.now(SAO_PAULO).hour
    return SEND_HOUR_START <= hour < SEND_HOUR_END


def minutes_since_last_send(conn) -> float:
    last = get_last_sent_at(conn)
    if last is None:
        return float("inf")
    # Ensure last is timezone-aware
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - last
    return delta.total_seconds() / 60


# ---------------------------------------------------------------------------
# Edit pass: update captions for already-sent deals with meaningful price drops
# ---------------------------------------------------------------------------

def run_edit_pass(conn) -> None:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT
                bp.asin,
                bp.titulo,
                bp.artista,
                bp.estilo,
                bp.affiliate_url,
                bp.preco_brl,
                bp.avg_30d,
                bp.low_all_time,
                ls.sent_row_id,
                ls.telegram_message_id,
                ls.ref_price
            FROM bot_pending bp
            JOIN (
                SELECT DISTINCT ON (asin)
                    id                                       AS sent_row_id,
                    asin,
                    telegram_message_id,
                    COALESCE(last_edit_price, preco_brl)    AS ref_price
                FROM bot_sent
                ORDER BY asin, sent_at DESC
            ) ls ON ls.asin = bp.asin
            WHERE bp.status IN ('sent', 'pending')
              AND bp.preco_brl < ls.ref_price * %s
        """, (EDIT_THRESHOLD,))
        candidates = cur.fetchall()

    for row in candidates:
        caption = build_caption(
            row["titulo"], row["artista"], row["estilo"],
            float(row["preco_brl"]),
            float(row["avg_30d"]) if row["avg_30d"] else None,
            float(row["low_all_time"]) if row["low_all_time"] else None,
            row["affiliate_url"],
        )
        if edit_caption(int(row["telegram_message_id"]), caption):
            now = datetime.now(timezone.utc)
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE bot_sent
                    SET last_edited_at = %s, last_edit_price = %s
                    WHERE id = %s
                """, (now, float(row["preco_brl"]), row["sent_row_id"]))
            conn.commit()
            log.info("Edited message %d for ASIN %s → R$%.2f",
                     row["telegram_message_id"], row["asin"], float(row["preco_brl"]))


# ---------------------------------------------------------------------------
# Send pass: pick top-priority pending deal and send it
# ---------------------------------------------------------------------------

def _send_one(conn, deal: dict) -> bool:
    """Attempt to send a single deal. Returns True on success."""
    asin  = deal["asin"]
    price = float(deal["preco_brl"])

    # Dedup: check most recent send for this ASIN
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT sent_at,
                   COALESCE(last_edit_price, preco_brl) AS ref_price
            FROM bot_sent
            WHERE asin = %s
            ORDER BY sent_at DESC
            LIMIT 1
        """, (asin,))
        last_sent = cur.fetchone()

    if last_sent:
        last_sent = dict(last_sent)
        sent_at = last_sent["sent_at"]
        if sent_at.tzinfo is None:
            sent_at = sent_at.replace(tzinfo=timezone.utc)

        sent_sp_date = sent_at.astimezone(SAO_PAULO).date()
        now_sp_date  = datetime.now(SAO_PAULO).date()

        if sent_sp_date == now_sp_date:
            ref  = float(last_sent["ref_price"])
            drop = (ref - price) / ref if ref > 0 else 0
            if drop < 0.10:
                # Sent today at a similar price — discard silently
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE bot_pending SET status = 'discarded' WHERE asin = %s",
                        (asin,),
                    )
                conn.commit()
                log.info("ASIN %s sent today at similar price, discarded", asin)
                return False  # don't count as a send; caller will try next deal

    caption = build_caption(
        deal["titulo"], deal["artista"], deal.get("estilo"),
        price,
        float(deal["avg_30d"]) if deal["avg_30d"] else None,
        float(deal["low_all_time"]) if deal["low_all_time"] else None,
        deal["affiliate_url"],
    )

    img_url    = deal.get("img_url") or ""
    message_id = send_photo(img_url, caption) if img_url else None

    if not message_id:
        log.error("Failed to send ASIN %s — will retry next run", asin)
        return False

    now = datetime.now(timezone.utc)
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO bot_sent (asin, sent_at, preco_brl, telegram_message_id)
            VALUES (%s, %s, %s, %s)
        """, (asin, now, price, message_id))
        cur.execute(
            "UPDATE bot_pending SET status = 'sent' WHERE asin = %s", (asin,)
        )
    conn.commit()
    set_last_sent_at(conn)
    log.info("Sent ASIN %s — R$%.2f — message_id=%d", asin, price, message_id)
    return True


def run_send_pass(conn, batch_size: int = 5) -> None:
    """Send up to batch_size deals, prioritizing top artists then highest discount."""
    sent = 0
    # Track ASINs already processed this batch to avoid re-querying same row
    # after a discard (which doesn't consume a send slot but advances the queue).
    skip_asins: list[str] = []

    while sent < batch_size:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if skip_asins:
                cur.execute("""
                    SELECT *
                    FROM bot_pending
                    WHERE status = 'pending'
                      AND asin <> ALL(%s)
                    ORDER BY is_top_artist DESC NULLS LAST,
                             priority_score  DESC NULLS LAST
                    LIMIT 1
                """, (skip_asins,))
            else:
                cur.execute("""
                    SELECT *
                    FROM bot_pending
                    WHERE status = 'pending'
                    ORDER BY is_top_artist DESC NULLS LAST,
                             priority_score  DESC NULLS LAST
                    LIMIT 1
                """)
            deal = cur.fetchone()

        if not deal:
            log.info("No more pending deals (sent %d this batch)", sent)
            break

        deal = dict(deal)
        success = _send_one(conn, deal)
        if success:
            sent += 1
        else:
            # Discarded or failed — skip this ASIN and try the next one,
            # but only if we haven't hit the batch limit yet.
            skip_asins.append(deal["asin"])

    if sent == 0:
        log.info("No deals sent this batch")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if not BOT_TOKEN or not CHANNEL_ID:
        log.error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID are required")
        sys.exit(1)

    if not within_send_window():
        log.info("Outside send window (%02d:00–%02d:00 SP), exiting",
                 SEND_HOUR_START, SEND_HOUR_END)
        return

    conn = connect()
    try:
        run_edit_pass(conn)

        mins = minutes_since_last_send(conn)
        if mins < DRIP_MINUTES:
            log.info("%.1f min since last send (need %d min), skipping send pass",
                     mins, DRIP_MINUTES)
            return

        run_send_pass(conn)

    except Exception as exc:
        log.error("Bot error: %s", exc)
        try:
            conn.rollback()
        except Exception:
            pass
    finally:
        conn.close()


if __name__ == "__main__":
    main()
