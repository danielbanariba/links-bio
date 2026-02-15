import reflex as rx
import sqlmodel


class Track(rx.Model, table=True):
    __tablename__ = "tracks"

    album_id: int = sqlmodel.Field(index=True)
    track_number: int = sqlmodel.Field(default=1)
    track_name: str = sqlmodel.Field(default="")
    timestamp: str = sqlmodel.Field(default="0:00")
