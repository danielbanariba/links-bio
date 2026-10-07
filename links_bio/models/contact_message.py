import sqlmodel
from datetime import datetime
from typing import Optional


class ContactMessage(sqlmodel.SQLModel, table=True):
    __tablename__ = "contact_messages"

    id: Optional[int] = sqlmodel.Field(default=None, primary_key=True)
    name: str = sqlmodel.Field(default="")
    email: str = sqlmodel.Field(default="")
    company: str = sqlmodel.Field(default="")
    message: str = sqlmodel.Field(default="")
    package_interest: str = sqlmodel.Field(default="")
    submitted_at: datetime = sqlmodel.Field(default_factory=datetime.now)
