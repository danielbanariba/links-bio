import sqlmodel
from typing import Optional


class Track(sqlmodel.SQLModel, table=True):
    __tablename__ = "tracks"

    id: Optional[int] = sqlmodel.Field(default=None, primary_key=True)
    album_id: int = sqlmodel.Field(index=True)
    track_number: int = sqlmodel.Field(default=1)
    track_name: str = sqlmodel.Field(default="")
    timestamp: str = sqlmodel.Field(default="0:00")
