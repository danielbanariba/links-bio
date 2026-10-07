"""Regression guard for T24: the live `submissions` table was missing the
`year` column the Submission model has declared since 2026-06-15 (be5984f),
so every POST /api/metal-archive/submit failed with a 500
(sqlite3.OperationalError: table submissions has no column named year).

This test fails if the migration chain that adds the column regresses: the
revision is reverted, skipped, or the column is dropped from a later
migration without being re-added.
"""
from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def test_alembic_upgrade_head_adds_submissions_year_column(scratch_db: Path) -> None:
    env = dict(os.environ)
    env["REFLEX_DB_URL"] = f"sqlite:///{scratch_db}"

    result = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", "upgrade", "head"],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"alembic upgrade head failed on the scratch DB:\n{result.stderr}"
    )

    conn = sqlite3.connect(scratch_db)
    try:
        columns = {row[1] for row in conn.execute("PRAGMA table_info(submissions)")}
    finally:
        conn.close()

    assert "year" in columns, (
        "submissions.year is missing after `alembic upgrade head`; "
        "the T24 migration regressed"
    )
