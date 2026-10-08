"""Shared pytest fixtures.

Every fixture here that touches a database operates on a throwaway scratch
copy, never on the live `reflex.db`. The scratch copy is made the same way
`scripts/backup_reflex_db.sh` makes one for real: an online `sqlite3 .backup`
of a read-only connection, never a raw file copy of a live database.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import create_engine

REPO_ROOT = Path(__file__).resolve().parent.parent
DEV_DB = REPO_ROOT / "reflex.db"
SQLITE3_BIN = "/usr/bin/sqlite3"


@pytest.fixture
def scratch_db(tmp_path: Path) -> Path:
    """A private, pytest-managed copy of the worktree's dev `reflex.db`.

    Used by any test that needs to run a migration or write rows without
    touching the shared dev DB (and never the production one, which this
    worktree cannot reach).
    """
    if not DEV_DB.exists():
        pytest.skip(f"no dev reflex.db at {DEV_DB} to copy from")
    dst = tmp_path / "reflex.db"
    subprocess.run(
        [SQLITE3_BIN, f"file:{DEV_DB}?mode=ro", f".backup {dst}"],
        check=True,
        capture_output=True,
    )
    return dst


@pytest.fixture
def clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Strip env vars that would let a test accidentally reach a real
    side effect (a real email, a real deploy, a real Vercel/YouTube call).
    """
    for key in (
        "GMAIL_ADDRESS",
        "GMAIL_APP_PASSWORD",
        "VERCEL_TOKEN",
        "YOUTUBE_API_KEY",
        "YOUTUBE_REFRESH_TOKEN",
    ):
        monkeypatch.delenv(key, raising=False)


@pytest.fixture
def fake_vercel_bin(tmp_path: Path) -> Path:
    """Install a fake `vercel` executable on a PATH prefix that records its
    argv (one line, shell-quoted) to a file instead of touching the network.

    Tests select the fake's exit code by writing to `<bin_dir>/vercel.exit`
    (defaults to 0 when absent) -- this only governs `vercel deploy`.
    `vercel whoami` always exits 0 here: deploy_to_vercel() now runs a
    whoami preflight before every deploy, and if it honored the same exit
    file it would fail there instead, short-circuiting before the deploy
    call these tests exist to exercise.
    """
    bin_dir = tmp_path / "fakebin"
    bin_dir.mkdir()
    recorded = tmp_path / "vercel_argv.txt"
    exit_file = bin_dir / "vercel.exit"
    script = bin_dir / "vercel"
    script.write_text(
        "#!/usr/bin/env bash\n"
        f"for a in \"$@\"; do printf '%s\\n' \"$a\" >> {recorded}; done\n"
        f"printf -- '--\\n' >> {recorded}\n"
        "if [ \"$1\" = \"whoami\" ]; then exit 0; fi\n"
        f"if [ -f {exit_file} ]; then exit \"$(cat {exit_file})\"; fi\n"
        "exit 0\n"
    )
    script.chmod(0o755)
    return bin_dir


@pytest.fixture
def forms_client_factory(scratch_db: Path, clean_env, monkeypatch):
    """Factory for TestClients against the real FastAPI forms app, all
    sharing one scratch DB, one stubbed email sink, and the process-wide
    rate limiters -- the same way every caller shares one uvicorn process
    in production. Pass a `client=(host, port)` tuple to simulate a
    specific direct TCP peer (the default is TestClient's own "testclient"
    pseudo-peer, which is never a loopback address). Shared by
    tests/test_forms_hardening.py and tests/test_forms_contract.py so both
    build clients the same way.
    """
    from links_bio import fastapi_forms

    engine = create_engine(
        f"sqlite:///{scratch_db}", connect_args={"check_same_thread": False}
    )
    monkeypatch.setattr(fastapi_forms, "engine", engine)

    sent: list[tuple[str, str]] = []

    def fake_send(subject: str, body: str) -> None:
        sent.append((subject, body))
        return None

    monkeypatch.setattr(fastapi_forms, "_send_email_notification", fake_send)

    fastapi_forms._email_limiter.reset()
    fastapi_forms._newsletter_limiter.reset()

    def make(client: tuple[str, int] = ("testclient", 50000)) -> TestClient:
        tc = TestClient(fastapi_forms.app, client=client)
        tc.sent_emails = sent  # type: ignore[attr-defined]
        tc.db_engine = engine  # type: ignore[attr-defined]
        return tc

    yield make

    fastapi_forms._email_limiter.reset()
    fastapi_forms._newsletter_limiter.reset()


@pytest.fixture
def forms_client(forms_client_factory) -> TestClient:
    """A single default-peer TestClient -- the common case for tests that
    don't care about client identity."""
    return forms_client_factory()
