"""Regression guards for mcp/server.py's check_migrations_pending (T25 item
3, T26 items 2-3).

Loads mcp/server.py by file path (never `import mcp.server`, which would
resolve to the installed `mcp` SDK package of the same name, not this
project's script) and never touches the dev or production reflex.db except
through the `scratch_db` fixture's throwaway copy.

T26 item 3: the previous version of this file hardcoded an absolute path to
a production venv's `alembic` binary and skipped everywhere else. The
multi-revision assertion now calls `_pending_revisions()` directly on the
loaded module -- it needs no external binary at all, only the real alembic
script directory already checked into this repo. The one test that still
needs a real `alembic` executable discovers it via `shutil.which`, which
works in any environment that has alembic on PATH (this worktree's test
runner included) instead of a hardcoded prod-only path.
"""
from __future__ import annotations

import importlib.util
import shutil
import sqlite3
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent


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
def mcp_server():
    """The real mcp/server.py module. Importing it no longer requires
    alembic to be resolvable at all (T26 item 2 made the alembic import
    lazy, inside `_pending_revisions`), so this fixture needs no binary
    and no monkeypatching to simply load the module."""
    return _load_mcp_server()


def _real_revision_chain():
    """Discover (head, chain) from THIS repo's real alembic script
    directory -- never a hardcoded revision id, so this stays correct as
    migrations are added or removed."""
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    cfg = Config(str(REPO_ROOT / "alembic.ini"))
    script = ScriptDirectory.from_config(cfg)
    head = script.get_current_head()
    chain = list(script.walk_revisions(base="base", head=head))
    return head, chain


def _stamp_revision(db_path: Path, revision: str) -> None:
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("UPDATE alembic_version SET version_num = ?", (revision,))
        conn.commit()
    finally:
        conn.close()


def test_pending_revisions_reports_every_unapplied_revision(mcp_server) -> None:
    """Regression guard for T25 item 3: check_migrations_pending used to
    report only the head under `pending` even when the DB was two or more
    revisions behind, so a consumer would wrongly believe exactly one
    migration was outstanding. Calls `_pending_revisions()` directly on
    the loaded module with revision ids discovered dynamically from the
    real alembic ScriptDirectory -- no DB, no alembic binary, no
    hardcoded path needed.
    """
    head, chain = _real_revision_chain()
    if len(chain) < 3:
        pytest.skip("migration history too short to need 2 revisions behind head")
    two_behind = chain[2].revision  # chain[0]=head, [1]=head-1, [2]=head-2

    pending = mcp_server._pending_revisions(two_behind, head)

    expected_pending = {chain[0].revision, chain[1].revision}
    assert set(pending) == expected_pending, (
        f"expected both unapplied revisions {expected_pending}, "
        f"got {pending!r} (the old code only ever reported [head])"
    )


def test_check_migrations_pending_returns_error_instead_of_raising_on_broken_script_location(
    mcp_server, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """RED/GREEN for T26 item 2: alembic's `ScriptDirectory.from_config`
    raises `CommandError` when `script_location` can't be resolved to a
    real directory. Before this fix, `_pending_revisions` let that
    exception escape `check_migrations_pending` and crash the whole call
    (and, since alembic used to be imported at module scope, a missing
    alembic could crash every tool in the process at import time). This
    forces that exact failure -- a `PROJECT_ROOT` whose `alembic/`
    subdirectory doesn't exist -- and asserts the tool now returns its
    normal dict shape with an `error` field instead of raising.
    """
    monkeypatch.setattr(
        mcp_server,
        "check_db_schema",
        lambda: {"ok": False, "current": "deadbeef0001", "head": "deadbeef0002"},
    )
    monkeypatch.setattr(mcp_server, "PROJECT_ROOT", tmp_path)

    result = mcp_server.check_migrations_pending()

    assert result["ok"] is False
    assert result.get("pending") in (None, [])
    assert result.get("error"), (
        f"expected an `error` field describing the broken script_location, got: {result!r}"
    )
    assert result["current"] == "deadbeef0001"
    assert result["head"] == "deadbeef0002"


@pytest.fixture
def real_alembic_bin() -> Path:
    """Discover a real `alembic` executable via `shutil.which` instead of
    a hardcoded production-venv path. Skips when none is on PATH, exactly
    as the old hardcoded-path fixture skipped when that one path didn't
    exist -- but portably, in any environment that has alembic installed.
    """
    found = shutil.which("alembic")
    if not found:
        pytest.skip("no `alembic` executable on PATH to drive check_db_schema")
    return Path(found)


def test_check_migrations_pending_end_to_end_via_real_alembic_subprocess(
    scratch_db: Path,
    monkeypatch: pytest.MonkeyPatch,
    mcp_server,
    real_alembic_bin: Path,
) -> None:
    """Keeps subprocess-dependent coverage alive without the hardcoded
    path: exercises the real ALEMBIC_BIN subprocess call (check_db_schema)
    together with the in-process pending walk, which the direct-call test
    above does not cover (it never calls check_migrations_pending itself,
    only its _pending_revisions helper). Stamps a scratch DB two
    revisions behind the real head and asserts both unapplied revisions
    are reported.
    """
    monkeypatch.setattr(mcp_server, "ALEMBIC_BIN", real_alembic_bin)
    head, chain = _real_revision_chain()
    if len(chain) < 3:
        pytest.skip("migration history too short to stamp 2 revisions behind head")

    two_behind = chain[2].revision
    _stamp_revision(scratch_db, two_behind)
    monkeypatch.setenv("REFLEX_DB_URL", f"sqlite:///{scratch_db}")

    result = mcp_server.check_migrations_pending()

    assert result["ok"] is False
    assert result["current"] == two_behind
    assert result["head"] == head
    expected_pending = {chain[0].revision, chain[1].revision}
    assert set(result["pending"]) == expected_pending, (
        f"expected both unapplied revisions {expected_pending}, got {result['pending']!r}"
    )
