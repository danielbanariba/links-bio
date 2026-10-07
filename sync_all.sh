#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# sync_all.sh — Orquestador de sincronizacion completa
#
# Ejecuta en orden:
#   1. sync_youtube_to_db.py  (videos -> DB + mark featured; tambien fija
#      album_artwork_url al thumbnail de YouTube, la fuente de portadas)
#   2. normalize_db.py (normalizar generos y paises)
#
# Los pasos de portadas externas fueron eliminados. cdn.deathgrind.club
# envia Cross-Origin-Resource-Policy: same-site, asi que el navegador
# bloquea esas portadas. Ademas, cada sync completo vuelve a fijar el
# thumbnail de YouTube, asi que cualquier portada externa
# (deathgrind.club, Metal Archives) se pierde en el siguiente sync.
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV="$SCRIPT_DIR/env/bin/activate"
PYTHON="$SCRIPT_DIR/env/bin/python"
LOG_PREFIX="[sync_all]"

# Verificar que el venv existe
if [ ! -f "$VENV" ]; then
    echo "$LOG_PREFIX ERROR: No se encontro el virtualenv en $VENV"
    exit 1
fi

cd "$SCRIPT_DIR"

echo "$LOG_PREFIX ════════════════════════════════════════════"
echo "$LOG_PREFIX Inicio: $(date '+%Y-%m-%d %H:%M:%S')"
echo "$LOG_PREFIX ════════════════════════════════════════════"

# ─── Paso 1: Sincronizar videos de YouTube a la DB ───────────────────
echo ""
echo "$LOG_PREFIX [1/2] Sincronizando videos de YouTube..."
if $PYTHON sync_youtube_to_db.py --solo-nuevos --mark-featured; then
    echo "$LOG_PREFIX [1/2] OK"
else
    echo "$LOG_PREFIX [1/2] FALLO (exit code: $?). Continuando..."
fi

# ─── Paso 2: Normalizar generos y paises ─────────────────────────────
echo ""
echo "$LOG_PREFIX [2/2] Normalizando datos..."
if $PYTHON scripts/normalize_db.py; then
    echo "$LOG_PREFIX [2/2] OK"
else
    echo "$LOG_PREFIX [2/2] FALLO (exit code: $?)"
fi

echo ""
echo "$LOG_PREFIX ════════════════════════════════════════════"
echo "$LOG_PREFIX Fin: $(date '+%Y-%m-%d %H:%M:%S')"
echo "$LOG_PREFIX ════════════════════════════════════════════"
