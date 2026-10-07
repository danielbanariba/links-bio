"""Regression guard for mcp/server.py's check_migrations_pending (T25 item
3): it used to report the key `pending` holding only the alembic head
whenever the DB was behind, so a consumer reading it would wrongly believe
exactly one migration was pending even when the DB was two or more
revisions behind.

Loads mcp/server.py by file path (never `import mcp.server`, which would
resolve to the installed `mcp` SDK package of the same name, not this
project's script) and never touches the dev or production reflex.db: it
drives the tool against a scratch copy stamped to a revision several steps
behind the real head, using REFLEX_DB_URL to redirect alembic at it.
"""
from __future__ import annotations

import importlib.util
import sqlite3
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
PROD_ALEMBIC = Path("/home/banar/Desktop/links-bio/env/bin/alembic")


def _load_mcp_server():
    """Load mcp/server.py by its file path under a private module name, so
    it never collides with (or gets shadowed by) the installed `mcp` SDK
    package that the loaded module itself imports from."""
    path = REPO_ROOT / "mcp" / "server.py"
    spec = importlib.util.spec_from_file_location("links_bio_mcp_server_under_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def mcp_server(monkeypatch: pytest.MonkeyPatch):
    """The real mcp/server.py module, with ALEMBIC_BIN repointed at the
    production venv's alembic binary (this worktree has no env/ of its
    own -- see tests/conftest.py's scratch_db docstring for the same
    constraint on tests that need a real DB)."""
    if not PROD_ALEMBIC.exists():
        pytest.skip(f"no alembic binary at {PROD_ALEMBIC} to drive check_db_schema")
    module = _load_mcp_server()
    monkeypatch.setattr(module, "ALEMBIC_BIN", PROD_ALEMBIC)
    return module


def _stamp_revision(db_path: Path, revision: str) -> None:
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("UPDATE alembic_version SET version_num = ?", (revision,))
        conn.commit()
    finally:
        conn.close()


def test_check_migrations_pending_reports_every_unapplied_revision(
    scratch_db: Path,
    monkeypatch: pytest.MonkeyPatch,
    mcp_server,
) -> None:
    """Stamps a scratch DB two revisions behind the real alembic head and
    asserts `pending` names both unapplied revisions, not just the head.
    The expected revision ids are derived at test time from alembic's own
    ScriptDirectory (never hardcoded), so this stays correct as new
    migrations are added.
    """
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    cfg = Config(str(REPO_ROOT / "alembic.ini"))
    script = ScriptDirectory.from_config(cfg)
    head = script.get_current_head()
    chain = list(script.walk_revisions(base="base", head=head))
    if len(chain) < 3:
        pytest.skip("migration history too short to stamp 2 revisions behind head")

    two_behind = chain[2].revision  # chain[0]=head, [1]=head-1, [2]=head-2
    _stamp_revision(scratch_db, two_behind)
    monkeypatch.setenv("REFLEX_DB_URL", f"sqlite:///{scratch_db}")

    result = mcp_server.check_migrations_pending()

    assert result["ok"] is False
    assert result["current"] == two_behind
    assert result["head"] == head
    expected_pending = {chain[0].revision, chain[1].revision}
    assert set(result["pending"]) == expected_pending, (
        f"expected both unapplied revisions {expected_pending}, "
        f"got {result['pending']!r} (the old code only ever reported [head])"
    )
