"""
creators_api.py — Amazon Creators API client (LWA auth + getItems/OffersV2)
───────────────────────────────────────────────────────────────────────────
ISOLATED, NET-NEW MODULE. Nothing in the existing crawler pipeline imports or
calls this yet. No database access. Built for the Phase-2 refresh migration
(item 2, step 1): a standalone client exercised by a test harness against live
credentials.

Successor to PA-API v5 (retired 2026-05-15). Auth is Login with Amazon (OAuth2
client-credentials → bearer token), NOT AWS SigV4. Request shape is lowerCamelCase
JSON. getItems accepts up to 10 ASINs/call; live price + Prime come from OffersV2.

Everything environment-shaped — no hardcoded credentials, IDs, region, or
marketplace. Resource-string casing, the Brazil marketplace value, and the Prime
field path are config-overridable because the live response is the source of
truth; the harness dumps raw JSON so we confirm exact paths before mapping to DB
in a later step.

Docs: https://affiliate-program.amazon.com/creatorsapi/docs/

Dependencies: requests (already in requirements.txt). No new deps.
"""
from __future__ import annotations

import os
import time
import base64
import random
import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone

import requests

log = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
#  Config (env-driven; hardcode nothing)
# ─────────────────────────────────────────────────────────────
def _env(*names: str, default: str | None = None) -> str | None:
    """Return the first set env var among names (supports credential aliases)."""
    for n in names:
        v = os.environ.get(n)
        if v:
            return v
    return default


# Default resources requested from getItems. These are exact members of the live
# getItems resource enum (lowerCamelCase), confirmed against amazon.com.br.
# Overridable via CREATORS_RESOURCES (comma-separated). NOTE: there is no Prime /
# deliveryInfo resource in the enum — Prime status is not available via this API.
_DEFAULT_RESOURCES = [
    "offersV2.listings.price",
    "offersV2.listings.availability",
    "offersV2.listings.condition",
    "offersV2.listings.merchantInfo",
    "offersV2.listings.isBuyBoxWinner",
    "offersV2.listings.dealDetails",
    "itemInfo.title",
    # EAN/UPC. Verified live against amazon.com.br (B09D8CGM5V returns
    # eans.displayValues ["0602438167913"] + upcs.displayValues). Free to add:
    # Phase-0/3 refresh already calls getItems for these ASINs, so this rides
    # along on existing calls and costs no extra TPS/TPD budget.
    #
    # Worth having because a barcode identifies the exact PRESSING. Our
    # MusicBrainz match is only release-group level (the abstract album), which
    # cannot tell a 1972 original from a 2025 reissue -- Genesis "Foxtrot" alone
    # spans 38 pressings across 11 labels. A barcode resolves that, and is also
    # the correct value for schema.org gtin13.
    "itemInfo.externalIds",
    "customerReviews.count",       # accepted by API; returned empty for sampled BR ASINs
    "customerReviews.starRating",  # accepted by API; returned empty for sampled BR ASINs
]


@dataclass
class CreatorsConfig:
    client_id:     str
    client_secret: str
    partner_tag:   str
    marketplace:   str
    token_url:     str
    api_base:      str
    scope:         str
    tps:           float
    tpd:           int
    tpd_per_run:   int
    # v2.x credentials need "Version <n>" in the Authorization header plus an
    # x-marketplace header. v3.x (new LWA creds) do not. Leave unset for v3.x.
    credential_version: str | None
    resources:     list[str] = field(default_factory=lambda: list(_DEFAULT_RESOURCES))

    @classmethod
    def from_env(cls) -> "CreatorsConfig":
        client_id = _env("CREATORS_CLIENT_ID", "CREATORS_CREDENTIAL_ID")
        client_secret = _env("CREATORS_CLIENT_SECRET", "CREATORS_CREDENTIAL_SECRET")
        partner_tag = _env("CREATORS_PARTNER_TAG", "ASSOCIATE_TAG")
        if not client_id or not client_secret:
            raise RuntimeError(
                "Missing credentials: set CREATORS_CLIENT_ID (or CREATORS_CREDENTIAL_ID) "
                "and CREATORS_CLIENT_SECRET (or CREATORS_CREDENTIAL_SECRET)."
            )
        if not partner_tag:
            raise RuntimeError("Missing partner tag: set CREATORS_PARTNER_TAG or ASSOCIATE_TAG.")

        tps = float(_env("CREATORS_TPS", default="1") or "1")
        tpd = int(_env("CREATORS_TPD", default="8640") or "8640")
        # Per-RUN cap. Keeps a single (now-concurrent) run from draining the whole
        # day budget and starving later runs' Phase-0 deal revalidation. Default
        # leaves >= one run's worth of day budget free for each of ~8 daily runs.
        tpd_per_run = int(_env("CREATORS_TPD_PER_RUN", default="1000") or "1000")

        resources_env = _env("CREATORS_RESOURCES")
        resources = (
            [r.strip() for r in resources_env.split(",") if r.strip()]
            if resources_env else list(_DEFAULT_RESOURCES)
        )

        return cls(
            client_id=client_id,
            client_secret=client_secret,
            partner_tag=partner_tag,
            # PA-API used "www.amazon.com.br" for Brazil; confirm against live response.
            marketplace=_env("CREATORS_MARKETPLACE", default="www.amazon.com.br"),
            token_url=_env("CREATORS_TOKEN_URL", default="https://api.amazon.com/auth/o2/token"),
            api_base=_env("CREATORS_API_BASE", default="https://creatorsapi.amazon/catalog/v1"),
            scope=_env("CREATORS_SCOPE", default="creatorsapi::default"),
            tps=tps,
            tpd=tpd,
            tpd_per_run=tpd_per_run,
            credential_version=_env("CREATORS_CREDENTIAL_VERSION"),
            resources=resources,
        )


# ─────────────────────────────────────────────────────────────
#  Token manager (thread-safe, cached, refresh-on-401)
# ─────────────────────────────────────────────────────────────
class BudgetExhausted(RuntimeError):
    """Raised when the per-credential daily request budget is spent."""


class TokenManager:
    """
    Caches the LWA bearer token until shortly before expiry. Thread-safe:
    concurrent workers share one token rather than each minting their own.
    """

    # Refresh this many seconds before the stated expiry to avoid using a token
    # that expires mid-flight.
    _SKEW_S = 60

    def __init__(self, cfg: CreatorsConfig, session: requests.Session | None = None) -> None:
        self._cfg = cfg
        self._session = session or requests.Session()
        self._lock = threading.Lock()
        self._token: str | None = None
        self._expires_at: float = 0.0
        self.last_expires_in: int | None = None  # exposed for the lifecycle report

    def get_token(self, force: bool = False) -> str:
        with self._lock:
            now = time.monotonic()
            if (not force) and self._token and now < self._expires_at - self._SKEW_S:
                return self._token
            return self._refresh_locked()

    def invalidate(self) -> None:
        """Drop the cached token so the next get_token() re-mints (used on 401)."""
        with self._lock:
            self._token = None
            self._expires_at = 0.0

    def _refresh_locked(self) -> str:
        basic = base64.b64encode(
            f"{self._cfg.client_id}:{self._cfg.client_secret}".encode()
        ).decode()
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {basic}",
        }
        body = {"grant_type": "client_credentials", "scope": self._cfg.scope}
        t0 = time.monotonic()
        resp = self._session.post(self._cfg.token_url, headers=headers, data=body, timeout=15)
        if resp.status_code != 200:
            raise RuntimeError(
                f"LWA token request failed: HTTP {resp.status_code} — {resp.text[:300]}"
            )
        data = resp.json()
        token = data.get("access_token")
        expires_in = int(data.get("expires_in", 3600))
        if not token:
            raise RuntimeError(f"LWA token response missing access_token: {data}")
        self._token = token
        self._expires_at = t0 + expires_in
        self.last_expires_in = expires_in
        log.info("LWA token minted — expires_in=%ds (token_type=%s)",
                 expires_in, data.get("token_type"))
        return token


# ─────────────────────────────────────────────────────────────
#  Rate limiter — two independent knobs, per-credential, shared
# ─────────────────────────────────────────────────────────────
class _TokenBucket:
    """Thread-safe token bucket for instantaneous rate (TPS). Steady cadence:
    acquire() blocks until a token is available rather than bursting."""

    def __init__(self, rate_per_s: float) -> None:
        self._rate = max(rate_per_s, 0.001)
        # Small capacity keeps a steady cadence; never a big burst reservoir.
        self._capacity = max(1.0, rate_per_s)
        self._tokens = self._capacity
        self._last = time.monotonic()
        self._lock = threading.Lock()

    def acquire(self) -> float:
        """Block until a token is free. Returns seconds waited."""
        waited = 0.0
        while True:
            with self._lock:
                now = time.monotonic()
                self._tokens = min(self._capacity, self._tokens + (now - self._last) * self._rate)
                self._last = now
                if self._tokens >= 1.0:
                    self._tokens -= 1.0
                    return waited
                deficit = 1.0 - self._tokens
                sleep_for = deficit / self._rate
            waited += sleep_for
            time.sleep(sleep_for)

    def throttle_down(self, factor: float = 0.5, floor: float = 0.1) -> float:
        """Adaptively lower the fill rate (on 429s) so we ease off below the
        configured TPS. Never raises the rate. Returns the new rate.
        Lowering the rate only slows token refill, so the <=TPS guarantee holds."""
        with self._lock:
            self._rate = max(floor, self._rate * factor)
            return self._rate

    def recover(self, ceiling: float, factor: float = 1.25) -> float:
        """Gently restore the fill rate toward (never above) the configured TPS
        after sustained success. Returns the new rate."""
        with self._lock:
            self._rate = min(ceiling, self._rate * factor)
            return self._rate


class _DailyBudget:
    """Thread-safe request counter with a hard ceiling. Resets at UTC midnight.
    Counts every HTTP request (including retries), matching how Amazon meters.

    Used for two distinct ceilings:
      - the per-process DAY budget, seeded with ``initial_used`` from a shared
        cross-run ledger so the true UTC-day cap holds across serialized runs;
      - a plain per-RUN cap (initial_used=0, no seeding) that bounds a single
        run so concurrency can't drain the whole day budget in one process and
        starve later runs' Phase-0 deal revalidation.
    """

    def __init__(self, limit: int, initial_used: int = 0) -> None:
        self._limit = limit
        self._lock = threading.Lock()
        self._day = datetime.now(timezone.utc).date()
        self._used = initial_used

    def _roll_if_needed_locked(self) -> None:
        today = datetime.now(timezone.utc).date()
        if today != self._day:
            self._day = today
            self._used = 0

    def consume(self) -> None:
        with self._lock:
            self._roll_if_needed_locked()
            if self._used >= self._limit:
                raise BudgetExhausted(
                    f"Budget exhausted ({self._used}/{self._limit} for {self._day} UTC)."
                )
            self._used += 1

    def remaining(self) -> int:
        with self._lock:
            self._roll_if_needed_locked()
            return max(0, self._limit - self._used)

    @property
    def used(self) -> int:
        with self._lock:
            self._roll_if_needed_locked()
            return self._used

    @property
    def limit(self) -> int:
        return self._limit


class RateLimiter:
    """Per-credential limiter bundling TPS (token bucket) + two request ceilings:
    a per-RUN cap and a per-DAY budget (seeded from a shared cross-run ledger).
    One instance is shared across all worker threads for a credential, so the
    TPS bucket serializes concurrent workers to <= tps even transiently.

    ``per_run`` defaults to ``tpd`` (single ceiling, old behaviour) when not set.
    ``day_used`` seeds the day budget with calls already spent earlier today by
    prior runs, so the UTC-day cap is enforced across serialized processes.
    """

    def __init__(
        self,
        tps: float,
        tpd: int,
        per_run: int | None = None,
        day_used: int = 0,
    ) -> None:
        self.bucket = _TokenBucket(tps)
        self.budget = _DailyBudget(tpd, initial_used=day_used)      # day cap (seeded)
        self.run_budget = _DailyBudget(per_run if per_run else tpd)  # per-run cap

    def acquire(self) -> float:
        """Reserve one request slot: spend per-run + day budget first, then pace
        to TPS. Either budget raises BudgetExhausted before we wait on TPS."""
        self.run_budget.consume()  # per-run cap — bounds a single process
        self.budget.consume()      # day cap — shared via seeded ledger
        return self.bucket.acquire()

    def budget_remaining(self) -> int:
        """Effective remaining = the tighter of the run cap and the day cap."""
        return min(self.run_budget.remaining(), self.budget.remaining())

    def day_used(self) -> int:
        return self.budget.used


# ─────────────────────────────────────────────────────────────
#  Parsed result + defensive response navigation
# ─────────────────────────────────────────────────────────────
@dataclass
class ItemResult:
    asin: str
    price: float | None
    currency: str | None
    availability_type: str | None
    in_stock: bool | None
    is_prime: bool | None         # not provided by the API for amazon.com.br — stays None
    condition: str | None
    title: str | None
    review_count: int | None      # from customerReviews.count (empty for sampled BR ASINs)
    star_rating: float | None     # from customerReviews.starRating (empty for sampled BR ASINs)
    merchant_name: str | None
    is_buybox_winner: bool | None
    ean: str | None               # 13-digit barcode from itemInfo.externalIds
    errors: list | None
    raw: dict  # full per-item JSON, so the harness can print and we map later


def _ci_get(d, key: str):
    """Case-insensitive single-key lookup on a dict."""
    if not isinstance(d, dict):
        return None
    if key in d:
        return d[key]
    lk = key.lower()
    for k, v in d.items():
        if k.lower() == lk:
            return v
    return None


def _dig(d, *path):
    """Walk a nested dict case-insensitively. Returns None on any miss."""
    cur = d
    for p in path:
        cur = _ci_get(cur, p)
        if cur is None:
            return None
    return cur


_INSTOCK_TYPES = {"IN_STOCK", "IN_STOCK_SCARCE"}
_OOS_TYPES = {"OUT_OF_STOCK", "UNAVAILABLE"}


def _parse_item(item: dict) -> ItemResult:
    """Map one getItems item entry into ItemResult. Tolerant of key casing and
    of the exact OffersV2 nesting until live JSON confirms the shape."""
    asin = _ci_get(item, "asin") or _ci_get(item, "itemId") or ""

    # OffersV2 → first listing
    listings = _dig(item, "offersV2", "listings")
    listing = listings[0] if isinstance(listings, list) and listings else None

    price = currency = avail_type = condition = None
    in_stock = is_prime = None
    merchant_name = is_buybox_winner = None

    if listing:
        money = _dig(listing, "price", "money") or _dig(listing, "price")
        amt = _ci_get(money, "amount") if money else None
        if amt is not None:
            try:
                price = float(amt)
            except (TypeError, ValueError):
                price = None
        currency = _ci_get(money, "currency") if money else None

        avail_type = _dig(listing, "availability", "type")
        if isinstance(avail_type, str):
            if avail_type.upper() in _INSTOCK_TYPES:
                in_stock = True
            elif avail_type.upper() in _OOS_TYPES:
                in_stock = False

        condition = _dig(listing, "condition", "value")
        merchant_name = _dig(listing, "merchantInfo", "name")
        bbw = _ci_get(listing, "isBuyBoxWinner")
        if isinstance(bbw, bool):
            is_buybox_winner = bbw
        # Prime is not present in the live amazon.com.br response; left as None.
        # Keep a single cheap probe in case it appears on other marketplaces.
        v = _dig(listing, "isPrimeEligible")
        if isinstance(v, bool):
            is_prime = v

    title = _dig(item, "itemInfo", "title", "displayValue") or _dig(item, "itemInfo", "title")

    # customerReviews: count / starRating may be a scalar or wrapped in {value:...}.
    review_count = _coerce_int(_dig(item, "customerReviews", "count"))
    star_rating = _coerce_float(_dig(item, "customerReviews", "starRating"))

    # externalIds.eans.displayValues is a list; take the first well-formed EAN-13.
    # Fall back to a 12-digit UPC zero-padded to 13, which is the standard
    # UPC-A -> EAN-13 promotion and keeps one consistent gtin13 field.
    ean = None
    for key, width in (("eans", 13), ("upcs", 12)):
        vals = _dig(item, "itemInfo", "externalIds", key, "displayValues")
        if isinstance(vals, list):
            for v in vals:
                digits = "".join(ch for ch in str(v) if ch.isdigit())
                if len(digits) == width:
                    ean = digits.zfill(13)
                    break
        if ean:
            break

    return ItemResult(
        asin=asin,
        price=price,
        currency=currency,
        availability_type=avail_type,
        in_stock=in_stock,
        is_prime=is_prime,
        condition=condition if isinstance(condition, str) else None,
        title=title if isinstance(title, str) else None,
        review_count=review_count,
        star_rating=star_rating,
        merchant_name=merchant_name if isinstance(merchant_name, str) else None,
        is_buybox_winner=is_buybox_winner,
        ean=ean,
        errors=None,
        raw=item,
    )


def _coerce_int(v):
    """Pull an int from a scalar or a {value/count: N} wrapper; else None."""
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, dict):
        v = _ci_get(v, "value") or _ci_get(v, "count")
    try:
        return int(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _coerce_float(v):
    """Pull a float from a scalar or a {value: N} wrapper; else None."""
    if isinstance(v, dict):
        v = _ci_get(v, "value")
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


# ─────────────────────────────────────────────────────────────
#  Client
# ─────────────────────────────────────────────────────────────
def _chunked(seq: list, n: int):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


class CreatorsClient:
    _MAX_ASINS_PER_CALL = 10
    _RETRYABLE = {429, 500, 502, 503, 504}

    def __init__(
        self,
        cfg: CreatorsConfig,
        limiter: RateLimiter | None = None,
        token_mgr: TokenManager | None = None,
        max_retries: int = 5,
        backoff_base_s: float = 1.0,
        backoff_cap_s: float = 30.0,
        day_used: int = 0,
    ) -> None:
        self.cfg = cfg
        self._session = requests.Session()
        self.tokens = token_mgr or TokenManager(cfg, self._session)
        self.limiter = limiter or RateLimiter(
            cfg.tps, cfg.tpd, per_run=cfg.tpd_per_run, day_used=day_used,
        )
        self.max_retries = max_retries
        self.backoff_base_s = backoff_base_s
        self.backoff_cap_s = backoff_cap_s
        # Lightweight counters for the future metrics layer / report.
        self.stats = {
            "requests": 0, "ok": 0, "http_429": 0, "http_5xx": 0,
            "retries": 0, "token_refreshes_on_401": 0, "throttle_wait_s": 0.0,
        }
        # Adaptive TPS: on 429 the token bucket eases below the configured TPS;
        # after a streak of clean responses it climbs back toward (never above) it.
        self._consec_ok = 0
        self._RECOVER_AFTER = 25  # clean responses before stepping the rate back up

    # ── public ──────────────────────────────────────────────────────────────
    def get_items(self, asins: list[str]) -> list[ItemResult]:
        """Fetch up to len(asins) items, batching into ≤10-ASIN getItems calls."""
        results: list[ItemResult] = []
        for batch in _chunked(list(asins), self._MAX_ASINS_PER_CALL):
            results.extend(self._get_items_batch(batch))
        return results

    def budget_remaining(self) -> int:
        return self.limiter.budget_remaining()

    def day_used(self) -> int:
        """getItems calls counted against the UTC-day budget (seeded + this run)."""
        return self.limiter.day_used()

    # ── internal ────────────────────────────────────────────────────────────
    def _headers(self, token: str) -> dict:
        # x-marketplace is required on every request — the live API rejects the
        # body-only marketplace with a ValidationException. v2.x additionally
        # carries a Version suffix in the Authorization header.
        auth = f"Bearer {token}"
        if self.cfg.credential_version:  # v2.x style
            auth = f"Bearer {token}, Version {self.cfg.credential_version}"
        return {
            "Authorization": auth,
            "Content-Type": "application/json",
            "x-marketplace": self.cfg.marketplace,
        }

    def _body(self, asins: list[str]) -> dict:
        return {
            "itemIds": asins,
            "partnerTag": self.cfg.partner_tag,
            "partnerType": "Associates",
            "marketplace": self.cfg.marketplace,
            "resources": self.cfg.resources,
        }

    def _get_items_batch(self, asins: list[str]) -> list[ItemResult]:
        url = f"{self.cfg.api_base.rstrip('/')}/getItems"
        body = self._body(asins)
        did_401_refresh = False

        for attempt in range(self.max_retries + 1):
            # TPS pacing + daily budget — counts every HTTP attempt.
            waited = self.limiter.acquire()
            self.stats["throttle_wait_s"] += waited

            token = self.tokens.get_token()
            self.stats["requests"] += 1
            try:
                resp = self._session.post(
                    url, headers=self._headers(token), json=body, timeout=25
                )
            except requests.RequestException as exc:
                if attempt < self.max_retries:
                    self.stats["retries"] += 1
                    self._sleep_backoff(attempt, None)
                    continue
                raise RuntimeError(f"getItems network error after retries: {exc}") from exc

            # 401: refresh token once, then retry without burning a retry slot.
            if resp.status_code == 401 and not did_401_refresh:
                log.warning("getItems 401 — refreshing token and retrying once.")
                self.tokens.invalidate()
                self.tokens.get_token(force=True)
                self.stats["token_refreshes_on_401"] += 1
                did_401_refresh = True
                continue

            if resp.status_code in self._RETRYABLE:
                if resp.status_code == 429:
                    self.stats["http_429"] += 1
                    # Ease the steady rate below TPS so we stop tripping the limit.
                    self._consec_ok = 0
                    new_rate = self.limiter.bucket.throttle_down()
                    log.warning("getItems 429 — easing TPS to %.3f req/s.", new_rate)
                else:
                    self.stats["http_5xx"] += 1
                if attempt < self.max_retries:
                    self.stats["retries"] += 1
                    self._sleep_backoff(attempt, resp.headers.get("Retry-After"))
                    continue
                raise RuntimeError(
                    f"getItems failed after retries: HTTP {resp.status_code} — {resp.text[:300]}"
                )

            if resp.status_code != 200:
                raise RuntimeError(
                    f"getItems HTTP {resp.status_code} — {resp.text[:300]}"
                )

            self.stats["ok"] += 1
            # Sustained success → gently restore the rate toward the configured TPS.
            self._consec_ok += 1
            if self._consec_ok >= self._RECOVER_AFTER:
                self._consec_ok = 0
                self.limiter.bucket.recover(self.cfg.tps)
            return self._parse_response(resp.json())

        return []

    def _sleep_backoff(self, attempt: int, retry_after: str | None) -> None:
        """Exponential backoff + per-call jitter. Honors Retry-After when present.
        Jitter decorrelates concurrent workers so retries are not synchronized."""
        exp = min(self.backoff_cap_s, self.backoff_base_s * (2 ** attempt))
        jitter = random.uniform(0, exp)  # full jitter
        delay = exp / 2 + jitter / 2
        if retry_after:
            try:
                delay = max(delay, float(retry_after))
            except (TypeError, ValueError):
                pass  # HTTP-date form unsupported here; backoff covers it
        time.sleep(delay)

    @staticmethod
    def _parse_response(data: dict) -> list[ItemResult]:
        # Locate the items list tolerantly: {itemsResult:{items:[...]}} or {items:[...]}.
        items = _dig(data, "itemsResult", "items") or _ci_get(data, "items")
        if not isinstance(items, list):
            items = []
        return [_parse_item(it) for it in items]


__all__ = [
    "CreatorsConfig", "CreatorsClient", "TokenManager", "RateLimiter",
    "ItemResult", "BudgetExhausted",
]
