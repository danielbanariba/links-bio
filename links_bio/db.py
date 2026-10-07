"""Single engine/session factory for the Metal Archive database.

This is the Reflex-free replacement for the old `rx.Model`-based engine
accessor and session helper. Every live script and service (sync scripts,
background_sync, fastapi_forms, alembic) should get its engine or session
from here instead of building its own, so the connection settings and the DB
URL resolution live in exactly one place.

DB URL resolution mirrors what `rx.Model` did via rxconfig.py's
`db_url="sqlite:///reflex.db"`: relative to the process cwd, which in
production is always the repo root. To keep that behavior while removing the
reflex dependency, the default here is made absolute by resolving it from
this file's own location (`links_bio/db.py` -> repo root -> reflex.db),
so importing this module from a different cwd still points at the same file.
"""

from __future__ import annotations

import os
from pathlib import Path

from sqlmodel import Session, create_engine

REPO_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_DB_URL = f"sqlite:///{REPO_ROOT / 'reflex.db'}"

DB_URL = os.environ.get("REFLEX_DB_URL", _DEFAULT_DB_URL)

# pysqlite's own default busy timeout is 5 seconds (the `timeout` parameter
# `sqlite3.connect()` uses when the caller doesn't pass one). A write that
# lands while another connection -- a sync script, a backup, a form request
# -- holds the write lock for longer than that raises "database is locked"
# outright instead of simply waiting a little longer. Raise it so a write
# queues behind the lock instead of failing.
#
# Deliberately NOT switching to WAL here: WAL permanently converts the DB
# file's journal mode on first connect, and the read-only consumers this
# repo already depends on -- the restic backup's
# `sqlite3 'file:...?mode=ro' .backup` and Astro's read-only better-sqlite3
# build -- are not guaranteed to handle that correctly.
SQLITE_BUSY_TIMEOUT_SECONDS = 30

# SQLite connections are not thread-safe by default; reflex's get_engine()
# set this same flag for every sqlite URL, since the Reflex/FastAPI/background
# sync code paths all share one connection across threads.
_connect_args = (
    {"check_same_thread": False, "timeout": SQLITE_BUSY_TIMEOUT_SECONDS}
    if DB_URL.startswith("sqlite")
    else {}
)

engine = create_engine(DB_URL, connect_args=_connect_args)


def get_session() -> Session:
    """Return a new SQLModel session bound to the shared engine."""
    return Session(engine)
