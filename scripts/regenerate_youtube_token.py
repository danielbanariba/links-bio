"""
Regenera el YOUTUBE_REFRESH_TOKEN.

Uso:
    env/bin/python scripts/regenerate_youtube_token.py

Lee YOUTUBE_CLIENT_ID y YOUTUBE_CLIENT_SECRET directo del archivo .env
(sin pasar por shell para evitar problemas con valores que tienen espacios).
Abre el navegador para autorizar la app, recibe el callback en localhost:8765,
imprime el nuevo refresh_token. Pegalo en .env y reinicia links-bio.service.
"""

import os
import sys
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube",
]


def load_env_file(path: Path) -> dict[str, str]:
    """Parser minimal de .env compatible con systemd: KEY=VALUE, valores literales."""
    env: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def main():
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        print(f"ERROR: no encuentro {env_path}", file=sys.stderr)
        sys.exit(1)

    env = load_env_file(env_path)
    client_id = env.get("YOUTUBE_CLIENT_ID") or os.environ.get("YOUTUBE_CLIENT_ID")
    client_secret = env.get("YOUTUBE_CLIENT_SECRET") or os.environ.get("YOUTUBE_CLIENT_SECRET")

    if not client_id or not client_secret:
        print("ERROR: faltan YOUTUBE_CLIENT_ID o YOUTUBE_CLIENT_SECRET en .env", file=sys.stderr)
        sys.exit(1)

    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://127.0.0.1:8765/"],
        }
    }

    flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
    creds = flow.run_local_server(
        host="127.0.0.1",
        port=8765,
        prompt="consent",
        access_type="offline",
        open_browser=True,
    )

    if not creds.refresh_token:
        print("ERROR: Google no devolvió refresh_token. Asegurate de pasar prompt='consent'.", file=sys.stderr)
        sys.exit(1)

    print()
    print("=" * 60)
    print("NUEVO REFRESH TOKEN (pegalo en .env como YOUTUBE_REFRESH_TOKEN):")
    print("=" * 60)
    print(creds.refresh_token)
    print("=" * 60)


if __name__ == "__main__":
    main()
