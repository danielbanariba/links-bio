import sqlmodel
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime


class NewsletterSubscriber(sqlmodel.SQLModel, table=True):
    __tablename__ = "newsletter_subscribers"

    id: Optional[int] = sqlmodel.Field(default=None, primary_key=True)
    email: str = sqlmodel.Field(unique=True, index=True)
    active: bool = sqlmodel.Field(default=True)
    # Naive local time, as stored since day one. A bare `datetime` field would be
    # a UTC-aware column under sqlmodel >= 0.0.45, so the type is explicit.
    subscribed_at: datetime = sqlmodel.Field(
        default_factory=datetime.now, sa_type=DateTime(timezone=False)
    )
