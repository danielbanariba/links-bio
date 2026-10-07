"""Hardening regression guards for the 4 public form endpoints in
links_bio.fastapi_forms (T9): no abuse control, no field length caps, the
interactive API docs only hidden by incidental tunnel routing, a concurrent
newsletter signup surfacing 500 instead of 409, and an embedded CR/LF in a
single-line field silently breaking the admin notification email while the
submitter still sees success.

Every test drives the real FastAPI app through TestClient against a scratch
copy of the dev DB, never the dev DB in place and never production. Email
sending is always stubbed so no test can ever reach real SMTP.
"""
from __future__ import annotations

import asyncio
import sqlite3
import threading
import time
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from links_bio import fastapi_forms, rate_limit
from links_bio.models.contact_message import ContactMessage
from links_bio.models.newsletter import NewsletterSubscriber
from links_bio.models.submission import Submission

# `forms_client_factory` and `forms_client` live in tests/conftest.py --
# shared with tests/test_forms_contract.py so both build their TestClients
# (scratch DB, stubbed email, reset rate limiters) the exact same way.

TEST_BAND_NAME = "T9 Hardening Test Band"
TEST_CONTACT_EMAIL = "t9-hardening-test@example.com"


def _valid_submit_payload(**overrides: str) -> dict:
    payload = {
        "band_name": TEST_BAND_NAME,
        "contact_email": TEST_CONTACT_EMAIL,
        "genre": "Death Metal",
        "country": "Honduras",
    }
    payload.update(overrides)
    return payload


def _valid_promo_payload(**overrides: str) -> dict:
    payload = {
        "band_name": "T9 Hardening Promo Band",
        "email": "t9-hardening-promo@example.com",
        "genre": "Death Metal",
        "album_title": "Hardening Test Album",
        "youtube_url": "https://youtu.be/t9-hardening",
    }
    payload.update(overrides)
    return payload


def _valid_newsletter_payload(**overrides: str) -> dict:
    payload = {"email": "t9-hardening-newsletter@example.com"}
    payload.update(overrides)
    return payload


def _valid_contact_payload(**overrides: str) -> dict:
    payload = {
        "name": "T9 Hardening Contact",
        "email": "t9-hardening-contact@example.com",
        "message": "Hardening regression check.",
    }
    payload.update(overrides)
    return payload


def _submissions_with_email(engine, email: str) -> list[Submission]:
    """The scratch DB is a full copy of the shared dev reflex.db, so it can
    carry pre-existing rows; filter by this test's own contact_email instead
    of asserting on the whole table."""
    with Session(engine) as session:
        return session.exec(
            select(Submission).where(Submission.contact_email == email)
        ).all()


def _contact_messages_with_email(engine, email: str) -> list[ContactMessage]:
    """Both /promo and /contact store into ContactMessage; scoped to this
    test's own email for the same reason as `_submissions_with_email`."""
    with Session(engine) as session:
        return session.exec(
            select(ContactMessage).where(ContactMessage.email == email)
        ).all()


def _newsletter_subscriber(engine, email: str) -> NewsletterSubscriber | None:
    with Session(engine) as session:
        return session.exec(
            select(NewsletterSubscriber).where(NewsletterSubscriber.email == email)
        ).first()


def test_docs_and_openapi_are_disabled(forms_client: TestClient) -> None:
    """The interactive Swagger UI and raw OpenAPI schema must not be
    reachable at all: before this fix they were only hidden by the tunnel's
    incidental ingress routing, not disabled in the app itself, so anyone
    reaching the service directly (or through a future routing change)
    could browse and probe every endpoint's schema.
    """
    assert forms_client.get("/docs").status_code == 404
    assert forms_client.get("/redoc").status_code == 404
    assert forms_client.get("/openapi.json").status_code == 404


def test_oversized_field_is_rejected_before_reaching_db_or_email(
    forms_client: TestClient,
) -> None:
    """None of the request fields had a max_length: a huge band_name (or any
    other field) was accepted, stored, and fed into the admin notification
    email verbatim -- an unbounded memory/DB/SMTP-quota exhaustion vector.
    An oversized field must 422 before any DB write or email attempt.
    """
    oversized = _valid_submit_payload(band_name="A" * 1000)

    res = forms_client.post("/api/metal-archive/submit", json=oversized)

    assert res.status_code == 422
    assert _submissions_with_email(forms_client.db_engine, TEST_CONTACT_EMAIL) == []  # type: ignore[attr-defined]
    assert forms_client.sent_emails == []  # type: ignore[attr-defined]


def test_embedded_crlf_in_single_line_field_is_rejected(
    forms_client: TestClient,
) -> None:
    """A band_name like 'Band\\r\\nBcc: x@y.z' passed validation and was
    dropped straight into the plain-text admin notification email, which
    then silently failed to send while the submitter still saw a normal
    success response. Single-line fields must reject embedded CR/LF.
    """
    injected = _valid_submit_payload(band_name="Band\r\nBcc: x@y.z")

    res = forms_client.post("/api/metal-archive/submit", json=injected)

    assert res.status_code == 422
    assert _submissions_with_email(forms_client.db_engine, TEST_CONTACT_EMAIL) == []  # type: ignore[attr-defined]
    assert forms_client.sent_emails == []  # type: ignore[attr-defined]


def test_valid_submission_is_still_accepted(forms_client: TestClient) -> None:
    """Anchor test: the new length caps and CRLF checks must not reject a
    normal, legitimate submission. If this regresses, the hardening in this
    file is too aggressive, not just correctly strict.
    """
    res = forms_client.post(
        "/api/metal-archive/submit", json=_valid_submit_payload()
    )

    assert res.status_code == 200
    rows = _submissions_with_email(forms_client.db_engine, TEST_CONTACT_EMAIL)  # type: ignore[attr-defined]
    assert len(rows) == 1
    assert rows[0].band_name == TEST_BAND_NAME
    assert len(forms_client.sent_emails) == 1  # type: ignore[attr-defined]


def test_rate_limit_returns_429_with_retry_after(forms_client: TestClient) -> None:
    """None of the 4 endpoints had any abuse control: a client could call
    /submit (a real Gmail SMTP send) as fast as it liked, an email-bombing
    and DB-growth vector. The 6th request within the window from one client
    must be rejected with 429 and a Retry-After header, not accepted.
    """
    for _ in range(fastapi_forms.EMAIL_ENDPOINTS_RATE_LIMIT):
        res = forms_client.post(
            "/api/metal-archive/submit", json=_valid_submit_payload()
        )
        assert res.status_code == 200

    limited = forms_client.post(
        "/api/metal-archive/submit", json=_valid_submit_payload()
    )

    assert limited.status_code == 429
    assert limited.json()["detail"]
    assert int(limited.headers["Retry-After"]) > 0


def test_independent_limits_per_cf_connecting_ip_behind_loopback(
    forms_client_factory,
) -> None:
    """Behind cloudflared every request's direct peer is 127.0.0.1, so the
    limiter must key on CF-Connecting-IP there -- otherwise every real
    visitor sharing the tunnel would share (and exhaust) one global quota
    instead of each getting their own.
    """
    client_a = forms_client_factory(client=("127.0.0.1", 11111))
    client_b = forms_client_factory(client=("127.0.0.1", 22222))

    for _ in range(fastapi_forms.EMAIL_ENDPOINTS_RATE_LIMIT):
        res = client_a.post(
            "/api/metal-archive/submit",
            json=_valid_submit_payload(),
            headers={"CF-Connecting-IP": "203.0.113.1"},
        )
        assert res.status_code == 200

    exhausted = client_a.post(
        "/api/metal-archive/submit",
        json=_valid_submit_payload(),
        headers={"CF-Connecting-IP": "203.0.113.1"},
    )
    assert exhausted.status_code == 429

    # A different CF-Connecting-IP, still behind the same loopback peer,
    # must have its own untouched quota.
    still_allowed = client_b.post(
        "/api/metal-archive/submit",
        json=_valid_submit_payload(),
        headers={"CF-Connecting-IP": "203.0.113.2"},
    )
    assert still_allowed.status_code == 200


def test_spoofed_cf_connecting_ip_from_non_loopback_peer_is_ignored(
    forms_client_factory,
) -> None:
    """CF-Connecting-IP is only trustworthy when it actually came through
    the local cloudflared tunnel (direct peer == loopback). From any other
    peer it is attacker-controlled: trusting it would let one real client
    spoof a fresh identity on every request and dodge the limiter entirely.
    """
    client = forms_client_factory(client=("203.0.113.99", 33333))

    for i in range(fastapi_forms.EMAIL_ENDPOINTS_RATE_LIMIT):
        res = client.post(
            "/api/metal-archive/submit",
            json=_valid_submit_payload(),
            # A different spoofed header on every request -- if the server
            # trusted it from this non-loopback peer, each request would
            # look like a brand-new, never-limited client.
            headers={"CF-Connecting-IP": f"10.0.0.{i}"},
        )
        assert res.status_code == 200

    limited = client.post(
        "/api/metal-archive/submit",
        json=_valid_submit_payload(),
        headers={"CF-Connecting-IP": "10.0.0.250"},
    )

    assert limited.status_code == 429


def test_honeypot_filled_drops_submission_silently(forms_client: TestClient) -> None:
    """A filled honeypot field means a bot, not a human, filled the form (it
    is invisible and unreachable for a real visitor). The response must
    still look like a normal success -- so an adapting bot gets no signal
    that it was caught -- but nothing may reach the DB or the admin's inbox.
    """
    res = forms_client.post(
        "/api/metal-archive/submit",
        json=_valid_submit_payload(website="http://spam.example"),
    )

    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert _submissions_with_email(forms_client.db_engine, TEST_CONTACT_EMAIL) == []  # type: ignore[attr-defined]
    assert forms_client.sent_emails == []  # type: ignore[attr-defined]


def test_concurrent_newsletter_signup_returns_409_not_500(
    forms_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Two near-simultaneous newsletter signups for the same email can both
    pass the "does it already exist" check before either commits; the
    second one's commit then hits NewsletterSubscriber.email's UNIQUE
    constraint. Before this fix, that IntegrityError fell through to the
    generic handler and surfaced as an unhelpful 500 instead of the same
    409 a non-racy duplicate already gets (which the frontend already
    handles).

    The race is simulated deterministically: the handler's own
    "does it exist" query is made to report "not found" while a second,
    independent session inserts the same email underneath it -- exactly
    the window a real race lands in.
    """
    email = "race@example.com"
    real_exec = Session.exec
    call_count = {"n": 0}

    def racy_exec(self, statement, *a, **kw):
        call_count["n"] += 1
        if call_count["n"] == 1:
            # This is the handler's own existence check. Land a concurrent
            # request's insert right now, in the window this check cannot
            # see, then report "not found" as if the race had won.
            with Session(fastapi_forms.engine) as other:
                other.add(NewsletterSubscriber(email=email))
                other.commit()

            class _EmptyResult:
                def first(self_inner):
                    return None

            return _EmptyResult()
        return real_exec(self, statement, *a, **kw)

    monkeypatch.setattr(Session, "exec", racy_exec)

    res = forms_client.post(
        "/api/metal-archive/newsletter", json={"email": email}
    )

    assert res.status_code == 409
    assert res.json()["detail"] == "This email is already subscribed."


# ─── R3-003: handlers must run off the event loop ──────────────────────────


def _hold_write_lock(db_path: str, hold_seconds: float, started: threading.Event) -> None:
    """Hold SQLite's write lock on `db_path` for `hold_seconds`, signalling
    `started` once acquired, so a concurrent write through the app is
    forced to actually wait -- mirroring tests/test_db_busy_timeout.py's
    helper, duplicated locally since it is a small, self-contained seam
    and this file's allowed edit surface does not include that one.
    """
    conn = sqlite3.connect(db_path)
    conn.execute("BEGIN IMMEDIATE")
    started.set()
    time.sleep(hold_seconds)
    conn.commit()
    conn.close()


def test_slow_db_write_does_not_block_a_concurrent_fast_request(
    forms_client_factory, scratch_db: Path
) -> None:
    """R3-003: the route handlers were declared `async def` but ran plain
    synchronous SQLAlchemy/SQLite work directly on the single asyncio
    event loop that one uvicorn process uses for every connection. A
    write queued behind another connection's held write lock (up to the
    30s busy_timeout in production) therefore froze EVERY other in-flight
    request on the process -- including ones that touch no database at
    all. Handlers must run in a worker thread (plain `def`, which FastAPI
    offloads via its threadpool) so a slow write never blocks an unrelated
    fast request.

    Driven directly over ASGI with httpx + asyncio (not TestClient):
    starting the timer right when both requests are scheduled, rather
    than when each one happens to start running, is what makes this
    deterministic -- if the event loop is blocked, the fast request's
    completion is delayed no matter when its coroutine was created.
    """
    forms_client_factory()  # resets the shared rate limiters via the fixture

    hold_seconds = 3.0
    started = threading.Event()
    holder = threading.Thread(
        target=_hold_write_lock, args=(str(scratch_db), hold_seconds, started)
    )
    holder.start()
    assert started.wait(timeout=5), "holder thread never acquired the write lock"

    async def run() -> tuple[httpx.Response, httpx.Response, float]:
        transport = httpx.ASGITransport(app=fastapi_forms.app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://testserver"
        ) as client:
            start = time.perf_counter()
            slow_task = asyncio.create_task(
                client.post(
                    "/api/metal-archive/newsletter",
                    json=_valid_newsletter_payload(email="t9-concurrency@example.com"),
                )
            )
            fast_task = asyncio.create_task(client.get("/this-route-does-not-exist"))
            fast_res = await fast_task
            elapsed = time.perf_counter() - start
            slow_res = await slow_task
            return slow_res, fast_res, elapsed

    try:
        slow_res, fast_res, elapsed = asyncio.run(run())
    finally:
        holder.join(timeout=hold_seconds + 10)

    assert fast_res.status_code == 404
    assert elapsed < 1.5, (
        f"a fast, unrelated request took {elapsed:.2f}s while a slow DB "
        "write was in flight -- the event loop was blocked"
    )
    assert slow_res.status_code == 200, slow_res.text


# ─── R3-002: loopback detection must use ipaddress, not exact string match ─


class _FakeClient:
    def __init__(self, host: str) -> None:
        self.host = host


class _FakeRequest:
    """Minimal stand-in for fastapi.Request: `resolve_client_key` only
    reads `.client.host` and `.headers.get(...)`."""

    def __init__(self, host: str, headers: dict[str, str] | None = None) -> None:
        self.client = _FakeClient(host)
        self.headers = headers or {}


@pytest.mark.parametrize("loopback_host", ["127.0.0.2", "::ffff:127.0.0.1"])
def test_loopback_detection_trusts_cf_header_for_every_loopback_form(
    loopback_host: str,
) -> None:
    """R3-002: the old check matched only the exact strings "127.0.0.1"
    and "::1". The whole 127.0.0.0/8 block is loopback too (cloudflared
    could just as well connect from "127.0.0.2"), and an IPv4-mapped IPv6
    address like "::ffff:127.0.0.1" is loopback whenever its mapped IPv4
    address is -- both were wrongly treated as untrusted, so the real
    CF-Connecting-IP header was silently ignored for them.
    """
    req = _FakeRequest(loopback_host, {"CF-Connecting-IP": "203.0.113.9"})

    assert rate_limit.resolve_client_key(req) == "203.0.113.9"


def test_loopback_detection_never_trusts_an_unparseable_peer() -> None:
    """A peer address `ipaddress` cannot parse at all -- TestClient's own
    "testclient" pseudo-peer, or anything else malformed -- must never be
    treated as loopback; `ipaddress.ip_address` raises ValueError for it,
    and that must fail closed (non-loopback), not raise out of the
    limiter and 500 every request.
    """
    req = _FakeRequest("testclient", {"CF-Connecting-IP": "203.0.113.9"})

    assert rate_limit.resolve_client_key(req) == "testclient"


# ─── R3-004: MAX_TRACKED_KEYS must be a real ceiling ───────────────────────


def test_tracked_keys_never_exceed_the_configured_cap() -> None:
    """R3-004: the old sweep only ever dropped keys whose entire window
    had already expired. A flood of distinct, continuously-active clients
    (the realistic abuse case -- nothing about them ever "expires" while
    they keep hitting the limiter) grew the tracked-key dict past
    `max_tracked_keys` without bound, defeating the whole point of the
    cap.
    """
    limiter = rate_limit.SlidingWindowLimiter(
        limit=5, window_seconds=600, max_tracked_keys=10
    )

    for i in range(50):
        allowed, _ = limiter.check(f"client-{i}", now=float(i))
        assert allowed is True

    assert len(limiter._hits) <= 10


# ─── R3-005: coverage across endpoints ─────────────────────────────────────
#
# Every regression guard above this point only ever drove /submit. The same
# honeypot check, the same single-line CRLF validator, and the same shared
# rate limiter are wired into /promo, /newsletter and /contact too, but
# nothing proved any of that -- a handler-specific bug (wrong field read,
# forgotten check, an accidentally separate limiter instance) on any of the
# other 3 endpoints would have gone uncaught.

_ENDPOINTS = [
    ("/api/metal-archive/submit", _valid_submit_payload),
    ("/api/metal-archive/promo", _valid_promo_payload),
    ("/api/metal-archive/newsletter", _valid_newsletter_payload),
    ("/api/metal-archive/contact", _valid_contact_payload),
]


@pytest.mark.parametrize("path,payload_factory", _ENDPOINTS)
def test_honeypot_filled_drops_submission_silently_on_every_endpoint(
    forms_client: TestClient, path: str, payload_factory
) -> None:
    """The original honeypot guard only exercised /submit. A filled
    honeypot must drop the submission -- no DB row, no admin email -- on
    every one of the 4 endpoints, not just that one.
    """
    email = f"t9-honeypot-coverage{path.replace('/', '-')}@example.com"
    email_field = "contact_email" if path.endswith("/submit") else "email"
    payload = payload_factory(**{email_field: email, "website": "http://spam.example"})

    res = forms_client.post(path, json=payload)

    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert forms_client.sent_emails == []  # type: ignore[attr-defined]
    if path.endswith("/submit"):
        assert _submissions_with_email(forms_client.db_engine, email) == []  # type: ignore[attr-defined]
    elif path.endswith("/newsletter"):
        assert _newsletter_subscriber(forms_client.db_engine, email) is None  # type: ignore[attr-defined]
    else:
        assert _contact_messages_with_email(forms_client.db_engine, email) == []  # type: ignore[attr-defined]


@pytest.mark.parametrize(
    "path,payload_factory,field",
    [
        ("/api/metal-archive/submit", _valid_submit_payload, "band_name"),
        ("/api/metal-archive/promo", _valid_promo_payload, "band_name"),
        ("/api/metal-archive/newsletter", _valid_newsletter_payload, "email"),
        ("/api/metal-archive/contact", _valid_contact_payload, "name"),
    ],
)
def test_embedded_crlf_is_rejected_on_every_endpoint(
    forms_client: TestClient, path: str, payload_factory, field: str
) -> None:
    """The original CRLF guard only exercised /submit's band_name. The
    same single-line validator is reused across all 4 request models,
    but nothing proved it was actually wired up on every endpoint's
    equivalent field.
    """
    payload = payload_factory(**{field: "X\r\nBcc: x@y.z"})

    res = forms_client.post(path, json=payload)

    assert res.status_code == 422


@pytest.mark.parametrize(
    "path,payload_factory,field",
    [
        ("/api/metal-archive/submit", _valid_submit_payload, "description"),
        ("/api/metal-archive/contact", _valid_contact_payload, "message"),
    ],
)
def test_multiline_free_text_field_still_accepts_newlines(
    forms_client: TestClient, path: str, payload_factory, field: str
) -> None:
    """The single-line CRLF guard is deliberately NOT applied to a
    submission's description or a contact message -- genuinely multi-line
    free text. A validator applied too broadly there would silently break
    every multi-paragraph message instead of only blocking header
    injection.
    """
    payload = payload_factory(**{field: "Line one.\nLine two.\nLine three."})

    res = forms_client.post(path, json=payload)

    assert res.status_code == 200, res.text


@pytest.mark.parametrize(
    "first_path,first_payload,second_path,second_payload",
    [
        (
            "/api/metal-archive/submit", _valid_submit_payload,
            "/api/metal-archive/promo", _valid_promo_payload,
        ),
        (
            "/api/metal-archive/promo", _valid_promo_payload,
            "/api/metal-archive/contact", _valid_contact_payload,
        ),
        (
            "/api/metal-archive/contact", _valid_contact_payload,
            "/api/metal-archive/submit", _valid_submit_payload,
        ),
    ],
)
def test_submit_promo_and_contact_share_one_email_rate_budget(
    forms_client: TestClient,
    first_path: str,
    first_payload,
    second_path: str,
    second_payload,
) -> None:
    """/submit, /promo and /contact all send a real SMTP email on every
    call and must share ONE budget -- otherwise a client could dodge a
    per-endpoint limit by spreading requests across the three, still
    getting 3x the SMTP quota. Exhausting the budget on one of the three
    must lock out the others, not just the one that was hit.
    """
    for _ in range(fastapi_forms.EMAIL_ENDPOINTS_RATE_LIMIT):
        res = forms_client.post(first_path, json=first_payload())
        assert res.status_code == 200

    exhausted = forms_client.post(second_path, json=second_payload())

    assert exhausted.status_code == 429


def test_newsletter_has_its_own_separate_rate_budget(forms_client: TestClient) -> None:
    """Newsletter never sends email (unlike submit/promo/contact) and
    intentionally has a separate, larger budget; exhausting the shared
    email budget via /submit must not also lock out /newsletter.
    """
    for _ in range(fastapi_forms.EMAIL_ENDPOINTS_RATE_LIMIT):
        res = forms_client.post(
            "/api/metal-archive/submit", json=_valid_submit_payload()
        )
        assert res.status_code == 200
    exhausted = forms_client.post(
        "/api/metal-archive/submit", json=_valid_submit_payload()
    )
    assert exhausted.status_code == 429

    still_ok = forms_client.post(
        "/api/metal-archive/newsletter", json=_valid_newsletter_payload()
    )
    assert still_ok.status_code == 200
