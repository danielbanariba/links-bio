#!/usr/bin/env python3
"""
Busca portadas faltantes en Metal Archives y como fallback
usa el thumbnail de YouTube en maxima resolucion.

Solo procesa albums que todavia tienen thumbnails de YouTube.

Uso:
    python sync_artwork_fallback.py                  # Sincronizar todo
    python sync_artwork_fallback.py --dry-run        # Solo mostrar
    python sync_artwork_fallback.py --limite 10      # Limitar
"""

import argparse
import re
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))

import reflex as rx
from sqlmodel import select, col
from links_bio.models.album import Album

MA_SEARCH_URL = "https://www.metal-archives.com/search/ajax-advanced/searching/albums"
DELAY = 1.5  # Metal Archives rate limits aggressively


def normalize(text):
    if not text:
        return ""
    return " ".join(text.lower().strip().split())


def buscar_metal_archives(session, band_name, album_title):
    """
    Search Metal Archives for album cover.
    Returns artwork URL or None.
    """
    try:
        r = session.get(
            MA_SEARCH_URL,
            params={
                "bandName": band_name,
                "releaseTitle": album_title,
                "releaseYearFrom": "",
                "releaseYearTo": "",
                "releaseType[]": "",
                "iDisplayStart": 0,
                "iDisplayLength": 5,
            },
            timeout=15,
        )
    except requests.RequestException as e:
        return None

    if r.status_code == 429:
        time.sleep(10)
        return buscar_metal_archives(session, band_name, album_title)

    if r.status_code != 200:
        return None

    try:
        data = r.json()
    except Exception:
        return None

    rows = data.get("aaData", [])
    if not rows:
        return None

    band_norm = normalize(band_name)

    for row in rows:
        # row[0] = band link HTML, row[1] = album link HTML
        band_match = re.search(r">([^<]+)<", row[0])
        album_match = re.search(r">([^<]+)<", row[1])
        if not band_match or not album_match:
            continue

        ma_band = normalize(band_match.group(1))
        ma_album = normalize(album_match.group(1))

        if ma_band == band_norm:
            # Get album page URL to extract cover
            album_url_match = re.search(r'href="([^"]+)"', row[1])
            if album_url_match:
                album_url = album_url_match.group(1)
                # Metal Archives album covers follow pattern:
                # https://www.metal-archives.com/images/X/X/X/XXXXX.jpg
                album_id_match = re.search(r'/albums/[^/]+/[^/]+/(\d+)', album_url)
                if album_id_match:
                    album_id = album_id_match.group(1)
                    cover_url = f"https://www.metal-archives.com/images/{album_id[0]}/{album_id[1]}/{album_id[2]}/{album_id}.jpg"
                    # Verify it exists
                    try:
                        check = session.head(cover_url, timeout=10)
                        if check.status_code == 200:
                            return cover_url
                    except Exception:
                        pass

    return None


def youtube_maxres_thumbnail(youtube_video_id):
    """
    Get YouTube thumbnail in maximum resolution.
    Tries maxresdefault first, then sddefault, then hqdefault.
    """
    if not youtube_video_id:
        return None

    session = requests.Session()
    for quality in ["maxresdefault", "sddefault", "hqdefault"]:
        url = f"https://i.ytimg.com/vi/{youtube_video_id}/{quality}.jpg"
        try:
            r = session.head(url, timeout=10)
            if r.status_code == 200:
                content_length = int(r.headers.get("Content-Length", 0))
                # YouTube returns a small placeholder for missing thumbnails
                if content_length > 2000:
                    return url
        except Exception:
            continue

    return f"https://i.ytimg.com/vi/{youtube_video_id}/hqdefault.jpg"


def main():
    parser = argparse.ArgumentParser(description="Fallback artwork search")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limite", type=int, default=0)
    args = parser.parse_args()

    print("=" * 60)
    print(" SYNC ARTWORK FALLBACK (Metal Archives + YouTube HD)")
    print("=" * 60)

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/json",
    })

    with rx.session() as db_session:
        query = (
            select(Album)
            .where(Album.album_artwork_url.like("https://i.ytimg.com%"))
            .order_by(col(Album.id))
        )

        if args.limite:
            query = query.limit(args.limite)

        albums = db_session.exec(query).all()
        print(f"\n  {len(albums)} albums con thumbnail de YouTube\n")

        ma_found = 0
        yt_upgraded = 0
        unchanged = 0

        for i, album in enumerate(albums, 1):
            band = album.band_name
            title = album.album_title
            print(f"  [{i}/{len(albums)}] {band} - {title}")

            # Try Metal Archives first
            ma_cover = buscar_metal_archives(session, band, title)
            if ma_cover:
                ma_found += 1
                print(f"    METAL ARCHIVES: {ma_cover}")
                if not args.dry_run:
                    album.album_artwork_url = ma_cover
                    db_session.add(album)
                time.sleep(DELAY)
                continue

            # Fallback: upgrade YouTube thumbnail to max resolution
            yt_url = youtube_maxres_thumbnail(album.youtube_video_id)
            if yt_url and yt_url != album.album_artwork_url:
                yt_upgraded += 1
                print(f"    YOUTUBE HD: {yt_url}")
                if not args.dry_run:
                    album.album_artwork_url = yt_url
                    db_session.add(album)
            else:
                unchanged += 1
                print(f"    Sin cambio (manteniendo YouTube thumbnail)")

            time.sleep(DELAY)

        if not args.dry_run:
            db_session.commit()

    print("\n" + "=" * 60)
    print(" RESUMEN")
    print("=" * 60)
    print(f"  Albums procesados: {len(albums)}")
    print(f"  Metal Archives: {ma_found}")
    print(f"  YouTube HD upgrade: {yt_upgraded}")
    print(f"  Sin cambio: {unchanged}")
    if args.dry_run:
        print("  (DRY RUN)")
    print("=" * 60)


if __name__ == "__main__":
    main()
