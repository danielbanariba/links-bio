#!/usr/bin/env python3
"""
Sincroniza videos del canal de YouTube con la database de Metal Archive.

Uso:
    python sync_youtube_to_db.py                  # Sincronizar todo
    python sync_youtube_to_db.py --dry-run        # Solo mostrar, no insertar
    python sync_youtube_to_db.py --limite 10      # Limitar a 10 videos
    python sync_youtube_to_db.py --solo-nuevos    # Solo videos que no estan en DB
    python sync_youtube_to_db.py --update-views   # Solo actualizar view counts
    python sync_youtube_to_db.py --mark-featured  # Marcar top 10 como featured
"""

import argparse
import json
import os
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent
CLICK_AUTO_EDITOR = Path.home() / "Desktop" / "click-auto-editor"
PLAYLIST_CACHE_PATH = CLICK_AUTO_EDITOR / "data" / "playlist_links_cache.json"

# Add project root (for rxconfig + links_bio) and subir_video (for authenticate)
sys.path.insert(0, str(PROJECT_ROOT))

import rxconfig  # noqa: F401
import reflex as rx
from sqlmodel import select, col

from links_bio.models.album import Album
from links_bio.models.track import Track
from links_bio.models.similar_band import SimilarBand
from scripts.normalize_db import normalize_genre, normalize_country

# Autenticacion: preferir env vars, fallback a modulo local
def _get_authenticate_functions():
    """Retorna (authenticate, authenticate_next) segun el entorno."""
    # Si hay env vars de YouTube, usar auth por env vars
    if os.environ.get("YOUTUBE_REFRESH_TOKEN"):
        from links_bio.youtube_auth import authenticate_from_env

        def auth_env(prefix=None):
            return authenticate_from_env()

        def auth_next_env(prefix=None):
            return None  # Sin rotacion en modo env vars

        return auth_env, auth_next_env

    # Fallback: modulo local de click-auto-editor
    try:
        sys.path.insert(0, str(CLICK_AUTO_EDITOR / "subir_video"))
        from authenticate import authenticate, authenticate_next
        return authenticate, authenticate_next
    except ImportError:
        raise RuntimeError(
            "No se encontraron credenciales de YouTube. "
            "Configura YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN "
            "o instala el modulo authenticate de click-auto-editor."
        )


_authenticate, _authenticate_next = _get_authenticate_functions()


# ═══════════════════════════════════════════════════════════════════════
# YOUTUBE API HELPERS
# ═══════════════════════════════════════════════════════════════════════

# Mutable container so helpers can rotate the client
_yt = {"client": None}


def yt_execute(request_fn):
    """
    Execute a YouTube API request with automatic credential rotation.
    request_fn: callable that takes a youtube client and returns a request object.
    """
    max_rotations = 7  # max credential sets
    for _ in range(max_rotations):
        try:
            return request_fn(_yt["client"]).execute()
        except Exception as e:
            if "quotaExceeded" in str(e):
                print("   Cuota agotada, rotando credenciales...")
                new_client = _authenticate_next(prefix="playlists")
                if new_client is None:
                    raise RuntimeError(
                        "Todas las credenciales agotadas. Intenta manana."
                    ) from e
                _yt["client"] = new_client
                continue
            raise
    raise RuntimeError("Todas las credenciales agotadas tras rotacion.")


def get_uploads_playlist_id():
    """Obtener ID de la playlist de uploads del canal."""
    response = yt_execute(
        lambda yt: yt.channels().list(
            part="contentDetails",
            mine=True,
            maxResults=1,
        )
    )
    items = response.get("items", [])
    if not items:
        return None
    return items[0]["contentDetails"]["relatedPlaylists"]["uploads"]


def get_best_thumbnail(thumbnails):
    """Prioriza maxres > standard > high > medium > default de la respuesta de la API."""
    for size in ["maxres", "standard", "high", "medium", "default"]:
        if size in thumbnails:
            return thumbnails[size].get("url")
    return None


def fetch_all_videos(uploads_playlist_id, limit=None):
    """
    Extrae todos los videos del canal con metadata completa.
    Usa yt_execute para rotacion automatica de credenciales.
    """
    videos = []
    page_token = None
    fetched = 0

    while True:
        try:
            resp = yt_execute(
                lambda yt, pt=page_token: yt.playlistItems().list(
                    part="snippet,contentDetails",
                    playlistId=uploads_playlist_id,
                    maxResults=50,
                    pageToken=pt,
                )
            )
        except RuntimeError:
            print("   No hay mas credenciales disponibles.")
            break

        video_ids = []
        for item in resp.get("items", []):
            snippet = item.get("snippet", {})
            resource = snippet.get("resourceId", {})
            video_id = resource.get("videoId")
            if video_id:
                video_ids.append(video_id)

        # Obtener detalles completos (statistics, contentDetails)
        if video_ids:
            try:
                ids_str = ",".join(video_ids)
                videos_resp = yt_execute(
                    lambda yt, ids=ids_str: yt.videos().list(
                        part="snippet,contentDetails,statistics,status",
                        id=ids,
                    )
                )
            except RuntimeError:
                break

            for video in videos_resp.get("items", []):
                status = video.get("status", {}).get("privacyStatus", "public")
                if status not in ("public", "unlisted"):
                    continue
                videos.append({
                    "video_id": video.get("id"),
                    "title": video.get("snippet", {}).get("title"),
                    "description": video.get("snippet", {}).get("description"),
                    "published_at": video.get("snippet", {}).get("publishedAt"),
                    "privacy_status": status,
                    "thumbnail_url": get_best_thumbnail(
                        video.get("snippet", {}).get("thumbnails", {}),
                    ),
                    "view_count": int(
                        video.get("statistics", {}).get("viewCount", 0)
                    ),
                    "duration": video.get("contentDetails", {}).get("duration"),
                })

        fetched += len(video_ids)
        if limit and fetched >= limit:
            break

        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    return videos


# ═══════════════════════════════════════════════════════════════════════
# METADATA PARSING (title + description)
# ═══════════════════════════════════════════════════════════════════════

def clean_text(value):
    """Limpia texto: normaliza unicode, elimina caracteres invisibles."""
    if value is None:
        return None
    text = str(value)
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\ufeff", "")
    text = text.replace("\u200b", "").replace("\u200c", "").replace("\u200d", "")
    text = re.sub(r"\s+", " ", text).strip()
    return text if text else None


def parse_title_metadata(title):
    """
    Parse titulo del video.
    Formato tipico: "🇦🇺💀 Gape - Exploit The Moist (2024) • [Slam] ⟨FULL ALBUM⟩"
    """
    metadata = {
        "country_flag": None,
        "band": None,
        "album": None,
        "year": None,
        "genre": None,
        "tipo": None,
    }

    if not title:
        return metadata

    working = title

    # Extraer bandera (primeros caracteres si son emoji de bandera regional)
    flag_match = re.match(r"^([\U0001F1E6-\U0001F1FF]{2})", working)
    if flag_match:
        metadata["country_flag"] = flag_match.group(1)
        working = working[len(flag_match.group(1)):].strip()

    # Remover emoji inicial (calavera, etc.)
    working = re.sub(r"^[\U0001F300-\U0001F9FF\u2620\u2622\u2694\u26A0]\uFE0F?\s*", "", working)

    # Parse "Banda - Album"
    if " - " in working:
        band, rest = working.split(" - ", 1)
        metadata["band"] = clean_text(band)

        # Parse ano "(2024)"
        year_match = re.search(r"\((\d{4})\)", rest)
        if year_match:
            metadata["year"] = int(year_match.group(1))
            rest = rest[:year_match.start()] + rest[year_match.end():]

        # Parse genero "[Slam]"
        genre_match = re.search(r"\[([^\]]+)\]", rest)
        if genre_match:
            metadata["genre"] = clean_text(genre_match.group(1))
            rest = rest[:genre_match.start()] + rest[genre_match.end():]

        # Parse tipo "⟨FULL ALBUM⟩"
        tipo_match = re.search(r"[⟨<]([^⟩>]+)[⟩>]", rest)
        if tipo_match:
            metadata["tipo"] = clean_text(tipo_match.group(1)).title()
            rest = rest[:tipo_match.start()] + rest[tipo_match.end():]

        # Limpiar album: remover bullet "•" y espacios sobrantes
        album = re.sub(r"\s*[•·]\s*", " ", rest).strip()
        album = clean_text(album) if album else None

        # Extraer release type de parentesis: "(Full Album)", "(Full EP)", etc.
        # Tambien maneja "(Demo)" sin "Full"
        if album:
            rt_match = re.search(
                r"\s*\((?:Full\s+)?(Album|EP|Demo|Single|Split|Live|Compilation|Boxset)\)\s*$",
                album,
                re.IGNORECASE,
            )
            if rt_match:
                # Si no se extrajo tipo del formato ⟨⟩, usar este
                if not metadata["tipo"]:
                    raw_type = rt_match.group(1).strip()
                    metadata["tipo"] = f"Full {raw_type}" if "full" in rt_match.group(0).lower() else raw_type
                album = album[: rt_match.start()].strip()

        metadata["album"] = album

    return metadata


def parse_description_metadata(description):
    """
    Parse descripcion para extraer pais, genero, ano, tracklist, links.
    Busca patrones como:
        🌍 Country: Australia 🇦🇺
        ⚡ Genre: Slamming Brutal Death Metal
        📅 Year: 2024
        [00:08] ► Track Name
        🟢 Spotify: https://...
        📘 Facebook: https://...
    """
    metadata = {
        "country": None,
        "genre": None,
        "year": None,
        "tracklist": [],
        "stream_links": {},
        "social_links": {},
    }

    if not description:
        return metadata

    lines = description.splitlines()

    for line in lines:
        text = line.strip()
        if not text:
            continue
        lower = text.lower()

        # Parse Year
        if re.match(r".*year\s*:", lower) or re.match(r".*a[ñn]o\s*:", lower):
            year_match = re.search(r"(\d{4})", text)
            if year_match:
                metadata["year"] = int(year_match.group(1))

        # Parse Country
        if (
            "country:" in lower
            or "contry:" in lower
            or "pais:" in lower
            or "pa\u00eds:" in lower
        ):
            country = text.split(":", 1)[1].strip()
            # Remover banderas emoji
            country = re.sub(r"[\U0001F1E6-\U0001F1FF]{2}", "", country).strip()
            # Remover emojis restantes
            country = re.sub(r"[\U0001F300-\U0001F9FF]", "", country).strip()
            if country:
                metadata["country"] = clean_text(country)

        # Parse Genre
        if "genre:" in lower or "genero:" in lower or "g\u00e9nero:" in lower:
            genre = text.split(":", 1)[1].strip()
            genre = re.sub(r"[\U0001F300-\U0001F9FF]", "", genre).strip()
            if genre:
                metadata["genre"] = clean_text(genre)

        # Parse tracklist: [00:08] ► Track Name
        tracklist_match = re.match(r"\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*[►▶>]\s*(.+)", text)
        if tracklist_match:
            metadata["tracklist"].append({
                "timestamp": tracklist_match.group(1),
                "name": clean_text(tracklist_match.group(2)),
            })

        # Parse streaming links (emoji + Platform: URL)
        link_match = re.match(
            r"[🟢🔵🔴⚫🟠🟡🟣⬛]\s*([^:]+):\s*(https?://\S+)", text
        )
        if link_match:
            platform = clean_text(link_match.group(1))
            url = link_match.group(2).strip()
            if platform:
                metadata["stream_links"][platform] = url

        # Parse social links
        social_match = re.match(
            r"[📘📸📷🗂️🌐💻🔗]\s*([^:]+):\s*(https?://\S+)", text
        )
        if social_match:
            platform = clean_text(social_match.group(1))
            url = social_match.group(2).strip()
            if platform:
                metadata["social_links"][platform] = url

    return metadata


def parse_duration_to_minutes(duration_str):
    """Parse ISO 8601 duration a minutos. 'PT44M50S' -> 45, 'PT1H30M15S' -> 90."""
    if not duration_str:
        return None
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration_str)
    if not match:
        return None
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    total = hours * 60 + minutes + (1 if seconds >= 30 else 0)
    return total if total > 0 else None


# ═══════════════════════════════════════════════════════════════════════
# PLAYLIST CACHE
# ═══════════════════════════════════════════════════════════════════════

def load_playlist_cache(path=None):
    """Carga el cache de playlists generado por mapear_playlists.py."""
    path = Path(path) if path else PLAYLIST_CACHE_PATH
    if not path.exists():
        print(f"   Cache de playlists no encontrado: {path}")
        return {}

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    cache = {}
    for item in data.get("items", []):
        title_key = item.get("title_key", "").strip()
        url = item.get("url", "")
        if title_key and url:
            cache[title_key] = url
    return cache


# ═══════════════════════════════════════════════════════════════════════
# DATABASE OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def upsert_album(session, video_data, title_meta, desc_meta, stream_links, social_links):
    """
    Inserta o actualiza un album en la base de datos.
    Retorna (album_id, is_new).
    """
    video_id = video_data.get("video_id")
    if not video_id:
        return None, False

    band = title_meta.get("band") or "Desconocido"
    album_title = title_meta.get("album") or video_data.get("title", "Sin titulo")
    year = desc_meta.get("year") or title_meta.get("year") or 0
    country = normalize_country(desc_meta.get("country") or "")
    genre = normalize_genre(desc_meta.get("genre") or title_meta.get("genre") or "")
    release_type = title_meta.get("tipo") or ""
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"

    # Buscar existente por youtube_video_id
    existing = session.exec(
        select(Album).where(Album.youtube_video_id == video_id)
    ).first()

    if existing:
        # UPDATE
        existing.band_name = band
        existing.album_title = album_title
        existing.year = year
        existing.country = country
        existing.genre = genre
        existing.release_type = release_type
        existing.youtube_url = youtube_url
        existing.spotify_url = stream_links.get("Spotify", existing.spotify_url)
        existing.bandcamp_url = stream_links.get("Bandcamp", existing.bandcamp_url)
        existing.apple_music_url = stream_links.get("Apple Music", existing.apple_music_url)
        existing.metal_archives_url = stream_links.get("Metal Archives", existing.metal_archives_url)
        existing.facebook_url = social_links.get("Facebook", existing.facebook_url)
        existing.instagram_url = social_links.get("Instagram", existing.instagram_url)
        existing.album_artwork_url = video_data.get("thumbnail_url") or existing.album_artwork_url
        existing.description = video_data.get("description") or existing.description
        existing.duration_minutes = parse_duration_to_minutes(video_data.get("duration"))
        existing.views = video_data.get("view_count", existing.views)
        if video_data.get("published_at"):
            try:
                existing.upload_date = datetime.fromisoformat(
                    video_data["published_at"].replace("Z", "+00:00")
                )
            except (ValueError, TypeError):
                pass
        session.add(existing)
        return existing.id, False
    else:
        # INSERT
        upload_date = datetime.now()
        if video_data.get("published_at"):
            try:
                upload_date = datetime.fromisoformat(
                    video_data["published_at"].replace("Z", "+00:00")
                )
            except (ValueError, TypeError):
                pass

        album = Album(
            band_name=band,
            album_title=album_title,
            year=year,
            country=country,
            genre=genre,
            release_type=release_type,
            youtube_video_id=video_id,
            youtube_url=youtube_url,
            spotify_url=stream_links.get("Spotify", ""),
            bandcamp_url=stream_links.get("Bandcamp", ""),
            apple_music_url=stream_links.get("Apple Music", ""),
            metal_archives_url=stream_links.get("Metal Archives", ""),
            facebook_url=social_links.get("Facebook", ""),
            instagram_url=social_links.get("Instagram", ""),
            album_artwork_url=video_data.get("thumbnail_url") or "",
            description=video_data.get("description") or "",
            duration_minutes=parse_duration_to_minutes(video_data.get("duration")),
            views=video_data.get("view_count", 0),
            featured=False,
            upload_date=upload_date,
        )
        session.add(album)
        session.flush()
        return album.id, True


def upsert_tracklist(session, album_id, tracklist):
    """Reemplaza el tracklist de un album."""
    from sqlmodel import delete
    # Bulk delete existing tracks
    session.exec(delete(Track).where(Track.album_id == album_id))

    # Insertar nuevos
    for idx, track_data in enumerate(tracklist, start=1):
        track = Track(
            album_id=album_id,
            track_number=idx,
            track_name=track_data.get("name", ""),
            timestamp=track_data.get("timestamp", "0:00"),
        )
        session.add(track)


def mark_featured_albums(session, top_n=10):
    """Marca los top N albums mas vistos como featured."""
    from sqlmodel import update

    # Bulk reset all featured to False
    session.exec(update(Album).values(featured=False))

    # Get top N IDs by views
    top_ids = session.exec(
        select(Album.id).order_by(col(Album.views).desc()).limit(top_n)
    ).all()

    if top_ids:
        # Bulk set featured = True for top N
        session.exec(
            update(Album).where(col(Album.id).in_(top_ids)).values(featured=True)
        )

    session.commit()
    print(f"   {len(top_ids)} albums marcados como featured (top por views)")


def update_view_counts(session):
    """Actualiza view counts de todos los videos en la DB."""
    albums = session.exec(
        select(Album).where(Album.youtube_video_id != "")
    ).all()

    video_ids = [a.youtube_video_id for a in albums if a.youtube_video_id]
    id_to_album = {a.youtube_video_id: a for a in albums}

    updated = 0
    for i in range(0, len(video_ids), 50):
        chunk = video_ids[i : i + 50]
        try:
            ids_str = ",".join(chunk)
            resp = yt_execute(
                lambda yt, ids=ids_str: yt.videos().list(
                    part="statistics",
                    id=ids,
                )
            )
        except RuntimeError:
            print("   Todas las credenciales agotadas.")
            break

        for video in resp.get("items", []):
            vid = video.get("id")
            views = int(video.get("statistics", {}).get("viewCount", 0))
            if vid in id_to_album:
                id_to_album[vid].views = views
                session.add(id_to_album[vid])
                updated += 1

    session.commit()
    print(f"   {updated} albums actualizados con view counts")


# ═══════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════

def run_sync(
    youtube_client=None,
    solo_nuevos=True,
    mark_featured=True,
    featured_count=10,
    limite=None,
):
    """
    Sincroniza videos de YouTube con la DB. Puede ser llamado desde CLI o background task.

    Args:
        youtube_client: Cliente de YouTube autenticado. Si None, se autentica automaticamente.
        solo_nuevos: Solo procesar videos que no esten en la DB.
        mark_featured: Marcar top albums como featured despues de sincronizar.
        featured_count: Cantidad de albums a marcar como featured.
        limite: Cantidad maxima de videos a procesar.
    """
    print("=" * 60)
    print(" SYNC YOUTUBE -> METAL ARCHIVE DATABASE")
    print("=" * 60)
    print()

    # 1. Autenticar con YouTube
    if youtube_client is not None:
        _yt["client"] = youtube_client
    else:
        print("[1/6] Autenticando con YouTube API...")
        _yt["client"] = _authenticate(prefix="playlists")
    print()

    # 2. Obtener playlist de uploads
    print("[2/6] Obteniendo playlist de uploads del canal...")
    uploads_id = get_uploads_playlist_id()
    if not uploads_id:
        print("   ERROR: No se encontro la playlist de uploads.")
        return
    print(f"   Playlist ID: {uploads_id}")
    print()

    # 3. Extraer todos los videos
    limite_str = str(limite) if limite else "sin limite"
    print(f"[3/6] Extrayendo videos del canal (limite: {limite_str})...")
    videos = fetch_all_videos(uploads_id, limit=limite)
    print(f"   {len(videos)} videos extraidos")
    print()

    # 4. Cargar cache de playlists
    print("[4/6] Cargando cache de playlists...")
    playlist_cache = load_playlist_cache()
    print(f"   {len(playlist_cache)} playlists en cache")
    print()

    # 5. Procesar cada video
    print(f"[5/6] Procesando {len(videos)} videos...")
    print()

    inserted = 0
    updated = 0
    skipped = 0
    errors = 0

    session = rx.session().__enter__()

    BATCH_SIZE = 50

    try:
        for idx, video in enumerate(videos, start=1):
            video_id = video.get("video_id")
            title = video.get("title", "")

            # Parse metadata
            title_meta = parse_title_metadata(title)
            desc_meta = parse_description_metadata(video.get("description", ""))

            # Check si ya existe (para solo_nuevos)
            if solo_nuevos:
                existing = session.exec(
                    select(Album).where(Album.youtube_video_id == video_id)
                ).first()
                if existing:
                    skipped += 1
                    continue

            try:
                # Preparar links
                stream_links = desc_meta.get("stream_links", {})
                social_links = desc_meta.get("social_links", {})

                album_id, is_new = upsert_album(
                    session, video, title_meta, desc_meta, stream_links, social_links
                )

                if album_id and desc_meta.get("tracklist"):
                    upsert_tracklist(session, album_id, desc_meta["tracklist"])

                if is_new:
                    inserted += 1
                    print(f"  [{idx}/{len(videos)}] + NUEVO: {title[:70]}")
                else:
                    updated += 1
                    if idx % 50 == 0:
                        print(f"  [{idx}/{len(videos)}] ~ actualizado: {title[:70]}")

            except Exception as e:
                errors += 1
                print(f"  [{idx}/{len(videos)}] ERROR: {title[:50]}")
                print(f"    {e}")

            # Batch commit every BATCH_SIZE albums
            if idx % BATCH_SIZE == 0:
                session.commit()

        session.commit()

        # 6. Marcar featured
        if mark_featured:
            print()
            print("[6/6] Marcando albums featured...")
            mark_featured_albums(session, featured_count)

    finally:
        session.__exit__(None, None, None)

    # Resumen
    print()
    print("=" * 60)
    print(" RESUMEN")
    print("=" * 60)
    print(f"  Videos procesados: {len(videos)}")
    print(f"  Insertados: {inserted}")
    print(f"  Actualizados: {updated}")
    print(f"  Omitidos: {skipped}")
    print(f"  Errores: {errors}")
    print("=" * 60)
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Sincroniza videos de YouTube con la database de Metal Archive"
    )
    parser.add_argument(
        "--limite", type=int, help="Cantidad maxima de videos a procesar"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Solo muestra lo que haria sin insertar en DB"
    )
    parser.add_argument(
        "--solo-nuevos", action="store_true",
        help="Solo procesa videos que no esten en la DB"
    )
    parser.add_argument(
        "--update-views", action="store_true",
        help="Solo actualizar view counts (no sincronizar videos nuevos)"
    )
    parser.add_argument(
        "--mark-featured", action="store_true",
        help="Marcar top 10 albums como featured despues de sincronizar"
    )
    parser.add_argument(
        "--featured-count", type=int, default=10,
        help="Cantidad de albums a marcar como featured (default: 10)"
    )
    args = parser.parse_args()

    # Modo: solo actualizar views
    if args.update_views:
        print("[*] Autenticando...")
        _yt["client"] = _authenticate(prefix="playlists")
        print("[*] Actualizando view counts...")
        with rx.session() as session:
            update_view_counts(session)
            if args.mark_featured:
                mark_featured_albums(session, args.featured_count)
        print("\nListo!")
        return

    # Modo: dry-run (sin DB)
    if args.dry_run:
        _yt["client"] = _authenticate(prefix="playlists")
        uploads_id = get_uploads_playlist_id()
        if not uploads_id:
            print("ERROR: No se encontro la playlist de uploads.")
            return
        videos = fetch_all_videos(uploads_id, limit=args.limite)
        for idx, video in enumerate(videos, start=1):
            title = video.get("title", "")
            title_meta = parse_title_metadata(title)
            desc_meta = parse_description_metadata(video.get("description", ""))
            genre = desc_meta.get("genre") or title_meta.get("genre") or ""
            country = desc_meta.get("country") or ""
            year = desc_meta.get("year") or title_meta.get("year") or 0
            release_type = title_meta.get("tipo") or ""
            print(f"  [{idx}/{len(videos)}] {title}")
            print(f"    Banda: {title_meta.get('band')}")
            print(f"    Album: {title_meta.get('album')}")
            print(f"    Tipo: {release_type or '(sin tipo)'}")
            print(f"    Genero: {genre}")
            print(f"    Pais: {country}")
            print(f"    Ano: {year}")
            print(f"    Tracks: {len(desc_meta.get('tracklist', []))}")
            print(f"    Views: {video.get('view_count', 0)}")
            print()
        return

    # Modo normal
    run_sync(
        solo_nuevos=args.solo_nuevos,
        mark_featured=args.mark_featured,
        featured_count=args.featured_count,
        limite=args.limite,
    )


if __name__ == "__main__":
    main()
