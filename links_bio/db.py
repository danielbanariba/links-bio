"""Single engine/session factory for the Metal Archive database.

This is the Reflex-free replacement for `rx.Model.get_db_engine()` /
`rx.session()`. Every live script and service (sync scripts, background_sync,
fastapi_forms, alembic) should get its engine or session from here instead of
building its own, so the connection settings and the DB URL resolution live in
exactly one place.

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

# SQLite connections are not thread-safe by default; reflex's get_engine()
# set this same flag for every sqlite URL, since the Reflex/FastAPI/background
# sync code paths all share one connection across threads.
_connect_args = {"check_same_thread": False} if DB_URL.startswith("sqlite") else {}

engine = create_engine(DB_URL, connect_args=_connect_args)


def get_session() -> Session:
    """Return a new SQLModel session bound to the shared engine."""
    return Session(engine)
