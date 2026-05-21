"""
Autenticacion con YouTube API.

Dos modos soportados (en orden de preferencia):

1. API Key (recomendado, no expira):
       YOUTUBE_API_KEY

2. OAuth refresh token (legacy, expira y requiere re-consent):
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


def authenticate_from_api_key():
    """Crea cliente YouTube usando una API Key. No expira, sin OAuth."""
    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        raise RuntimeError("YOUTUBE_API_KEY no configurado.")
    return build("youtube", "v3", developerKey=api_key, cache_discovery=False)


def authenticate_from_env():
    """Crea cliente YouTube usando OAuth refresh token (modo legacy)."""
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


def authenticate_auto():
    """Elige automaticamente API Key si esta, sino OAuth."""
    if os.environ.get("YOUTUBE_API_KEY"):
        return authenticate_from_api_key()
    return authenticate_from_env()


def get_channel_id_from_env_or_derive(youtube_client):
    """
    Retorna el Channel ID. Prioridad:
    1. YOUTUBE_CHANNEL_ID del env
    2. Derivado del cliente OAuth (mine=True) — solo funciona con OAuth
    3. Derivado del primer video en la DB via videos.list — funciona con API Key
    """
    channel_id = os.environ.get("YOUTUBE_CHANNEL_ID")
    if channel_id:
        return channel_id

    # Si es OAuth, podemos usar mine=True
    if os.environ.get("YOUTUBE_REFRESH_TOKEN") and not os.environ.get("YOUTUBE_API_KEY"):
        resp = youtube_client.channels().list(part="id", mine=True, maxResults=1).execute()
        items = resp.get("items", [])
        if items:
            return items[0]["id"]

    # Fallback: derivar del primer video en la DB
    try:
        import reflex as rx
        from sqlmodel import select
        from links_bio.models.album import Album
        with rx.session() as session:
            album = session.exec(
                select(Album).where(Album.youtube_video_id != "").limit(1)
            ).first()
        if album and album.youtube_video_id:
            resp = youtube_client.videos().list(
                part="snippet", id=album.youtube_video_id
            ).execute()
            items = resp.get("items", [])
            if items:
                return items[0]["snippet"]["channelId"]
    except Exception:
        pass

    raise RuntimeError(
        "No se pudo determinar Channel ID. "
        "Configura YOUTUBE_CHANNEL_ID o usa OAuth."
    )
