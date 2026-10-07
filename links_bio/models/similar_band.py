import sqlmodel
from typing import Optional


class SimilarBand(sqlmodel.SQLModel, table=True):
    __tablename__ = "similar_bands"

    id: Optional[int] = sqlmodel.Field(default=None, primary_key=True)
    album_id: int = sqlmodel.Field(index=True)
    similar_band_name: str = sqlmodel.Field(default="")
