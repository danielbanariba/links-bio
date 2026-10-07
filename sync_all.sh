#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# sync_all.sh — Orquestador de sincronizacion completa
#
# Ejecuta en orden:
#   1. sync_youtube_to_db.py  (videos -> DB + mark featured; tambien fija
#      album_artwork_url al thumbnail de YouTube, la fuente de portadas)
#   2. sync_artwork_fallback.py (portadas fallback: Metal Archives / YouTube)
#   3. normalize_db.py (normalizar generos y paises)
#
# El paso de deathgrind.club (sync_artwork_deathgrind.py) fue eliminado:
# cdn.deathgrind.club envia Cross-Origin-Resource-Policy: same-site, por lo
# que el navegador bloquea esas portadas sin importar lo que haga este
# pipeline.
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
echo "$LOG_PREFIX [1/3] Sincronizando videos de YouTube..."
if $PYTHON sync_youtube_to_db.py --solo-nuevos --mark-featured; then
    echo "$LOG_PREFIX [1/3] OK"
else
    echo "$LOG_PREFIX [1/3] FALLO (exit code: $?). Continuando..."
fi

# ─── Paso 2: Fallback de portadas (Metal Archives / YouTube) ────────
echo ""
echo "$LOG_PREFIX [2/3] Buscando portadas fallback..."
if $PYTHON sync_artwork_fallback.py; then
    echo "$LOG_PREFIX [2/3] OK"
else
    echo "$LOG_PREFIX [2/3] FALLO (exit code: $?). Continuando..."
fi

# ─── Paso 3: Normalizar generos y paises ─────────────────────────────
echo ""
echo "$LOG_PREFIX [3/3] Normalizando datos..."
if $PYTHON scripts/normalize_db.py; then
    echo "$LOG_PREFIX [3/3] OK"
else
    echo "$LOG_PREFIX [3/3] FALLO (exit code: $?)"
fi

echo ""
echo "$LOG_PREFIX ════════════════════════════════════════════"
echo "$LOG_PREFIX Fin: $(date '+%Y-%m-%d %H:%M:%S')"
echo "$LOG_PREFIX ════════════════════════════════════════════"
