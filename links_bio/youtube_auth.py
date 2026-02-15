"""
Autenticacion con YouTube API usando variables de entorno.

Variables requeridas:
    YOUTUBE_CLIENT_ID
    YOUTUBE_CLIENT_SECRET
    YOUTUBE_REFRESH_TOKEN
"""

import os

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube",
]


def authenticate_from_env():
    """Crea un cliente de YouTube API usando variables de entorno."""
    client_id = os.environ.get("YOUTUBE_CLIENT_ID")
    client_secret = os.environ.get("YOUTUBE_CLIENT_SECRET")
    refresh_token = os.environ.get("YOUTUBE_REFRESH_TOKEN")

    if not all([client_id, client_secret, refresh_token]):
        missing = []
        if not client_id:
            missing.append("YOUTUBE_CLIENT_ID")
        if not client_secret:
            missing.append("YOUTUBE_CLIENT_SECRET")
        if not refresh_token:
            missing.append("YOUTUBE_REFRESH_TOKEN")
        raise RuntimeError(
            f"Faltan variables de entorno para YouTube API: {', '.join(missing)}"
        )

    credentials = Credentials(
        token=None,
        refresh_token=refresh_token,
        client_id=client_id,
        client_secret=client_secret,
        token_uri="https://oauth2.googleapis.com/token",
        scopes=SCOPES,
    )

    return build("youtube", "v3", credentials=credentials)
