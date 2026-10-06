import sqlmodel
from datetime import datetime
from typing import Optional


class NewsletterSubscriber(sqlmodel.SQLModel, table=True):
    __tablename__ = "newsletter_subscribers"

    id: Optional[int] = sqlmodel.Field(default=None, primary_key=True)
    email: str = sqlmodel.Field(unique=True, index=True)
    active: bool = sqlmodel.Field(default=True)
    subscribed_at: datetime = sqlmodel.Field(default_factory=datetime.now)
