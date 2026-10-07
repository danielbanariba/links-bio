#!/usr/bin/env bash
set -euo pipefail

if ! command -v uv >/dev/null 2>&1; then
    echo "build.sh: 'uv' is not on PATH. Install it first (see https://docs.astral.sh/uv/getting-started/installation/), then re-run this script." >&2
    exit 1
fi

source env/bin/activate
uv pip install --python env/bin/python -r requirements.txt
alembic upgrade head
deactivate
