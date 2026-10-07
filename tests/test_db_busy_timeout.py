"""Regression guard for T10: a write that lands while another connection
holds the SQLite write lock must wait for it, not fail outright.

pysqlite's own default busy timeout is 5 seconds (`sqlite3.connect()`'s
`timeout` parameter, which `links_bio.db.engine` never overrode before this
fix). A form submission landing mid multi-second sync transaction hit that
default and raised "database is locked" as an unhandled 500 instead of
simply waiting a little longer for the lock to clear.

This test holds the write lock for longer than the OLD 5s default but
shorter than the NEW 30s timeout, so it is RED against the unmodified
`links_bio.db` and GREEN once the busy timeout is raised -- proving the
test actually catches the regression rather than always passing.
"""
from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
import threading
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Longer than pysqlite's un-overridden 5s default, well short of the fixed
# 30s busy_timeout -- RED on today's code, GREEN after the fix.
HOLD_SECONDS = 7.0

# Runs in a fresh subprocess (not this test process) so it exercises the
# real links_bio.db module-level `engine`, which binds its connect_args once
# at import time from REFLEX_DB_URL.
_WRITER_SCRIPT = """
from links_bio.db import engine
from sqlalchemy import text

with engine.begin() as conn:
    conn.execute(text("INSERT INTO busy_timeout_probe DEFAULT VALUES"))
print("WRITER_OK")
"""


def _hold_write_lock(db_path: Path, hold_seconds: float, started: threading.Event) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute("BEGIN IMMEDIATE")
    conn.execute("INSERT INTO busy_timeout_probe DEFAULT VALUES")
    started.set()
    time.sleep(hold_seconds)
    conn.commit()
    conn.close()


def test_write_waits_for_held_lock_instead_of_failing(scratch_db: Path) -> None:
    """A write landing while another connection holds the write lock must
    wait for links_bio.db's busy timeout instead of raising "database is
    locked" -- the exact failure mode a form submission hits if it lands
    mid-sync-transaction.
    """
    setup = sqlite3.connect(scratch_db)
    setup.execute("CREATE TABLE busy_timeout_probe (id INTEGER PRIMARY KEY)")
    setup.commit()
    setup.close()

    started = threading.Event()
    holder = threading.Thread(
        target=_hold_write_lock, args=(scratch_db, HOLD_SECONDS, started)
    )
    holder.start()
    assert started.wait(timeout=5), "holder thread never acquired the write lock"

    env = dict(os.environ)
    env["REFLEX_DB_URL"] = f"sqlite:///{scratch_db}"

    result = subprocess.run(
        [sys.executable, "-c", _WRITER_SCRIPT],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=HOLD_SECONDS + 15,
    )
    holder.join()

    assert result.returncode == 0 and "WRITER_OK" in result.stdout, (
        "write failed instead of waiting for the held lock to clear:\n"
        f"returncode={result.returncode}\n"
        f"stdout={result.stdout!r}\nstderr={result.stderr!r}"
    )
