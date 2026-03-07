"""
Background sync: sincroniza YouTube -> DB cada N horas dentro de la app Reflex.

Solo se activa si YOUTUBE_REFRESH_TOKEN esta configurado (Reflex Cloud).
"""

import logging
import os
import threading
import time
import traceback
from datetime import datetime

logger = logging.getLogger("background_sync")
logger.setLevel(logging.INFO)

# Estado de diagnostico accesible desde el state
_diag_status: str = "No iniciado"


def get_diag_status() -> str:
    return _diag_status


def _log(msg: str):
    """Log + print para asegurar visibilidad en Reflex Cloud."""
    global _diag_status
    _diag_status = msg
    logger.warning(msg)
    print(f"[SYNC] {msg}", flush=True)

# Intervalo por defecto: 12 horas (en segundos)
SYNC_INTERVAL = int(os.environ.get("SYNC_INTERVAL_HOURS", "12")) * 3600

# Delay inicial: esperar 60s despues del arranque para que la app este lista
STARTUP_DELAY = int(os.environ.get("SYNC_STARTUP_DELAY", "60"))

_sync_thread = None
_started = False
_sync_count = 0


def _run_sync_cycle():
    """Ejecuta un ciclo de sync: YouTube -> DB, luego artwork desde DeathGrind."""
    try:
        from links_bio.youtube_auth import authenticate_from_env
        youtube_client = authenticate_from_env()
    except Exception as e:
        _log(f"Error de autenticacion: {e}")
        traceback.print_exc()
        return False

    try:
        # Importar aqui para evitar imports circulares
        import reflex as rx
        import sys
        from pathlib import Path
        from sqlmodel import select, func
        from links_bio.models.album import Album
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
        from sync_youtube_to_db import run_sync

        # Si la DB tiene pocos albums, hacer sync completo para llenar huecos
        with rx.session() as session:
            album_count = session.exec(select(func.count(Album.id))).one()

        global _sync_count
        _sync_count += 1

        # Sync completo si: DB casi vacia, o cada 4to ciclo (para llenar huecos)
        solo_nuevos = album_count >= 100 and (_sync_count % 4 != 0)
        if not solo_nuevos:
            _log(f"DB tiene {album_count} albums. Ejecutando sync completo (ciclo #{_sync_count}).")
        else:
            _log(f"DB tiene {album_count} albums. Ejecutando sync incremental (ciclo #{_sync_count}).")

        run_sync(
            youtube_client=youtube_client,
            solo_nuevos=solo_nuevos,
            mark_featured=True,
            featured_count=10,
        )
    except Exception as e:
        _log(f"Error durante sync YouTube: {e}")
        traceback.print_exc()
        return False

    # Paso 2: normalizar generos y paises
    try:
        _run_normalize()
    except Exception as e:
        _log(f"Error durante normalizacion: {e}")
        traceback.print_exc()

    # Paso 3: reemplazar thumbnails de YouTube con portadas de DeathGrind
    try:
        _run_artwork_sync()
    except Exception as e:
        _log(f"Error durante sync artwork: {e}")
        traceback.print_exc()

    return True


def _run_normalize():
    """Normaliza generos y paises en la DB."""
    import reflex as rx
    from sqlmodel import select
    from links_bio.models.album import Album
    from scripts.normalize_db import normalize_genre, normalize_country

    changes = 0
    with rx.session() as session:
        albums = session.exec(select(Album)).all()
        for album in albums:
            new_genre = normalize_genre(album.genre)
            new_country = normalize_country(album.country)
            changed = False
            if new_genre != album.genre:
                album.genre = new_genre
                changed = True
            if new_country != album.country:
                album.country = new_country
                changed = True
            if changed:
                session.add(album)
                changes += 1
        if changes:
            session.commit()
    _log(f"Normalizacion: {changes} albums actualizados.")


def _run_artwork_sync():
    """Busca portadas en DeathGrind.club para albums que aun tienen thumbnail de YouTube."""
    import reflex as rx
    from sqlmodel import select, col, func
    from links_bio.models.album import Album
    from sync_artwork_deathgrind import crear_sesion, buscar_artwork

    BATCH_SIZE = 50

    try:
        http_session = crear_sesion()
    except Exception as e:
        _log(f"Artwork sync: error de login DeathGrind: {e}")
        return

    offset = 0
    total_found = 0
    total_processed = 0

    while True:
        with rx.session() as db_session:
            albums = db_session.exec(
                select(Album).where(
                    (Album.album_artwork_url.like("%ytimg.com%"))
                    | (Album.album_artwork_url.like("%youtube.com%"))
                    | (Album.album_artwork_url == "")
                    | (Album.album_artwork_url == None)
                ).order_by(col(Album.id))
                .offset(offset)
                .limit(BATCH_SIZE)
            ).all()

            if not albums:
                break

            found = 0
            for i, album in enumerate(albums, 1):
                try:
                    artwork_url, _ = buscar_artwork(http_session, album.band_name, album.album_title)
                    if artwork_url:
                        album.album_artwork_url = artwork_url
                        db_session.add(album)
                        found += 1
                except Exception as e:
                    _log(f"Artwork sync error for {album.band_name}: {e}")

                if i < len(albums):
                    time.sleep(1.0)

            db_session.commit()
            total_found += found
            total_processed += len(albums)
            _log(f"Artwork sync batch: {found}/{len(albums)} encontradas (total: {total_found}/{total_processed})")

            if len(albums) < BATCH_SIZE:
                break
            offset += BATCH_SIZE

    _log(f"Artwork sync completado: {total_found}/{total_processed} portadas encontradas.")


def _is_db_empty() -> bool:
    """Verifica si la DB tiene albums."""
    try:
        import reflex as rx
        from sqlmodel import select, func
        from links_bio.models.album import Album
        with rx.session() as session:
            count = session.exec(select(func.count(Album.id))).one()
            return count == 0
    except Exception:
        return True


def _sync_loop():
    """Loop principal del background sync."""
    if _is_db_empty():
        _log("DB vacia, iniciando sync inmediatamente...")
    else:
        _log(f"Esperando {STARTUP_DELAY}s antes del primer sync...")
        time.sleep(STARTUP_DELAY)

    while True:
        try:
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            _log(f"Iniciando sync: {now}")

            success = _run_sync_cycle()

            if success:
                _log("Sync completado exitosamente.")
            else:
                _log("Sync fallo. Se reintentara en el proximo ciclo.")
        except Exception as e:
            _log(f"Error no esperado en sync loop: {e}")
            traceback.print_exc()

        hours = SYNC_INTERVAL // 3600
        _log(f"Proximo sync en {hours} horas.")
        time.sleep(SYNC_INTERVAL)


def start_background_sync():
    """Inicia el background sync como daemon thread. Solo se ejecuta una vez."""
    global _sync_thread, _started

    if _started:
        return

    # Verificar credenciales de YouTube
    refresh_token = os.environ.get("YOUTUBE_REFRESH_TOKEN")
    if not refresh_token:
        _log("YOUTUBE_REFRESH_TOKEN no configurado. Background sync desactivado.")
        # Log all env var keys for debugging (no values for security)
        env_keys = sorted([k for k in os.environ.keys() if "YOUTUBE" in k.upper() or "GMAIL" in k.upper()])
        _log(f"Env vars relevantes encontradas: {env_keys if env_keys else 'ninguna'}")
        return

    _started = True
    _sync_thread = threading.Thread(target=_sync_loop, daemon=True, name="youtube-sync")
    _sync_thread.start()
    _log("Hilo de sincronizacion iniciado.")
