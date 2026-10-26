import sqlmodel
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime


class ContactMessage(sqlmodel.SQLModel, table=True):
    __tablename__ = "contact_messages"

    id: Optional[int] = sqlmodel.Field(default=None, primary_key=True)
    name: str = sqlmodel.Field(default="")
    email: str = sqlmodel.Field(default="")
    company: str = sqlmodel.Field(default="")
    message: str = sqlmodel.Field(default="")
    package_interest: str = sqlmodel.Field(default="")
    # Naive local time, as stored since day one. A bare `datetime` field would be
    # a UTC-aware column under sqlmodel >= 0.0.45, so the type is explicit.
    submitted_at: datetime = sqlmodel.Field(
        default_factory=datetime.now, sa_type=DateTime(timezone=False)
    )
