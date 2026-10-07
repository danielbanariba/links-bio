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

from links_bio.db import engine
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


def main() -> None:
    counts: dict[str, int] = {}
    with Session(engine) as session:
        for name, model in MODELS.items():
            counts[name] = session.exec(select(func.count()).select_from(model)).one()
    print(json.dumps(counts))


if __name__ == "__main__":
    main()
