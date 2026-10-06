"""Regression guard for scripts/notify_failure.py.

It must build a subject that names the failed unit and a body containing
the journal tail, then call the email notifier exactly once, propagating
its error so the systemd unit itself fails visibly when the alert can't be
sent. Both the journal read and the real email sender are stubbed here --
this test must never be able to send a real email or shell out to
journalctl.
"""
from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from scripts import notify_failure  # noqa: E402


def test_notify_builds_subject_and_body_and_sends_exactly_once(monkeypatch):
    calls = []

    monkeypatch.setattr(
        notify_failure, "_journal_tail", lambda unit, lines=60: f"FAKE JOURNAL TAIL for {unit}"
    )

    def fake_send(subject, body):
        calls.append((subject, body))
        return None

    monkeypatch.setattr(notify_failure, "_send_email_notification", fake_send)

    err = notify_failure.notify("reflex-db-backup.service")

    assert err is None
    assert len(calls) == 1, "the notifier must be called exactly once per failure"
    subject, body = calls[0]
    assert "reflex-db-backup.service" in subject
    assert "FAKE JOURNAL TAIL for reflex-db-backup.service" in body


def test_notify_propagates_notifier_error(monkeypatch):
    monkeypatch.setattr(notify_failure, "_journal_tail", lambda unit, lines=60: "x")
    monkeypatch.setattr(notify_failure, "_send_email_notification", lambda s, b: "boom")

    assert notify_failure.notify("some.service") == "boom"


def test_main_exits_nonzero_when_notifier_fails(monkeypatch):
    monkeypatch.setattr(notify_failure, "_journal_tail", lambda unit, lines=60: "x")
    monkeypatch.setattr(notify_failure, "_send_email_notification", lambda s, b: "smtp down")

    assert notify_failure.main(["notify_failure.py", "some.service"]) != 0


def test_main_exits_zero_when_notifier_succeeds(monkeypatch):
    monkeypatch.setattr(notify_failure, "_journal_tail", lambda unit, lines=60: "x")
    monkeypatch.setattr(notify_failure, "_send_email_notification", lambda s, b: None)

    assert notify_failure.main(["notify_failure.py", "some.service"]) == 0
