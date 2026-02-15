import reflex as rx
import sqlmodel
from datetime import datetime


class ContactMessage(rx.Model, table=True):
    __tablename__ = "contact_messages"

    name: str = sqlmodel.Field(default="")
    email: str = sqlmodel.Field(default="")
    company: str = sqlmodel.Field(default="")
    message: str = sqlmodel.Field(default="")
    package_interest: str = sqlmodel.Field(default="")
    submitted_at: datetime = sqlmodel.Field(default_factory=datetime.now)
