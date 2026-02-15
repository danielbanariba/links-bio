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

# Intervalo por defecto: 12 horas (en segundos)
SYNC_INTERVAL = int(os.environ.get("SYNC_INTERVAL_HOURS", "12")) * 3600

# Delay inicial: esperar 60s despues del arranque para que la app este lista
STARTUP_DELAY = int(os.environ.get("SYNC_STARTUP_DELAY", "60"))

_sync_thread = None
_started = False


def _run_sync_cycle():
    """Ejecuta un ciclo de sync: YouTube -> DB, luego artwork desde DeathGrind."""
    try:
        from links_bio.youtube_auth import authenticate_from_env
        youtube_client = authenticate_from_env()
    except Exception as e:
        logger.error(f"Error de autenticacion: {e}")
        traceback.print_exc()
        return False

    try:
        # Importar aqui para evitar imports circulares
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
        from sync_youtube_to_db import run_sync

        run_sync(
            youtube_client=youtube_client,
            solo_nuevos=True,
            mark_featured=True,
            featured_count=10,
        )
    except Exception as e:
        logger.error(f"Error durante sync YouTube: {e}")
        traceback.print_exc()
        return False

    # Paso 2: reemplazar thumbnails de YouTube con portadas de DeathGrind
    try:
        _run_artwork_sync()
    except Exception as e:
        logger.error(f"Error durante sync artwork: {e}")
        traceback.print_exc()
        # No retornamos False: el sync de YouTube ya se completo

    return True


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
        logger.error(f"Artwork sync: error de login DeathGrind: {e}")
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
                    logger.error(f"Artwork sync error for {album.band_name}: {e}")

                if i < len(albums):
                    time.sleep(1.0)

            db_session.commit()
            total_found += found
            total_processed += len(albums)
            logger.warning(f"Artwork sync batch: {found}/{len(albums)} encontradas (total: {total_found}/{total_processed})")

            if len(albums) < BATCH_SIZE:
                break
            offset += BATCH_SIZE

    logger.warning(f"Artwork sync completado: {total_found}/{total_processed} portadas encontradas.")


def _sync_loop():
    """Loop principal del background sync."""
    logger.warning(f"Esperando {STARTUP_DELAY}s antes del primer sync...")
    time.sleep(STARTUP_DELAY)

    while True:
        try:
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            logger.warning(f"Iniciando sync: {now}")

            success = _run_sync_cycle()

            if success:
                logger.warning("Sync completado exitosamente.")
            else:
                logger.warning("Sync fallo. Se reintentara en el proximo ciclo.")
        except Exception as e:
            logger.error(f"Error no esperado en sync loop: {e}")
            traceback.print_exc()

        hours = SYNC_INTERVAL // 3600
        logger.warning(f"Proximo sync en {hours} horas.")
        time.sleep(SYNC_INTERVAL)


def start_background_sync():
    """Inicia el background sync como daemon thread. Solo se ejecuta una vez."""
    global _sync_thread, _started

    if _started:
        return

    # Solo activar si hay credenciales de YouTube configuradas
    refresh_token = os.environ.get("YOUTUBE_REFRESH_TOKEN")
    if not refresh_token:
        logger.warning("YOUTUBE_REFRESH_TOKEN no configurado. Background sync desactivado.")
        return

    _started = True
    _sync_thread = threading.Thread(target=_sync_loop, daemon=True, name="youtube-sync")
    _sync_thread.start()
    logger.warning("Hilo de sincronizacion iniciado.")
