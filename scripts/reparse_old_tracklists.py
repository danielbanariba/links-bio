"""
Re-parsea descriptions de albums con 0 tracks usando el parser actualizado.

Uso:
    env/bin/python scripts/reparse_old_tracklists.py --dry-run    # No toca DB
    env/bin/python scripts/reparse_old_tracklists.py              # Aplica cambios
    env/bin/python scripts/reparse_old_tracklists.py --limit 10   # Solo primeros 10
"""

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import rxconfig  # noqa: F401
import reflex as rx
from sqlmodel import select, func, col

from links_bio.models.album import Album
from links_bio.models.track import Track
from sync_youtube_to_db import parse_description_metadata


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    with rx.session() as session:
        albums_with_tracks = session.exec(
            select(Track.album_id).distinct()
        ).all()
        albums_with_tracks_set = set(albums_with_tracks)

        all_albums = session.exec(
            select(Album).where(Album.description != "")
        ).all()
        candidates = [a for a in all_albums if a.id not in albums_with_tracks_set]

        if args.limit:
            candidates = candidates[: args.limit]

        print(f"Albums con descripcion y sin tracks: {len(candidates)}")
        print()

        recovered = 0
        total_tracks_added = 0
        failed = 0

        for idx, album in enumerate(candidates, start=1):
            meta = parse_description_metadata(album.description)
            tracklist = meta.get("tracklist", [])

            if not tracklist:
                continue

            recovered += 1
            total_tracks_added += len(tracklist)
            print(
                f"  [{idx}/{len(candidates)}] {album.band_name} - {album.album_title}: "
                f"{len(tracklist)} tracks"
            )

            if args.dry_run:
                continue

            try:
                for tnum, t in enumerate(tracklist, start=1):
                    session.add(
                        Track(
                            album_id=album.id,
                            track_number=tnum,
                            track_name=t.get("name", "") or "",
                            timestamp=t.get("timestamp", "0:00"),
                        )
                    )
                if idx % 50 == 0:
                    session.commit()
            except Exception as e:
                failed += 1
                print(f"    ERROR: {e}")

        if not args.dry_run:
            session.commit()

        print()
        print("=" * 60)
        print(" RESUMEN")
        print("=" * 60)
        print(f"  Albums escaneados: {len(candidates)}")
        print(f"  Albums recuperados (con tracks parseados): {recovered}")
        print(f"  Tracks totales insertados: {total_tracks_added}")
        print(f"  Errores: {failed}")
        print(f"  Modo: {'DRY-RUN (sin tocar DB)' if args.dry_run else 'APLICADO'}")
        print("=" * 60)


if __name__ == "__main__":
    main()
