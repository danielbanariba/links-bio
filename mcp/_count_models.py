"""Helper script invoked by the MCP count_models_in_db tool.

Runs inside the project venv (so it has access to links_bio models).
Prints a JSON dict of table -> row count to stdout.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func
from sqlmodel import Session, select
import reflex as rx

from links_bio.models import (
    Album,
    ContactMessage,
    NewsletterSubscriber,
    SimilarBand,
    Submission,
    Track,
)

MODELS = {
    "albums": Album,
    "tracks": Track,
    "similar_bands": SimilarBand,
    "submissions": Submission,
    "newsletter_subscribers": NewsletterSubscriber,
    "contact_messages": ContactMessage,
}


def get_engine():
    for attr in ("get_db_engine", "_get_engine", "get_engine"):
        fn = getattr(rx.Model, attr, None)
        if callable(fn):
            return fn()
    raise RuntimeError("Could not locate engine accessor on rx.Model")


def main() -> None:
    engine = get_engine()
    counts: dict[str, int] = {}
    with Session(engine) as session:
        for name, model in MODELS.items():
            counts[name] = session.exec(select(func.count()).select_from(model)).one()
    print(json.dumps(counts))


if __name__ == "__main__":
    main()
