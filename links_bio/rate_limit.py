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

import logging
from collections import deque
from threading import Lock

from fastapi import Request

logger = logging.getLogger("rate_limit")

# Hard cap on the number of distinct client keys tracked at once. Without
# this, a flood of requests using many different (or spoofed-but-ignored)
# identities could grow the internal dict without bound.
MAX_TRACKED_KEYS = 10_000

# Only trust the CF-Connecting-IP header when the direct peer is one of
# these -- i.e. the request actually came through the local cloudflared
# tunnel rather than being spoofed by an arbitrary remote peer.
LOOPBACK_ADDRESSES = {"127.0.0.1", "::1"}

CF_CONNECTING_IP_HEADER = "CF-Connecting-IP"


def resolve_client_key(request: Request) -> str:
    """Return the identity this request should be rate-limited on.

    Trusts `CF-Connecting-IP` only when the direct peer is loopback (i.e.
    the request really did arrive through cloudflared on this host).
    Otherwise the header is ignored and the direct peer address is used,
    so a non-loopback caller cannot spoof a fresh identity per request.
    """
    peer = request.client.host if request.client else ""
    if peer in LOOPBACK_ADDRESSES:
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
            hits = self._hits.setdefault(key, deque())

            # Drop hits that fell out of the window.
            while hits and now - hits[0] >= self.window_seconds:
                hits.popleft()

            if len(hits) >= self.limit:
                retry_after = self.window_seconds - (now - hits[0])
                return False, max(retry_after, 0.0)

            hits.append(now)

            if len(self._hits) > self.max_tracked_keys:
                self._prune_expired(now)

            return True, 0.0

    def _prune_expired(self, now: float) -> None:
        """Drop keys whose entire window has already expired. Bounds memory
        when many distinct keys are seen. Caller holds `self._lock`."""
        expired = [
            key
            for key, hits in self._hits.items()
            if not hits or now - hits[-1] >= self.window_seconds
        ]
        for key in expired:
            del self._hits[key]

    def reset(self) -> None:
        """Clear all tracked state. Used by tests to keep cases independent
        of each other; never called from production code."""
        with self._lock:
            self._hits.clear()
