#!/usr/bin/env python3
"""Send exactly one email alert when a systemd unit's OnFailure= fires.

Usage:
    scripts/notify_failure.py <unit-name>

Meant to be run by a systemd user template unit
(systemd/notify-failure@.service) as OnFailure=notify-failure@%n.service on
another unit, so %i is that unit's own name. This is the single alert
mechanism for every unit in this project: sync_and_deploy.py, the backup
job, and the restore-test job all rely on their own OnFailure= firing this
script instead of emailing themselves, so a failure is reported exactly
once no matter which step inside the unit failed.

Exits non-zero if the alert email itself could not be sent, so that failure
is visible too (in `systemctl --user status notify-failure@<unit>.service`
and the journal), instead of silently swallowing it.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from links_bio.notifications import _send_email_notification  # noqa: E402

JOURNAL_LINES = 60
# Secrets loaded from .env that must never be forwarded by email, even if a
# unit printed one to its journal.
SECRET_ENV_VARS = ("VERCEL_TOKEN", "GMAIL_APP_PASSWORD", "YOUTUBE_API_KEY",
                   "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN")


def _redact(text: str) -> str:
    for name in SECRET_ENV_VARS:
        value = os.environ.get(name, "")
        if len(value) >= 8:
            text = text.replace(value, "****")
    return text


def _journal_tail(unit: str, lines: int = JOURNAL_LINES) -> str:
    """Return the last `lines` journal lines for `unit`, or a fallback note
    if journalctl itself is unavailable or fails."""
    try:
        result = subprocess.run(
            ["journalctl", "--user", "-u", unit, "-n", str(lines), "--no-pager"],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except Exception as exc:
        return f"(could not read journal for {unit}: {exc}; see `journalctl --user -u {unit}`)"

    if result.returncode != 0 or not result.stdout.strip():
        detail = result.stderr.strip() or f"exit code {result.returncode}"
        return (
            f"(could not read journal for {unit}: {detail}; "
            f"see `journalctl --user -u {unit}`)"
        )
    return result.stdout


def notify(unit: str) -> str | None:
    """Build and send the one alert email for `unit`. Returns the notifier's
    error string on failure, or None on success."""
    subject = f"links-bio: {unit} failed"
    body = (
        f"systemd unit {unit} reported failure (OnFailure=).\n\n"
        f"Last {JOURNAL_LINES} journal lines:\n"
        f"{'-' * 60}\n"
        f"{_redact(_journal_tail(unit))}"
    )
    return _send_email_notification(subject, body)


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: notify_failure.py <unit-name>", file=sys.stderr)
        return 2
    unit = argv[1]

    try:
        from dotenv import load_dotenv

        load_dotenv(PROJECT_ROOT / ".env")
    except ImportError:
        pass

    err = notify(unit)
    if err:
        print(f"notify_failure: could not send alert email for {unit}: {err}", file=sys.stderr)
        return 1

    print(f"notify_failure: alert email sent for {unit}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
