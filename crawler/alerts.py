"""
alerts.py — Price-drop alert email dispatch via Resend REST API.

Called from database.check_alert_crossings(). Uses requests (already a crawler
dep) to POST to Resend directly — no Python Resend SDK needed.
"""
from __future__ import annotations

import os
import logging

import requests

log = logging.getLogger(__name__)

_RESEND_URL = "https://api.resend.com/emails"
_FROM = "Garimpa Vinil Alertas <alertas@mail.garimpavinil.com.br>"
_SITE = "https://www.garimpavinil.com.br"


def _brl(value: float) -> str:
    """Format a float as "R$ 1.234,56" (pt-BR)."""
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def send_price_alert_email(
    *,
    email: str,
    titulo: str,
    disco_slug: str,
    old_price: float | None,
    new_price: float,
    manage_token: str,
) -> bool:
    """
    Send a price-drop alert. Returns True on success.
    Silently logs and returns False on any error so the crawler never stops.
    """
    key = os.environ.get("RESEND_API_KEY")
    if not key:
        log.warning("RESEND_API_KEY not set — skipping alert email for %s", email)
        return False

    product_url = f"{_SITE}/disco/{disco_slug}"
    manage_url = f"{_SITE}/alertas/gerenciar/{manage_token}"
    new_brl = _brl(new_price)
    old_brl = _brl(old_price) if old_price is not None else None

    old_row = (
        f'<p style="color:#888;font-size:13px;margin:0 0 4px 0">Era {old_brl}</p>'
        if old_brl else ""
    )

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Alerta de preço — {titulo}</title></head>
<body style="font-family:sans-serif;background:#1a1a1a;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#242424;border-radius:10px;overflow:hidden;border:1px solid #333">
    <div style="background:#1a1a1a;padding:20px 28px;border-bottom:1px solid #333">
      <span style="color:#c9a84c;font-size:16px;font-weight:bold;letter-spacing:.5px">Garimpa Vinil</span>
    </div>
    <div style="padding:28px">
      <h1 style="color:#f0e6cc;font-size:18px;margin:0 0 6px">O preço baixou</h1>
      <p style="color:#a89070;font-size:14px;margin:0 0 22px">{titulo}</p>
      <div style="background:#1a1a1a;border-radius:8px;padding:18px;text-align:center;margin-bottom:22px;border:1px solid #333">
        {old_row}
        <p style="color:#4caf7a;font-size:26px;font-weight:bold;margin:0">{new_brl}</p>
      </div>
      <a href="{product_url}"
         style="display:block;background:#c9a84c;color:#1a1a1a;text-decoration:none;
                text-align:center;padding:13px;border-radius:6px;font-weight:bold;
                font-size:15px;margin-bottom:22px">
        Ver oferta no Garimpa Vinil
      </a>
      <hr style="border:none;border-top:1px solid #333;margin:0 0 18px">
      <p style="color:#666;font-size:12px;margin:0;text-align:center;line-height:1.6">
        Você recebeu este e-mail porque cadastrou um alerta no Garimpa Vinil.<br>
        <a href="{manage_url}" style="color:#888;text-decoration:underline">Gerenciar ou cancelar alerta</a>
      </p>
    </div>
  </div>
</body>
</html>"""

    text = (
        f"Alerta de preço — Garimpa Vinil\n\n"
        f"O preço de {titulo} baixou para {new_brl}.\n"
        + (f"Era {old_brl}.\n" if old_brl else "")
        + f"\nVer oferta: {product_url}\n"
        f"Gerenciar alerta: {manage_url}\n"
    )

    payload = {
        "from": _FROM,
        "to": [email],
        "subject": f'Preço de "{titulo}" baixou para {new_brl}',
        "html": html,
        "text": text,
    }

    try:
        resp = requests.post(
            _RESEND_URL,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json=payload,
            timeout=15,
        )
        if resp.status_code in (200, 201):
            log.info("Alert email sent → %s | %s | %.2f", email, titulo, new_price)
            return True
        log.warning(
            "Resend HTTP %d for alert → %s: %.200s",
            resp.status_code, email, resp.text,
        )
        return False
    except Exception as exc:
        log.warning("Alert email network error for %s: %s", email, exc)
        return False
