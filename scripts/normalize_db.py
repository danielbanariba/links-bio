#!/usr/bin/env python3
"""
Limpieza one-time de la base de datos de Metal Archive.

Normaliza generos (strip prefijos, fix typos, separadores) y paises (bilingue -> espanol).

Uso:
    python scripts/normalize_db.py --dry-run        # Ver cambios sin aplicar
    python scripts/normalize_db.py --backup         # Backup + aplicar cambios
    python scripts/normalize_db.py                  # Aplicar cambios directamente
"""

import argparse
import re
import shutil
import sys
from collections import Counter
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import rxconfig  # noqa: F401
import reflex as rx
from sqlmodel import select

from links_bio.models.album import Album


# ═══════════════════════════════════════════════════════════════════════
# GENRE NORMALIZATION
# ═══════════════════════════════════════════════════════════════════════

GENRE_TYPO_MAP = {
    "grincore": "Grindcore",
    "grindore": "Grindcore",
    "grindcroe": "Grindcore",
    "death meta": "Death Metal",
    "deathmetal": "Death Metal",
    "death metall": "Death Metal",
    "black metall": "Black Metal",
    "blackmetal": "Black Metal",
    "tecnical": "Technical",
    "techincal": "Technical",
    "techinal": "Technical",
    "melodico": "Melodic",
    "progresive": "Progressive",
    "progresssive": "Progressive",
    "simphonic": "Symphonic",
    "symphoinc": "Symphonic",
    "brutall": "Brutal",
    "thras metal": "Thrash Metal",
    "thrash metall": "Thrash Metal",
    "doom metall": "Doom Metal",
    "slamming": "Slam",
    "goregrind": "Goregrind",
    "deathgrind": "Deathgrind",
    "crossover thrash": "Crossover Thrash",
}

GENRE_UNKNOWN = {"unknown", "gnero desconocido", "genero desconocido", "desconocido", "n/a", "none", ""}


def normalize_genre(genre: str) -> str:
    """Normaliza un string de genero."""
    if not genre:
        return ""

    text = genre.strip()

    # Strip prefijos numericos: (9)Metal -> Metal, (22)Death Metal -> Death Metal
    text = re.sub(r"^\(\d+\)\s*", "", text)

    # Normalizar separadores a /
    text = re.sub(r"\s*/\s*", "/", text)  # " / " -> "/"
    text = re.sub(r"\s*,\s*", "/", text)  # ", " -> "/"
    text = re.sub(r"\s*\|\s*", "/", text)  # " | " -> "/"
    text = re.sub(r"\s*;\s*", "/", text)  # "; " -> "/"

    # Procesar cada sub-genero separado por /
    parts = [p.strip() for p in text.split("/") if p.strip()]
    normalized_parts = []

    for part in parts:
        lower = part.lower().strip()

        # Check unknown
        if lower in GENRE_UNKNOWN:
            continue

        # Fix typos (check full part and individual words)
        if lower in GENRE_TYPO_MAP:
            part = GENRE_TYPO_MAP[lower]
        else:
            # Try word-level typo fixes
            words = part.split()
            fixed_words = []
            for word in words:
                wl = word.lower()
                if wl in GENRE_TYPO_MAP:
                    fixed_words.append(GENRE_TYPO_MAP[wl])
                else:
                    fixed_words.append(word)
            part = " ".join(fixed_words)

        # Title case each word (preserving existing caps for acronyms)
        if part.islower() or part.isupper():
            part = part.title()

        normalized_parts.append(part)

    if not normalized_parts:
        return ""

    return "/".join(normalized_parts)


def merge_reverse_genres(albums: list) -> dict:
    """
    Detecta generos reversos (A/B vs B/A) y genera un mapping al mas frecuente.
    Retorna dict: genero_menos_frecuente -> genero_mas_frecuente
    """
    genre_freq = Counter()
    for album in albums:
        g = album.genre.strip()
        if g:
            genre_freq[g] += 1

    merge_map = {}
    seen = set()

    for genre in genre_freq:
        if genre in seen:
            continue
        if "/" not in genre:
            seen.add(genre)
            continue

        parts = [p.strip() for p in genre.split("/")]
        reversed_genre = "/".join(reversed(parts))

        if reversed_genre != genre and reversed_genre in genre_freq:
            # Conservar el mas frecuente
            if genre_freq[genre] >= genre_freq[reversed_genre]:
                merge_map[reversed_genre] = genre
                seen.add(genre)
                seen.add(reversed_genre)
            else:
                merge_map[genre] = reversed_genre
                seen.add(genre)
                seen.add(reversed_genre)
        else:
            seen.add(genre)

    return merge_map


# ═══════════════════════════════════════════════════════════════════════
# COUNTRY NORMALIZATION
# ═══════════════════════════════════════════════════════════════════════

COUNTRY_TO_SPANISH = {
    # English -> Spanish
    "united states": "Estados Unidos",
    "usa": "Estados Unidos",
    "us": "Estados Unidos",
    "germany": "Alemania",
    "france": "Francia",
    "italy": "Italia",
    "spain": "Espana",
    "sweden": "Suecia",
    "norway": "Noruega",
    "finland": "Finlandia",
    "denmark": "Dinamarca",
    "netherlands": "Paises Bajos",
    "holland": "Paises Bajos",
    "belgium": "Belgica",
    "austria": "Austria",
    "switzerland": "Suiza",
    "poland": "Polonia",
    "czech republic": "Republica Checa",
    "czechia": "Republica Checa",
    "slovakia": "Eslovaquia",
    "hungary": "Hungria",
    "romania": "Rumania",
    "bulgaria": "Bulgaria",
    "greece": "Grecia",
    "turkey": "Turquia",
    "türkiye": "Turquia",
    "tukiye": "Turquia",
    "lebanon": "Libano",
    "russia": "Rusia",
    "russian": "Rusia",
    "ukraine": "Ucrania",
    "united kingdom": "Reino Unido",
    "uk": "Reino Unido",
    "england": "Reino Unido",
    "scotland": "Reino Unido",
    "wales": "Reino Unido",
    "ireland": "Irlanda",
    "portugal": "Portugal",
    "brazil": "Brasil",
    "argentina": "Argentina",
    "chile": "Chile",
    "colombia": "Colombia",
    "peru": "Peru",
    "venezuela": "Venezuela",
    "ecuador": "Ecuador",
    "uruguay": "Uruguay",
    "paraguay": "Paraguay",
    "bolivia": "Bolivia",
    "mexico": "Mexico",
    "costa rica": "Costa Rica",
    "guatemala": "Guatemala",
    "honduras": "Honduras",
    "el salvador": "El Salvador",
    "panama": "Panama",
    "nicaragua": "Nicaragua",
    "cuba": "Cuba",
    "puerto rico": "Puerto Rico",
    "canada": "Canada",
    "japan": "Japon",
    "china": "China",
    "south korea": "Corea del Sur",
    "india": "India",
    "indonesia": "Indonesia",
    "thailand": "Tailandia",
    "vietnam": "Vietnam",
    "philippines": "Filipinas",
    "malaysia": "Malasia",
    "singapore": "Singapur",
    "australia": "Australia",
    "new zealand": "Nueva Zelanda",
    "south africa": "Sudafrica",
    "egypt": "Egipto",
    "israel": "Israel",
    "iran": "Iran",
    "iraq": "Irak",
    "saudi arabia": "Arabia Saudita",
    "croatia": "Croacia",
    "serbia": "Serbia",
    "slovenia": "Eslovenia",
    "bosnia": "Bosnia",
    "latvia": "Letonia",
    "lithuania": "Lituania",
    "estonia": "Estonia",
    "iceland": "Islandia",
    "luxembourg": "Luxemburgo",
    "taiwan": "Taiwan",
    "nepal": "Nepal",
    "bangladesh": "Bangladesh",
    "pakistan": "Pakistan",
    "morocco": "Marruecos",
    "tunisia": "Tunez",
    "algeria": "Argelia",
    "nigeria": "Nigeria",
    "kenya": "Kenia",
    "dominican republic": "Republica Dominicana",
    "jamaica": "Jamaica",
    "trinidad and tobago": "Trinidad y Tobago",
    "belarus": "Bielorrusia",
    "georgia": "Georgia",
    "armenia": "Armenia",
    "azerbaijan": "Azerbaiyan",
    "kazakhstan": "Kazajistan",
    "uzbekistan": "Uzbekistan",
    "mongolia": "Mongolia",
    "myanmar": "Myanmar",
    "sri lanka": "Sri Lanka",
    # Variantes con typos
    "mexic": "Mexico",
    "rusia": "Rusia",
    "alemania": "Alemania",
    "estados unidos": "Estados Unidos",
    "reino unido": "Reino Unido",
    "francia": "Francia",
    "italia": "Italia",
    "suecia": "Suecia",
    "noruega": "Noruega",
    "finlandia": "Finlandia",
    "dinamarca": "Dinamarca",
    "paises bajos": "Paises Bajos",
    "belgica": "Belgica",
    "suiza": "Suiza",
    "polonia": "Polonia",
    "republica checa": "Republica Checa",
    "hungria": "Hungria",
    "rumania": "Rumania",
    "grecia": "Grecia",
    "turquia": "Turquia",
    "ucrania": "Ucrania",
    "irlanda": "Irlanda",
    "brasil": "Brasil",
    "japon": "Japon",
    "corea del sur": "Corea del Sur",
    "tailandia": "Tailandia",
    "filipinas": "Filipinas",
    "malasia": "Malasia",
    "singapur": "Singapur",
    "nueva zelanda": "Nueva Zelanda",
    "sudafrica": "Sudafrica",
    "egipto": "Egipto",
    "croacia": "Croacia",
    "eslovenia": "Eslovenia",
    "letonia": "Letonia",
    "lituania": "Lituania",
    "islandia": "Islandia",
    "luxemburgo": "Luxemburgo",
    "marruecos": "Marruecos",
    "argelia": "Argelia",
    "kenia": "Kenia",
    "republica dominicana": "Republica Dominicana",
    "bielorrusia": "Bielorrusia",
}

COUNTRY_UNKNOWN = {"unknown", "desconocido", "pais desconocido", "n/a", "none", ""}


def normalize_country(country: str) -> str:
    """Normaliza un string de pais a espanol."""
    if not country:
        return ""

    text = country.strip()

    # Handle bilingual formats: "English / Spanish" or "Spanish/English"
    # Try both parts and pick the Spanish version
    if "/" in text:
        parts = [p.strip() for p in text.split("/")]
        for part in parts:
            lower = part.lower()
            if lower in COUNTRY_UNKNOWN:
                continue
            if lower in COUNTRY_TO_SPANISH:
                return COUNTRY_TO_SPANISH[lower]
            # Check if it's already a known Spanish name (value in our map)
            for v in COUNTRY_TO_SPANISH.values():
                if v.lower() == lower:
                    return v
        # If none matched, try the first non-empty part
        for part in parts:
            if part.strip():
                return _lookup_country(part.strip())
        return ""

    return _lookup_country(text)


def _lookup_country(text: str) -> str:
    """Busca un pais en el mapping."""
    lower = text.lower().strip()

    if lower in COUNTRY_UNKNOWN:
        return ""

    if lower in COUNTRY_TO_SPANISH:
        return COUNTRY_TO_SPANISH[lower]

    # Check if already a known Spanish name
    for v in COUNTRY_TO_SPANISH.values():
        if v.lower() == lower:
            return v

    # Return as-is with title case
    return text.strip()


# ═══════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Normaliza generos y paises en la DB de Metal Archive"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Solo muestra cambios sin aplicar"
    )
    parser.add_argument(
        "--backup", action="store_true",
        help="Crear backup de la DB antes de aplicar cambios"
    )
    args = parser.parse_args()

    print("=" * 60)
    print(" NORMALIZE METAL ARCHIVE DATABASE")
    print("=" * 60)
    print()

    # Backup
    if args.backup and not args.dry_run:
        db_path = PROJECT_ROOT / "reflex.db"
        if db_path.exists():
            backup_path = PROJECT_ROOT / "reflex.db.backup"
            shutil.copy2(db_path, backup_path)
            print(f"Backup creado: {backup_path}")
            print()
        else:
            print(f"DB no encontrada en {db_path}, saltando backup")
            print()

    with rx.session() as session:
        albums = session.exec(select(Album)).all()
        print(f"Total albums en DB: {len(albums)}")
        print()

        # ─── Phase 1: Normalize genres ────────────────────────────────
        print("[1/3] Normalizando generos...")
        genre_changes = 0
        for album in albums:
            new_genre = normalize_genre(album.genre)
            if new_genre != album.genre:
                if args.dry_run:
                    print(f"  GENERO: '{album.genre}' -> '{new_genre}'  [{album.band_name}]")
                album.genre = new_genre
                genre_changes += 1

        # ─── Phase 2: Merge reverse genres ────────────────────────────
        print()
        print("[2/3] Merging generos reversos...")
        merge_map = merge_reverse_genres(albums)
        merge_changes = 0
        if merge_map:
            for album in albums:
                if album.genre in merge_map:
                    new_genre = merge_map[album.genre]
                    if args.dry_run:
                        print(f"  MERGE: '{album.genre}' -> '{new_genre}'  [{album.band_name}]")
                    album.genre = new_genre
                    merge_changes += 1

        # ─── Phase 3: Normalize countries ─────────────────────────────
        print()
        print("[3/3] Normalizando paises...")
        country_changes = 0
        for album in albums:
            new_country = normalize_country(album.country)
            if new_country != album.country:
                if args.dry_run:
                    print(f"  PAIS: '{album.country}' -> '{new_country}'  [{album.band_name}]")
                album.country = new_country
                country_changes += 1

        # ─── Summary ──────────────────────────────────────────────────
        print()
        print("=" * 60)
        print(" RESUMEN")
        print("=" * 60)
        print(f"  Generos normalizados: {genre_changes}")
        print(f"  Generos mergeados (reversos): {merge_changes}")
        print(f"  Paises normalizados: {country_changes}")
        total = genre_changes + merge_changes + country_changes
        print(f"  Total cambios: {total}")

        # Count unique values after normalization
        genres_after = set(a.genre for a in albums if a.genre)
        countries_after = set(a.country for a in albums if a.country)
        print(f"  Generos unicos despues: {len(genres_after)}")
        print(f"  Paises unicos despues: {len(countries_after)}")
        print("=" * 60)

        if args.dry_run:
            print()
            print("(Dry run - no se aplicaron cambios)")
        else:
            for album in albums:
                session.add(album)
            session.commit()
            print()
            print("Cambios aplicados exitosamente!")


if __name__ == "__main__":
    main()
