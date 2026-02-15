#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# sync_all.sh — Orquestador de sincronizacion completa
#
# Ejecuta en orden:
#   1. sync_youtube_to_db.py  (videos -> DB + mark featured)
#   2. sync_artwork_deathgrind.py (portadas desde deathgrind.club)
#   3. sync_artwork_fallback.py (portadas fallback: Metal Archives / YouTube)
#   4. normalize_db.py (normalizar generos y paises)
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
echo "$LOG_PREFIX [1/4] Sincronizando videos de YouTube..."
if $PYTHON sync_youtube_to_db.py --solo-nuevos --mark-featured; then
    echo "$LOG_PREFIX [1/4] OK"
else
    echo "$LOG_PREFIX [1/4] FALLO (exit code: $?). Continuando..."
fi

# ─── Paso 2: Buscar portadas en deathgrind.club ─────────────────────
echo ""
echo "$LOG_PREFIX [2/4] Buscando portadas en deathgrind.club..."
if $PYTHON sync_artwork_deathgrind.py --solo-vacios; then
    echo "$LOG_PREFIX [2/4] OK"
else
    echo "$LOG_PREFIX [2/4] FALLO (exit code: $?). Continuando..."
fi

# ─── Paso 3: Fallback de portadas (Metal Archives / YouTube) ────────
echo ""
echo "$LOG_PREFIX [3/4] Buscando portadas fallback..."
if $PYTHON sync_artwork_fallback.py; then
    echo "$LOG_PREFIX [3/4] OK"
else
    echo "$LOG_PREFIX [3/4] FALLO (exit code: $?). Continuando..."
fi

# ─── Paso 4: Normalizar generos y paises ─────────────────────────────
echo ""
echo "$LOG_PREFIX [4/4] Normalizando datos..."
if $PYTHON scripts/normalize_db.py; then
    echo "$LOG_PREFIX [4/4] OK"
else
    echo "$LOG_PREFIX [4/4] FALLO (exit code: $?)"
fi

echo ""
echo "$LOG_PREFIX ════════════════════════════════════════════"
echo "$LOG_PREFIX Fin: $(date '+%Y-%m-%d %H:%M:%S')"
echo "$LOG_PREFIX ════════════════════════════════════════════"
