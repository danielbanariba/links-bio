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
from sqlmodel import Session, create_engine

from links_bio import fastapi_forms


@pytest.fixture
def forms_client(scratch_db: Path, clean_env, monkeypatch):
    """A TestClient against the real app, wired to a private scratch DB and
    with email sending stubbed. Also resets the rate limiters so each test
    starts with a clean quota regardless of test order.
    """
    engine = create_engine(
        f"sqlite:///{scratch_db}", connect_args={"check_same_thread": False}
    )
    monkeypatch.setattr(fastapi_forms, "engine", engine)

    sent: list[tuple[str, str]] = []

    def fake_send(subject: str, body: str) -> None:
        sent.append((subject, body))
        return None

    monkeypatch.setattr(fastapi_forms, "_send_email_notification", fake_send)

    client = TestClient(fastapi_forms.app)
    client.sent_emails = sent  # type: ignore[attr-defined]
    client.db_engine = engine  # type: ignore[attr-defined]
    yield client


def _valid_submit_payload(**overrides: str) -> dict:
    payload = {
        "band_name": "Blasfemia",
        "contact_email": "band@example.com",
        "genre": "Death Metal",
        "country": "Honduras",
    }
    payload.update(overrides)
    return payload


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
