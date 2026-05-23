#!/usr/bin/env python3
"""
Repara portadas mal asignadas en reflex.db.

Síntoma: álbumes que comparten su album_artwork_url con OTRO álbum de título
distinto de la misma banda. Lo causaba el viejo fallback "usar el primer post de
la banda" en sync_artwork_deathgrind.buscar_artwork (ya eliminado): cuando un
release no tenía match exacto de título, heredaba la portada de otro release de
la banda. Ej.: las 3 obras de Scrotoplasty mostraban la portada de "Repulsive
Transformation".

Estrategia (por álbum afectado, nunca cruzada):
  1. Re-consultar deathgrind.club con la lógica ya corregida (solo match
     exacto/parcial de título). Si hay portada real → se asigna.
  2. Si deathgrind no la tiene → thumbnail de YouTube en máxima resolución de
     ESE video (específico del álbum). Cada álbum queda con SU imagen.

Uso:
    python scripts/fix_artwork_mismatch.py --dry-run   # mostrar, no tocar la DB
    python scripts/fix_artwork_mismatch.py             # aplicar
"""

import argparse
import sys
import time
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / ".env")  # DEATHGRIND_EMAIL / _PASSWORD para crear_sesion

import reflex as rx
from sqlmodel import select

from links_bio.models.album import Album
from sync_artwork_deathgrind import (
    DELAY_ENTRE_BUSQUEDAS,
    buscar_artwork,
    crear_sesion,
    normalize,
)
from sync_artwork_fallback import youtube_maxres_thumbnail


def find_affected(db_session):
    """Álbumes cuya portada deathgrind está compartida con otro álbum de TÍTULO
    distinto. Devuelve la lista ordenada por banda/título."""
    albums = db_session.exec(
        select(Album).where(Album.album_artwork_url.like("%cdn.deathgrind.club%"))
    ).all()

    by_url = defaultdict(list)
    for a in albums:
        by_url[a.album_artwork_url].append(a)

    affected = []
    for group in by_url.values():
        titles = {normalize(a.album_title) for a in group}
        if len(group) > 1 and len(titles) > 1:
            affected.extend(group)

    affected.sort(key=lambda a: (a.band_name or "", a.album_title or ""))
    return affected


def main():
    parser = argparse.ArgumentParser(description="Reparar portadas mal asignadas")
    parser.add_argument("--dry-run", action="store_true", help="Mostrar, no tocar la DB")
    args = parser.parse_args()

    print("=" * 70)
    print(" FIX ARTWORK MISMATCH (portadas heredadas del viejo fallback)")
    print("=" * 70)

    print("\n[1/3] Autenticando con DeathGrind.club...")
    session = crear_sesion()
    print("   Sesion iniciada")

    with rx.session() as db_session:
        print("\n[2/3] Detectando álbumes afectados...")
        affected = find_affected(db_session)
        print(f"   {len(affected)} álbumes con portada compartida (título distinto)")

        if not affected:
            print("\n   Nada que reparar.")
            return

        print("\n[3/3] Re-buscando portada correcta por álbum...\n")
        from_deathgrind = 0
        from_youtube = 0
        unchanged = 0
        total = len(affected)
        titles_by_url = defaultdict(set)  # url final -> títulos (detecta duplicados)

        for i, album in enumerate(affected, 1):
            band = album.band_name
            title = album.album_title
            print(f"  [{i}/{total}] {band} — {title}")

            artwork_url, _ = buscar_artwork(session, band, title)
            if artwork_url:
                nuevo, fuente = artwork_url, "deathgrind"
            else:
                nuevo, fuente = youtube_maxres_thumbnail(album.youtube_video_id), "youtube"

            titles_by_url[nuevo].add(normalize(title))

            if nuevo == album.album_artwork_url:
                unchanged += 1
                print(f"      sin cambio ({fuente})")
            else:
                if fuente == "deathgrind":
                    from_deathgrind += 1
                else:
                    from_youtube += 1
                print(f"      {fuente.upper()}: {nuevo}")
                if not args.dry_run:
                    album.album_artwork_url = nuevo
                    db_session.add(album)

            time.sleep(DELAY_ENTRE_BUSQUEDAS)

        if not args.dry_run:
            db_session.commit()
            print("\n   Cambios guardados en la DB")

    # Verificación: ¿quedó alguna portada compartida entre títulos distintos?
    # titles_by_url se llenó dentro de la sesión con valores primitivos, así que
    # es seguro leerlo aquí sin tocar objetos ORM ya detached.
    residual = {u: t for u, t in titles_by_url.items() if len(t) > 1}

    print("\n" + "=" * 70)
    print(" RESUMEN")
    print("=" * 70)
    print(f"  Álbumes afectados:        {total}")
    print(f"  Portada real (deathgrind): {from_deathgrind}")
    print(f"  Thumbnail YouTube HD:      {from_youtube}")
    print(f"  Sin cambio (ya correctos): {unchanged}")
    if residual:
        print(f"\n  ⚠  ATENCIÓN: {len(residual)} URL siguen compartidas entre títulos distintos:")
        for url, titles in residual.items():
            print(f"     {url}  ←  {', '.join(sorted(titles))}")
    else:
        print("\n  ✓ Ninguna portada queda compartida entre álbumes de título distinto.")
    if args.dry_run:
        print("\n  (DRY RUN — no se guardó nada)")
    print("=" * 70)


if __name__ == "__main__":
    main()
