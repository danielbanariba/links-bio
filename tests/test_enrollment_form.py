"""Tests for the enrollment form: POST /api/metal-archive/enrollment, the
`to` parameter of `_send_email_notification`, and the `enrollment_requests`
migration.

These drive the real FastAPI app and the real `_send_email_notification`
against a scratch DB and a fake `smtplib.SMTP_SSL`, so nothing here can send
a real email. `forms_client_factory` (tests/conftest.py) replaces the mailer
with a two-argument stub that cannot take `to`, so the `enroll_client`
fixture puts the real mailer back and fakes the SMTP layer underneath it.
"""
from __future__ import annotations

import email
import os
import re
import sqlite3
import subprocess
import sys
from datetime import date, timedelta
from email.header import decode_header, make_header
from pathlib import Path
from typing import get_args

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, select

from links_bio import fastapi_forms, notifications
from links_bio.models.enrollment import EnrollmentRequest

REPO_ROOT = Path(__file__).resolve().parent.parent
PAGE = REPO_ROOT / "web" / "src" / "pages" / "matricula.astro"

PATH = "/api/metal-archive/enrollment"
SENDER = "sender@example.test"
NOTIFY_TO = "foundation@example.test"


def _payload(**overrides: object) -> dict:
    payload: dict = {
        "guardian_name": "María López",
        "relationship": "Madre",
        "phone": "+504 9999-0000",
        "email": "maria@example.test",
        "community": "Colonia Kennedy",
        "address": "Bloque 5, casa 12",
        "child_name": "José Daniel Pérez",
        "birth_date": "2018-05-14",
        "grade": "Primer grado",
        "current_school": "Escuela Cecilio del Valle",
        "household_size": 5,
        "monthly_income": "De L 5,000 a L 10,000",
        "reason": "Somos cinco en casa y solo trabaja el papá.",
        "consent": True,
        "website": "",
    }
    payload.update(overrides)
    return payload


def _without(*names: str) -> dict:
    payload = _payload()
    for name in names:
        del payload[name]
    return payload


class FakeSMTP:
    """Stands in for smtplib.SMTP_SSL: records what would have been sent."""

    sent: list[bytes] = []
    logins: list[tuple[str, str]] = []
    fail_login = False

    def __init__(self, host: str, port: int) -> None:
        pass

    def __enter__(self) -> "FakeSMTP":
        return self

    def __exit__(self, *exc: object) -> None:
        return None

    def login(self, user: str, password: str) -> None:
        if FakeSMTP.fail_login:
            raise OSError("smtp is down")
        FakeSMTP.logins.append((user, password))

    def send_message(self, msg) -> None:
        # as_bytes() is what smtplib really does with the message, so a
        # header or body that cannot be serialised fails here too.
        FakeSMTP.sent.append(msg.as_bytes())


@pytest.fixture
def smtp(monkeypatch: pytest.MonkeyPatch) -> type[FakeSMTP]:
    FakeSMTP.sent = []
    FakeSMTP.logins = []
    FakeSMTP.fail_login = False
    monkeypatch.setattr(notifications.smtplib, "SMTP_SSL", FakeSMTP)
    return FakeSMTP


@pytest.fixture
def enroll_client(forms_client_factory, smtp, monkeypatch) -> TestClient:
    monkeypatch.setattr(
        fastapi_forms, "_send_email_notification", notifications._send_email_notification
    )
    monkeypatch.setenv("GMAIL_ADDRESS", SENDER)
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "app-password-for-tests")
    monkeypatch.delenv("ENROLLMENT_NOTIFY_TO", raising=False)
    client = forms_client_factory()
    SQLModel.metadata.create_all(
        client.db_engine, tables=[EnrollmentRequest.__table__]  # type: ignore[attr-defined]
    )
    return client


def _rows(client: TestClient) -> list[EnrollmentRequest]:
    with Session(client.db_engine) as session:  # type: ignore[attr-defined]
        return list(session.exec(select(EnrollmentRequest)).all())


def _parse(raw: bytes) -> tuple[email.message.Message, str]:
    """The message as the recipient's mail client sees it: (headers, body)."""
    msg = email.message_from_bytes(raw)
    body = msg.get_payload()[0].get_payload(decode=True).decode("utf-8")
    return msg, body


def _subject(msg: email.message.Message) -> str:
    return str(make_header(decode_header(msg["Subject"])))


# ─── Happy path and recipient ───────────────────────────────────────────────


def test_valid_request_saves_one_row_and_emails_the_notify_recipient(
    enroll_client: TestClient, smtp, monkeypatch
) -> None:
    monkeypatch.setenv("ENROLLMENT_NOTIFY_TO", NOTIFY_TO)
    payload = _payload()

    res = enroll_client.post(PATH, json=payload)

    assert res.status_code == 200, res.text
    assert res.json()["ok"] is True

    rows = _rows(enroll_client)
    assert len(rows) == 1
    row = rows[0]
    assert row.child_name == payload["child_name"]
    assert row.birth_date == date(2018, 5, 14)
    assert row.household_size == 5
    assert row.consent is True

    assert len(smtp.sent) == 1
    msg, body = _parse(smtp.sent[0])
    assert msg["To"] == NOTIFY_TO
    assert msg["From"] == SENDER
    # The family's names carry accents; the subject must survive encoding.
    assert _subject(msg) == "Matrícula: José Daniel Pérez"
    # Every field the family typed reaches the foundation's inbox.
    for name in (
        "guardian_name", "relationship", "phone", "email", "community",
        "address", "child_name", "birth_date", "grade", "current_school",
        "household_size", "monthly_income", "reason",
    ):
        assert str(payload[name]) in body, f"{name} is missing from the email body"


def test_recipient_falls_back_to_gmail_address_when_notify_var_is_unset(
    enroll_client: TestClient, smtp
) -> None:
    res = enroll_client.post(PATH, json=_payload())

    assert res.status_code == 200, res.text
    assert len(smtp.sent) == 1
    assert _parse(smtp.sent[0])[0]["To"] == SENDER


def test_optional_fields_may_be_omitted(enroll_client: TestClient) -> None:
    res = enroll_client.post(
        PATH, json=_without("email", "address", "current_school", "website")
    )

    assert res.status_code == 200, res.text
    row = _rows(enroll_client)[0]
    assert (row.email, row.address, row.current_school) == ("", "", "")


def test_reason_is_free_text_and_keeps_its_line_breaks(
    enroll_client: TestClient,
) -> None:
    reason = "Primera razón.\nSegunda razón."

    res = enroll_client.post(PATH, json=_payload(reason=reason))

    assert res.status_code == 200, res.text
    assert _rows(enroll_client)[0].reason == reason


def test_email_failure_after_the_row_is_saved_still_answers_ok(
    enroll_client: TestClient, smtp
) -> None:
    smtp.fail_login = True

    res = enroll_client.post(PATH, json=_payload())

    assert res.status_code == 200, res.text
    assert len(_rows(enroll_client)) == 1
    assert smtp.sent == []


# ─── Mailer: the optional `to` ───────────────────────────────────────────────


def test_send_email_notification_to_sets_the_to_header_and_keeps_the_sender(
    smtp, monkeypatch
) -> None:
    monkeypatch.setenv("GMAIL_ADDRESS", SENDER)
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "app-password-for-tests")

    err = notifications._send_email_notification("subject", "body", to=NOTIFY_TO)

    assert err is None
    msg, _ = _parse(smtp.sent[0])
    assert msg["To"] == NOTIFY_TO
    assert msg["From"] == SENDER
    assert smtp.logins == [(SENDER, "app-password-for-tests")]


def test_send_email_notification_without_to_still_goes_to_gmail_address(
    smtp, monkeypatch
) -> None:
    """The 6 pre-existing callers pass no `to` and must keep mailing the owner."""
    monkeypatch.setenv("GMAIL_ADDRESS", SENDER)
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "app-password-for-tests")

    err = notifications._send_email_notification("subject", "body")

    assert err is None
    assert _parse(smtp.sent[0])[0]["To"] == SENDER


# ─── Hardening: honeypot, consent, lengths, CRLF, dates, options ────────────


def test_honeypot_drops_the_request_silently(
    enroll_client: TestClient, smtp
) -> None:
    res = enroll_client.post(PATH, json=_payload(website="http://spam.example"))

    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert _rows(enroll_client) == []
    assert smtp.sent == []


def test_refused_consent_is_rejected(enroll_client: TestClient, smtp) -> None:
    res = enroll_client.post(PATH, json=_payload(consent=False))

    assert res.status_code == 422
    assert _rows(enroll_client) == []
    assert smtp.sent == []


def test_omitted_consent_is_rejected(enroll_client: TestClient) -> None:
    res = enroll_client.post(PATH, json=_without("consent"))

    assert res.status_code == 422
    assert _rows(enroll_client) == []


REQUIRED = [
    "guardian_name", "relationship", "phone", "community", "child_name",
    "birth_date", "grade", "household_size", "monthly_income", "reason",
]


@pytest.mark.parametrize("field", REQUIRED)
def test_each_required_field_is_required(enroll_client: TestClient, field: str) -> None:
    res = enroll_client.post(PATH, json=_without(field))

    assert res.status_code == 422
    assert _rows(enroll_client) == []


@pytest.mark.parametrize(
    "field",
    ["guardian_name", "community", "child_name", "grade", "reason"],
)
def test_whitespace_only_text_does_not_satisfy_a_required_field(
    enroll_client: TestClient, field: str
) -> None:
    res = enroll_client.post(PATH, json=_payload(**{field: "   "}))

    assert res.status_code == 422
    assert _rows(enroll_client) == []


# email and phone also reject a line break, but through their own shape check,
# so the CRLF validator is not what is under test for them.
SINGLE_LINE = [
    "guardian_name", "community", "address", "child_name", "grade", "current_school",
]


@pytest.mark.parametrize("field", SINGLE_LINE)
def test_crlf_in_a_single_line_field_is_rejected(
    enroll_client: TestClient, smtp, field: str
) -> None:
    """child_name lands in the Subject header, so a line break there is
    header injection; the other single-line fields land in the body."""
    res = enroll_client.post(PATH, json=_payload(**{field: "X\r\nBcc: spy@example.test"}))

    assert res.status_code == 422
    assert _rows(enroll_client) == []
    assert smtp.sent == []


@pytest.mark.parametrize(
    "field,value",
    [
        ("guardian_name", "A" * 6000),
        ("community", "A" * 6000),
        ("address", "A" * 6000),
        ("child_name", "A" * 6000),
        ("grade", "A" * 6000),
        ("current_school", "A" * 6000),
        ("reason", "A" * 6000),
        ("email", "a" * 300 + "@example.test"),
    ],
)
def test_over_long_field_is_rejected(
    enroll_client: TestClient, smtp, field: str, value: str
) -> None:
    res = enroll_client.post(PATH, json=_payload(**{field: value}))

    assert res.status_code == 422
    assert _rows(enroll_client) == []
    assert smtp.sent == []


def test_birth_date_today_is_accepted_and_tomorrow_is_not(
    enroll_client: TestClient,
) -> None:
    today = date.today()

    ok = enroll_client.post(PATH, json=_payload(birth_date=today.isoformat()))
    future = enroll_client.post(
        PATH, json=_payload(birth_date=(today + timedelta(days=1)).isoformat())
    )

    assert ok.status_code == 200, ok.text
    assert future.status_code == 422
    assert len(_rows(enroll_client)) == 1


@pytest.mark.parametrize("value", ["14/05/2018", "not a date", ""])
def test_birth_date_must_be_an_iso_date(enroll_client: TestClient, value: str) -> None:
    res = enroll_client.post(PATH, json=_payload(birth_date=value))

    assert res.status_code == 422
    assert _rows(enroll_client) == []


@pytest.mark.parametrize("field,value", [
    ("relationship", "Vecino"),
    ("monthly_income", "Mucho dinero"),
])
def test_unknown_option_value_is_rejected(
    enroll_client: TestClient, field: str, value: str
) -> None:
    res = enroll_client.post(PATH, json=_payload(**{field: value}))

    assert res.status_code == 422
    assert _rows(enroll_client) == []


@pytest.mark.parametrize("size", [0, 21, 1.5])
def test_household_size_must_be_a_whole_number_from_1_to_20(
    enroll_client: TestClient, size
) -> None:
    res = enroll_client.post(PATH, json=_payload(household_size=size))

    assert res.status_code == 422
    assert _rows(enroll_client) == []


@pytest.mark.parametrize("phone", ["12345", "9999-0000 ext 5"])
def test_phone_must_look_like_a_phone_number(
    enroll_client: TestClient, phone: str
) -> None:
    res = enroll_client.post(PATH, json=_payload(phone=phone))

    assert res.status_code == 422
    assert _rows(enroll_client) == []


@pytest.mark.parametrize("phone", ["9999-0000", "+504 9999 0000", "(504) 9999-0000"])
def test_common_honduran_phone_formats_are_accepted(
    enroll_client: TestClient, phone: str
) -> None:
    res = enroll_client.post(PATH, json=_payload(phone=phone))

    assert res.status_code == 200, res.text


def test_email_when_given_must_look_like_an_email(enroll_client: TestClient) -> None:
    res = enroll_client.post(PATH, json=_payload(email="no-at-sign"))

    assert res.status_code == 422
    assert _rows(enroll_client) == []


# ─── Rate limit ─────────────────────────────────────────────────────────────


def test_enrollment_shares_the_email_rate_budget_with_contact(
    enroll_client: TestClient,
) -> None:
    """Every enrollment sends an SMTP email, so it must draw from the same
    budget as /submit, /promo and /contact. Exhausting that budget on
    /contact must lock enrollment out too."""
    contact = {"name": "T", "email": "t@example.test", "message": "hi"}
    for _ in range(fastapi_forms.EMAIL_ENDPOINTS_RATE_LIMIT):
        assert enroll_client.post("/api/metal-archive/contact", json=contact).status_code == 200

    res = enroll_client.post(PATH, json=_payload())

    assert res.status_code == 429
    assert "Retry-After" in res.headers
    assert _rows(enroll_client) == []


# ─── Migration and page contract ────────────────────────────────────────────


def test_alembic_upgrade_head_creates_the_enrollment_table_the_model_declares(
    scratch_db: Path,
) -> None:
    """A model column the migration forgot would 500 every POST on the host
    (the T24 incident class: model and live table drifting apart)."""
    env = dict(os.environ)
    env["REFLEX_DB_URL"] = f"sqlite:///{scratch_db}"

    result = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", "upgrade", "head"],
        cwd=REPO_ROOT, env=env, capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr

    conn = sqlite3.connect(scratch_db)
    try:
        columns = {row[1] for row in conn.execute("PRAGMA table_info(enrollment_requests)")}
    finally:
        conn.close()
    assert columns == set(EnrollmentRequest.__table__.columns.keys())


def _page_form_block() -> str:
    source = PAGE.read_text()
    start = re.search(r'<form\b[^>]*\bid="enrollment-form"[^>]*>', source)
    assert start, 'no <form id="enrollment-form"> in matricula.astro'
    return source[start.end() : source.index("</form>", start.end())]


def test_page_form_fields_match_the_request_model() -> None:
    """The page builds its JSON from the form's `name` attributes. A renamed
    input would 422 every real submission (the T27 contact-form incident)."""
    sent = set(re.findall(r'\bname="([a-z_]+)"', _page_form_block()))
    accepted = set(fastapi_forms.EnrollmentPayload.model_fields)

    assert sent <= accepted, f"page sends fields the API does not know: {sent - accepted}"
    required = {n for n, f in fastapi_forms.EnrollmentPayload.model_fields.items() if f.is_required()}
    assert required <= sent, f"page never sends required fields: {required - sent}"


@pytest.mark.parametrize(
    "field,type_name", [("relationship", "Relationship"), ("monthly_income", "MonthlyIncome")]
)
def test_page_select_options_are_exactly_what_the_api_accepts(
    field: str, type_name: str
) -> None:
    allowed = get_args(getattr(fastapi_forms, type_name))
    select_html = re.search(
        rf'<select\b[^>]*\bname="{field}"[^>]*>(.*?)</select>', _page_form_block(), re.S
    )
    assert select_html, f"no <select name={field}> on the page"
    offered = re.findall(r'<option\b[^>]*\bvalue="([^"]+)"', select_html.group(1))

    assert offered == list(allowed)
