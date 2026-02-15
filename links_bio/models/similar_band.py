import reflex as rx
import sqlmodel


class SimilarBand(rx.Model, table=True):
    __tablename__ = "similar_bands"

    album_id: int = sqlmodel.Field(index=True)
    similar_band_name: str = sqlmodel.Field(default="")
