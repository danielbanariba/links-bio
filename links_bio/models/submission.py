import reflex as rx
import sqlmodel
from datetime import datetime


class Submission(rx.Model, table=True):
    __tablename__ = "submissions"

    band_name: str = sqlmodel.Field(index=True)
    contact_email: str = sqlmodel.Field(default="")
    genre: str = sqlmodel.Field(default="")
    country: str = sqlmodel.Field(default="")
    album_title: str = sqlmodel.Field(default="")
    youtube_url: str = sqlmodel.Field(default="")
    bandcamp_url: str = sqlmodel.Field(default="")
    description: str = sqlmodel.Field(default="")
    status: str = sqlmodel.Field(default="pendiente")
    submitted_at: datetime = sqlmodel.Field(default_factory=datetime.now)
