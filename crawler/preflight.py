"""
preflight.py — startup env validation (fail loud, never silently degrade)
───────────────────────────────────────────────────────────────────────────
A missing secret must STOP the run with a clear message and non-zero exit,
not silently fall back to floor/zero behaviour. Called first from main().

Also provides a dependency-free .env loader so local runs pick up crawler/.env
automatically (GitHub Actions injects real env vars; load_dotenv only fills
vars that are NOT already set, so it never overrides CI secrets).
"""
from __future__ import annotations

import os
import sys
import logging

log = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
#  .env loader (no external dependency)
# ─────────────────────────────────────────────────────────────
def load_dotenv_if_present(path: str | None = None) -> bool:
    """Populate os.environ from a KEY=VALUE .env file, without overriding any
    var already set in the real environment. Returns True if a file was read."""
    if path is None:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.isfile(path):
        return False
    for raw in open(path, encoding="utf-8", errors="ignore"):
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val
    return True


# ─────────────────────────────────────────────────────────────
#  Validation
# ─────────────────────────────────────────────────────────────
def _first_set(*names: str) -> str | None:
    for n in names:
        v = os.environ.get(n)
        if v and v.strip():
            return v
    return None


def _check_positive_number(name: str, *, integer: bool) -> str | None:
    """Return an error string if the env var is unset or not a positive number."""
    raw = os.environ.get(name)
    if not raw or not raw.strip():
        return f"{name} is unset or empty"
    try:
        val = int(raw) if integer else float(raw)
    except ValueError:
        kind = "an integer" if integer else "a number"
        return f"{name}={raw!r} is not {kind}"
    if val <= 0:
        return f"{name}={raw!r} must be > 0"
    return None


def check_env(*, require_creators: bool = True) -> None:
    """Validate all required configuration. Raises SystemExit(2) listing every
    problem if anything is missing/invalid. require_creators=False allows a
    discovery-only run (no refresh phases) to start without API credentials."""
    errors: list[str] = []
    warnings: list[str] = []

    # ── Database (refresh + metrics both need it) ──
    if not _first_set("DATABASE_URL"):
        errors.append("DATABASE_URL is unset or empty (Supabase/Postgres connection)")

    # ── Associates tag (Creators API partnerTag + affiliate links) ──
    if not _first_set("ASSOCIATE_TAG", "CREATORS_PARTNER_TAG"):
        errors.append("ASSOCIATE_TAG (or CREATORS_PARTNER_TAG) is unset or empty")

    # ── Revalidation dead-man's switch ──
    if not _first_set("REVALIDATE_URL"):
        errors.append("REVALIDATE_URL is unset or empty (cache purge after crawl)")

    # ── Creators API credentials (refresh path) ──
    if require_creators:
        if not _first_set("CREATORS_CLIENT_ID", "CREATORS_CREDENTIAL_ID"):
            errors.append("CREATORS_CLIENT_ID (or CREATORS_CREDENTIAL_ID) is unset or empty")
        if not _first_set("CREATORS_CLIENT_SECRET", "CREATORS_CREDENTIAL_SECRET"):
            errors.append("CREATORS_CLIENT_SECRET (or CREATORS_CREDENTIAL_SECRET) is unset or empty")

    # ── Rate-limiter knobs (two independent values) ──
    for name in ("CREATORS_TPS", "CREATORS_TPD"):
        # TPS may be fractional; TPD is an integer count.
        err = _check_positive_number(name, integer=(name == "CREATORS_TPD"))
        if err:
            errors.append(err)

    # ── Refresh-migration knobs ──
    err = _check_positive_number("FRESHNESS_FLOOR_MINUTES", integer=True)
    if err:
        errors.append(err)
    err = _check_positive_number("AMAZON_MAX_CONCURRENCY", integer=True)
    if err:
        errors.append(err)

    # ── Proxy: empty is a supported mode (use runner IP) but risky for the
    # storefront scraper, so warn loudly rather than fail. Flip PROXY_REQUIRED=1
    # to promote this to a hard error. ──
    if not _first_set("PROXY_LIST", "PROXY_FILE"):
        msg = "no PROXY_LIST/PROXY_FILE set — discovery scraper will use the runner IP"
        if os.environ.get("PROXY_REQUIRED", "").strip() in ("1", "true", "True"):
            errors.append("PROXY_LIST/PROXY_FILE required (PROXY_REQUIRED=1) but unset")
        else:
            warnings.append(msg)

    for w in warnings:
        log.warning("[preflight] %s", w)

    if errors:
        lines = "\n".join(f"  - {e}" for e in errors)
        sys.stderr.write(
            "\n[preflight] FATAL — required configuration missing/invalid:\n"
            f"{lines}\n"
            "Refusing to start: a missing secret must stop the run, not silently "
            "degrade to floor/zero behaviour. Fix the environment (crawler/.env or "
            "GitHub Actions secrets) and re-run.\n\n"
        )
        raise SystemExit(2)

    log.info("[preflight] env OK — all required configuration present.")


__all__ = ["load_dotenv_if_present", "check_env"]
