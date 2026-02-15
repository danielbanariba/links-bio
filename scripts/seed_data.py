"""Seed the database with the 5 bands already on the site."""

import sys
from pathlib import Path

# Add project root to path so rxconfig and links_bio are importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import reflex as rx
from sqlmodel import select

import rxconfig  # noqa: F401

from links_bio.models.album import Album
from links_bio.models.track import Track
from links_bio.models.similar_band import SimilarBand


SEED_ALBUMS = [
    {
        "band_name": "Blasfemia",
        "album_title": "Inmaculada Concepcion",
        "year": 2023,
        "country": "Honduras",
        "genre": "Brutal Death Metal",
        "youtube_video_id": "S8CuyCYvYlE",
        "youtube_url": "https://youtu.be/S8CuyCYvYlE?si=KQ6PR6aBp-aKE54v",
        "album_artwork_url": "img_video/blasfemia.jpg",
        "description": "Blasfemia es una banda de Brutal Death Metal originario de Tegucigalpa, Honduras.",
        "featured": True,
        "tracks": [
            {"track_number": 1, "track_name": "Inmaculada Concepcion", "timestamp": "0:00"},
        ],
        "similar_bands": ["Cannibal Corpse", "Suffocation", "Desmembramiento"],
    },
    {
        "band_name": "Sobreporrosis",
        "album_title": "Aca no es Party",
        "year": 2023,
        "country": "Honduras",
        "genre": "Punk Rock",
        "youtube_video_id": "vE5s7QdB95I",
        "youtube_url": "https://youtu.be/vE5s7QdB95I?si=KntI0wqkG7Qj3XVF",
        "album_artwork_url": "img_video/sobreporrosis.jpg",
        "description": "Sobreporrosis es una banda de Punk Rock originario de Tegucigalpa, Honduras.",
        "featured": True,
        "tracks": [
            {"track_number": 1, "track_name": "Aca no es Party", "timestamp": "0:00"},
        ],
        "similar_bands": ["Los Cafres", "NOFX"],
    },
    {
        "band_name": "Lesath",
        "album_title": "El Enviado de Satan",
        "year": 2024,
        "country": "Honduras",
        "genre": "Death Metal Melodico",
        "youtube_video_id": "EAZR_GLTHyw",
        "youtube_url": "https://youtu.be/EAZR_GLTHyw",
        "album_artwork_url": "img_video/lesath.jpg",
        "description": "Lesath es una banda de Death Metal Melodico originario de Tegucigalpa, Honduras.",
        "featured": True,
        "tracks": [
            {"track_number": 1, "track_name": "El Enviado de Satan", "timestamp": "0:00"},
        ],
        "similar_bands": ["Amon Amarth", "Dark Tranquillity", "Arch Enemy"],
    },
    {
        "band_name": "Desmembramiento",
        "album_title": "Maldita Enfermedad",
        "year": 2024,
        "country": "Honduras",
        "genre": "Death Metal",
        "youtube_video_id": "lvH-dy-Gn0Y",
        "youtube_url": "https://youtu.be/lvH-dy-Gn0Y",
        "album_artwork_url": "img_video/desmembramiento.webp",
        "description": "Desmembramiento es una banda de Death Metal originario de Tegucigalpa, Honduras.",
        "featured": True,
        "tracks": [
            {"track_number": 1, "track_name": "Maldita Enfermedad", "timestamp": "0:00"},
        ],
        "similar_bands": ["Blasfemia", "Obituary", "Morbid Angel"],
    },
    {
        "band_name": "Krisis",
        "album_title": "Johd Ass",
        "year": 2024,
        "country": "Honduras",
        "genre": "Grind/Death Metal",
        "youtube_video_id": "548LqsbFhSw",
        "youtube_url": "https://youtu.be/548LqsbFhSw",
        "album_artwork_url": "img_video/krisis.webp",
        "description": "Krisis es una banda de Grind/Death metal originario de San Pedro Sula, Honduras.",
        "featured": True,
        "tracks": [
            {"track_number": 1, "track_name": "Johd Ass", "timestamp": "0:00"},
        ],
        "similar_bands": ["Napalm Death", "Carcass", "Terrorizer"],
    },
]


def seed():
    with rx.session() as session:
        # Check if already seeded
        existing = session.exec(select(Album)).first()
        if existing:
            print("Database already has data. Skipping seed.")
            return

        for album_data in SEED_ALBUMS:
            tracks_data = album_data.pop("tracks", [])
            similar_bands_data = album_data.pop("similar_bands", [])

            album = Album(**album_data)
            session.add(album)
            session.flush()  # get the album.id

            for track_data in tracks_data:
                track = Track(album_id=album.id, **track_data)
                session.add(track)

            for band_name in similar_bands_data:
                similar = SimilarBand(album_id=album.id, similar_band_name=band_name)
                session.add(similar)

        session.commit()
        print(f"Seeded {len(SEED_ALBUMS)} albums successfully!")


if __name__ == "__main__":
    seed()
