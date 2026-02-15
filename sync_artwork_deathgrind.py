#!/usr/bin/env python3
"""
Sincroniza portadas de albums desde DeathGrind.club API.

Busca cada album de la DB en deathgrind.club y guarda la URL de la portada.

Uso:
    python sync_artwork_deathgrind.py                  # Sincronizar todo
    python sync_artwork_deathgrind.py --dry-run        # Solo mostrar, no actualizar
    python sync_artwork_deathgrind.py --limite 10      # Limitar a 10 albums
    python sync_artwork_deathgrind.py --solo-vacios    # Solo albums sin portada
    python sync_artwork_deathgrind.py --force           # Re-buscar incluso con portada
"""

import argparse
import sys
import time
from pathlib import Path

import requests

# Add project root to path for rxconfig imports
sys.path.insert(0, str(Path(__file__).resolve().parent))

import reflex as rx
from sqlmodel import select, col
from links_bio.models.album import Album

# DeathGrind.club config
BASE_URL = "https://deathgrind.club"
API_URL = f"{BASE_URL}/api"
CDN_URL = "https://cdn.deathgrind.club/s"

# Rate limiting
DELAY_ENTRE_BUSQUEDAS = 1.0  # seconds between API calls
DELAY_BASE_429 = 30


def crear_sesion():
    """Authenticate with deathgrind.club and return session."""
    import os
    email = os.environ.get("DEATHGRIND_EMAIL", "")
    password = os.environ.get("DEATHGRIND_PASSWORD", "")
    if not email or not password:
        raise RuntimeError(
            "Credenciales de DeathGrind no configuradas. "
            "Configura DEATHGRIND_EMAIL y DEATHGRIND_PASSWORD."
        )

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/json",
    })

    session.get(f"{BASE_URL}/auth/sign-in")
    cookies = session.cookies.get_dict()
    csrf = cookies.get("csrfToken", "")

    login_data = {"login": email, "password": password}
    headers = {"x-csrf-token": csrf, "x-uuid": "12345"}
    r = session.post(f"{API_URL}/auth/login", json=login_data, headers=headers)

    if r.status_code not in [200, 202]:
        raise ConnectionError(f"Error de login: {r.status_code}")

    cookies = session.cookies.get_dict()
    csrf = cookies.get("csrfToken", "")
    session.headers.update({"x-csrf-token": csrf, "x-uuid": "12345"})

    return session


def normalize(text):
    """Normalize text for comparison: lowercase, strip, remove extra spaces."""
    if not text:
        return ""
    return " ".join(text.lower().strip().split())


def buscar_artwork(session, band_name, album_title, retries_429=0):
    """
    Search deathgrind.club for album artwork.
    Returns (artwork_url, thumb_url) or (None, None).
    """
    # Search by band name
    try:
        r = session.get(
            f"{API_URL}/posts/search",
            params={"q": band_name},
            timeout=30,
        )
    except requests.RequestException as e:
        print(f"    Error de conexion: {e}")
        return None, None

    if r.status_code == 429:
        retries_429 += 1
        wait = DELAY_BASE_429 * retries_429
        print(f"    Rate limited, esperando {wait}s...")
        time.sleep(wait)
        return buscar_artwork(session, band_name, album_title, retries_429)

    if r.status_code != 200:
        print(f"    Error API: {r.status_code}")
        return None, None

    data = r.json()
    posts = data.get("posts", [])

    if not posts:
        return None, None

    band_norm = normalize(band_name)
    album_norm = normalize(album_title)

    # Try exact match first: band + album
    for post in posts:
        post_bands = [normalize(b.get("name", "")) for b in post.get("bands", [])]
        post_album = normalize(post.get("album", ""))

        if band_norm in post_bands and post_album == album_norm:
            att = post.get("attachments", [])
            if att:
                thumb = att[0].get("thumb", "")
                file_ = att[0].get("file", "")
                artwork = f"{CDN_URL}/{file_}" if file_ else None
                thumb_url = f"{CDN_URL}/{thumb}" if thumb else None
                return artwork, thumb_url

    # Try partial match: band matches and album contains/is contained
    for post in posts:
        post_bands = [normalize(b.get("name", "")) for b in post.get("bands", [])]
        post_album = normalize(post.get("album", ""))

        if band_norm in post_bands:
            if album_norm in post_album or post_album in album_norm:
                att = post.get("attachments", [])
                if att:
                    thumb = att[0].get("thumb", "")
                    file_ = att[0].get("file", "")
                    artwork = f"{CDN_URL}/{file_}" if file_ else None
                    thumb_url = f"{CDN_URL}/{thumb}" if thumb else None
                    return artwork, thumb_url

    # If band name matched any post but no album match, use the first post with matching band
    # This covers cases where album names differ slightly
    for post in posts:
        post_bands = [normalize(b.get("name", "")) for b in post.get("bands", [])]
        post_album = normalize(post.get("album", ""))

        if band_norm in post_bands:
            att = post.get("attachments", [])
            if att:
                # Only use if we're reasonably confident
                # (same band, different album — still worth having SOME cover)
                thumb = att[0].get("thumb", "")
                file_ = att[0].get("file", "")
                artwork = f"{CDN_URL}/{file_}" if file_ else None
                thumb_url = f"{CDN_URL}/{thumb}" if thumb else None
                return artwork, thumb_url

    return None, None


def buscar_artwork_por_discografia(session, band_name, album_title):
    """
    Alternative search: find band by search, then check discography.
    Slower but more thorough.
    """
    try:
        r = session.get(
            f"{API_URL}/bands/search",
            params={"q": band_name},
            timeout=30,
        )
    except requests.RequestException:
        return None, None

    if r.status_code != 200:
        return None, None

    data = r.json()
    bands = data.get("bands", [])
    band_norm = normalize(band_name)

    for band in bands:
        if normalize(band.get("name", "")) == band_norm:
            band_id = band.get("bandId")
            if not band_id:
                continue

            time.sleep(DELAY_ENTRE_BUSQUEDAS)

            try:
                r2 = session.get(
                    f"{API_URL}/bands/{band_id}/discography",
                    timeout=30,
                )
            except requests.RequestException:
                continue

            if r2.status_code != 200:
                continue

            disco = r2.json()
            disco_posts = disco.get("posts", [])
            album_norm = normalize(album_title)

            for post in disco_posts:
                post_album = normalize(post.get("album", ""))
                if post_album == album_norm or album_norm in post_album or post_album in album_norm:
                    att = post.get("attachments", [])
                    if att:
                        thumb = att[0].get("thumb", "")
                        file_ = att[0].get("file", "")
                        artwork = f"{CDN_URL}/{file_}" if file_ else None
                        thumb_url = f"{CDN_URL}/{thumb}" if thumb else None
                        return artwork, thumb_url

    return None, None


def main():
    parser = argparse.ArgumentParser(description="Sync artwork from DeathGrind.club")
    parser.add_argument("--dry-run", action="store_true", help="Solo mostrar, no actualizar DB")
    parser.add_argument("--limite", type=int, default=0, help="Limitar cantidad de albums a procesar")
    parser.add_argument("--solo-vacios", action="store_true", help="Solo albums sin portada")
    parser.add_argument("--force", action="store_true", help="Re-buscar incluso albums con portada")
    parser.add_argument("--discografia", action="store_true", help="Usar busqueda por discografia (mas lento)")
    args = parser.parse_args()

    print("=" * 60)
    print(" SYNC ARTWORK DESDE DEATHGRIND.CLUB")
    print("=" * 60)

    print("\n[1/3] Autenticando con DeathGrind.club...")
    session = crear_sesion()
    print("   Sesion iniciada")

    print("\n[2/3] Cargando albums de la DB...")
    with rx.session() as db_session:
        query = select(Album)

        if args.solo_vacios or not args.force:
            query = query.where(
                (Album.album_artwork_url == "") | (Album.album_artwork_url == None)
            )

        query = query.order_by(col(Album.id))

        if args.limite:
            query = query.limit(args.limite)

        albums = db_session.exec(query).all()
        print(f"   {len(albums)} albums a procesar")

        if not albums:
            print("\n   No hay albums sin portada. Usa --force para re-buscar todos.")
            return

        print(f"\n[3/3] Buscando portadas...")
        found = 0
        not_found = 0
        errors = 0

        for i, album in enumerate(albums, 1):
            band = album.band_name
            title = album.album_title
            print(f"\n  [{i}/{len(albums)}] {band} - {title}")

            artwork_url, thumb_url = buscar_artwork(session, band, title)

            # If first search failed and --discografia flag, try discography
            if not artwork_url and args.discografia:
                time.sleep(DELAY_ENTRE_BUSQUEDAS)
                artwork_url, thumb_url = buscar_artwork_por_discografia(session, band, title)

            if artwork_url:
                found += 1
                print(f"    ENCONTRADO: {artwork_url}")
                if not args.dry_run:
                    album.album_artwork_url = artwork_url
                    db_session.add(album)
            else:
                not_found += 1
                print(f"    No encontrado")

            # Rate limiting
            if i < len(albums):
                time.sleep(DELAY_ENTRE_BUSQUEDAS)

        if not args.dry_run:
            db_session.commit()
            print("\n   Cambios guardados en DB")

    print("\n" + "=" * 60)
    print(" RESUMEN")
    print("=" * 60)
    print(f"  Albums procesados: {len(albums)}")
    print(f"  Portadas encontradas: {found}")
    print(f"  No encontradas: {not_found}")
    print(f"  Errores: {errors}")
    if args.dry_run:
        print("  (DRY RUN - no se guardaron cambios)")
    print("=" * 60)


if __name__ == "__main__":
    main()
