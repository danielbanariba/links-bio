import reflex as rx
import sqlmodel
from datetime import datetime
from typing import Optional


class Album(rx.Model, table=True):
    __tablename__ = "albums"

    band_name: str = sqlmodel.Field(index=True)
    album_title: str = sqlmodel.Field(index=True)
    year: int = sqlmodel.Field(index=True)
    country: str = sqlmodel.Field(index=True)
    genre: str = sqlmodel.Field(index=True)
    release_type: str = sqlmodel.Field(default="", index=True)
    youtube_video_id: str = sqlmodel.Field(default="", unique=True, index=True)
    youtube_url: str = sqlmodel.Field(default="")
    spotify_url: str = sqlmodel.Field(default="")
    bandcamp_url: str = sqlmodel.Field(default="")
    apple_music_url: str = sqlmodel.Field(default="")
    facebook_url: str = sqlmodel.Field(default="")
    instagram_url: str = sqlmodel.Field(default="")
    metal_archives_url: str = sqlmodel.Field(default="")
    album_artwork_url: str = sqlmodel.Field(default="")
    description: str = sqlmodel.Field(default="")
    duration_minutes: Optional[int] = sqlmodel.Field(default=None)
    views: int = sqlmodel.Field(default=0, index=True)
    featured: bool = sqlmodel.Field(default=False, index=True)
    upload_date: datetime = sqlmodel.Field(default_factory=datetime.now, index=True)
