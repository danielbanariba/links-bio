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

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from links_bio import fastapi_forms
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


def _submissions_with_email(engine, email: str) -> list[Submission]:
    """The scratch DB is a full copy of the shared dev reflex.db, so it can
    carry pre-existing rows; filter by this test's own contact_email instead
    of asserting on the whole table."""
    with Session(engine) as session:
        return session.exec(
            select(Submission).where(Submission.contact_email == email)
        ).all()


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
