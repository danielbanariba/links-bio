import reflex as rx
import sqlmodel
from datetime import datetime


class NewsletterSubscriber(rx.Model, table=True):
    __tablename__ = "newsletter_subscribers"

    email: str = sqlmodel.Field(unique=True, index=True)
    active: bool = sqlmodel.Field(default=True)
    subscribed_at: datetime = sqlmodel.Field(default_factory=datetime.now)
