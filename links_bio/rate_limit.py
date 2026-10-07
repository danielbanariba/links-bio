"""A small in-memory, per-client sliding-window rate limiter.

The form endpoints in `links_bio.fastapi_forms` run as a single uvicorn
process, so per-process memory is a perfectly good store for this -- there is
no need for Redis or a dependency like slowapi (deliberately not installed)
just to count requests per client over a short window.

Client identity resolution lives here too: behind the cloudflared tunnel,
every request's direct TCP peer is 127.0.0.1, so the real client IP only
shows up in the `CF-Connecting-IP` header. That header is only trustworthy
when it actually came through the tunnel -- i.e. when the direct peer is
loopback. From any other peer it is attacker-controlled and must be ignored,
or any client could spoof a fresh identity on every request to dodge the
limiter entirely.
"""

from __future__ import annotations

import ipaddress
import logging
from collections import deque
from threading import Lock

from fastapi import Request

logger = logging.getLogger("rate_limit")

# Hard cap on the number of distinct client keys tracked at once. Without
# this, a flood of requests using many different (or spoofed-but-ignored)
# identities could grow the internal dict without bound.
MAX_TRACKED_KEYS = 10_000

CF_CONNECTING_IP_HEADER = "CF-Connecting-IP"


def _is_loopback_peer(host: str) -> bool:
    """Return True when `host` is the local cloudflared tunnel's own
    loopback address -- i.e. the request really did arrive through
    cloudflared on this host, so `CF-Connecting-IP` is trustworthy.

    An exact-string check against {"127.0.0.1", "::1"} missed other valid
    loopback forms: the whole 127.0.0.0/8 block (e.g. "127.0.0.2") is
    loopback too, and an IPv4-mapped IPv6 address (e.g.
    "::ffff:127.0.0.1") is loopback whenever the mapped IPv4 address is.
    Any value `ipaddress` cannot parse (e.g. TestClient's own "testclient"
    pseudo-peer) is treated as non-loopback, never as trusted.
    """
    try:
        addr = ipaddress.ip_address(host)
    except ValueError:
        return False
    if addr.is_loopback:
        return True
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped is not None:
        return addr.ipv4_mapped.is_loopback
    return False


def resolve_client_key(request: Request) -> str:
    """Return the identity this request should be rate-limited on.

    Trusts `CF-Connecting-IP` only when the direct peer is loopback (i.e.
    the request really did arrive through cloudflared on this host).
    Otherwise the header is ignored and the direct peer address is used,
    so a non-loopback caller cannot spoof a fresh identity per request.
    """
    peer = request.client.host if request.client else ""
    if _is_loopback_peer(peer):
        forwarded = request.headers.get(CF_CONNECTING_IP_HEADER)
        if forwarded:
            return forwarded
    return peer


class SlidingWindowLimiter:
    """Per-key sliding-window limiter: at most `limit` hits per key within
    any `window_seconds`-wide trailing window."""

    def __init__(
        self,
        limit: int,
        window_seconds: float,
        max_tracked_keys: int = MAX_TRACKED_KEYS,
    ) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self.max_tracked_keys = max_tracked_keys
        self._hits: dict[str, deque[float]] = {}
        self._lock = Lock()

    def check(self, key: str, now: float) -> tuple[bool, float]:
        """Record a hit attempt for `key` at time `now`.

        Returns (allowed, retry_after_seconds). `retry_after_seconds` is 0
        when allowed, otherwise the number of seconds until the oldest hit
        in the current window expires.
        """
        with self._lock:
            # Pop + reinsert so a touched key always lands at the end of
            # the dict -- Python dicts preserve insertion order, so this
            # makes iteration order double as least-recently-touched-first
            # order for `_evict_oldest` below, at no extra bookkeeping cost.
            hits = self._hits.pop(key, None)
            if hits is None:
                hits = deque()

            # Drop hits that fell out of the window.
            while hits and now - hits[0] >= self.window_seconds:
                hits.popleft()

            if len(hits) >= self.limit:
                retry_after = self.window_seconds - (now - hits[0])
                self._hits[key] = hits
                return False, max(retry_after, 0.0)

            hits.append(now)
            self._hits[key] = hits

            if len(self._hits) > self.max_tracked_keys:
                self._evict_oldest(now)

            return True, 0.0

    def _evict_oldest(self, now: float) -> None:
        """Keep the tracked-key count within `max_tracked_keys`.

        Before this, a flood of distinct, still-active (never-expired)
        keys could grow `self._hits` past `max_tracked_keys` forever --
        the old sweep only ever dropped keys whose whole window had
        already expired, which is never true for a client hammering the
        limiter continuously. First drop any key that genuinely has
        expired (free, no live client affected), then evict the
        least-recently-touched survivors so the cap actually holds; those
        clients simply start a fresh window on their next request, which
        is the explicitly accepted cost of keeping memory bounded.
        Caller holds `self._lock`.
        """
        expired = [
            key
            for key, hits in self._hits.items()
            if not hits or now - hits[-1] >= self.window_seconds
        ]
        for key in expired:
            del self._hits[key]

        while len(self._hits) > self.max_tracked_keys:
            oldest_key = next(iter(self._hits))
            del self._hits[oldest_key]

    def reset(self) -> None:
        """Clear all tracked state. Used by tests to keep cases independent
        of each other; never called from production code."""
        with self._lock:
            self._hits.clear()
