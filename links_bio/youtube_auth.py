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

import logging
import os
import re

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger("youtube_auth")

SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube",
]

# Secrets that must never reach a log line verbatim. googleapiclient's
# HttpError.__str__ embeds the full failed request URI, which for an
# API-key client carries `key=<YOUTUBE_API_KEY>` -- a routine 403/quota
# error would otherwise write the live credential into the systemd journal.
_SECRET_QUERY_PARAM_RE = re.compile(r"(?i)\b(key|access_token)=[^&\s'\"]+")
_SECRET_ENV_VARS = ("YOUTUBE_API_KEY", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN")


def _redact_secrets(message: str) -> str:
    """Mask anything in `message` that could leak a YouTube credential.

    Two independent passes: (1) mask any `key=`/`access_token=`
    query-parameter value, which is how a stringified HttpError exposes an
    API key embedded in the request URI; (2) replace the literal value of
    any configured YOUTUBE_API_KEY/YOUTUBE_CLIENT_SECRET/YOUTUBE_REFRESH_TOKEN
    (only when 8+ chars, so short/placeholder test values aren't mangled)
    wherever it appears, even outside a `key=` query parameter.
    """
    redacted = _SECRET_QUERY_PARAM_RE.sub(r"\1=****", message)
    for env_var in _SECRET_ENV_VARS:
        value = os.environ.get(env_var)
        if value and len(value) >= 8:
            redacted = redacted.replace(value, "****")
    return redacted


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
        from sqlmodel import Session, select
        from links_bio.db import engine
        from links_bio.models.album import Album
        with Session(engine) as session:
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
    except Exception as e:
        # Non-fatal: the RuntimeError below still fires. But the exact
        # mechanism that hid the T7 reflex-import regression was this
        # branch swallowing every exception with no trace at all, so log
        # the cause instead of staying silent -- never the raw exception
        # string, though: for an HttpError raised against an API-key
        # client, str(e) embeds the full request URI with `key=<...>` in
        # it, which would otherwise leak the YouTube API key into the
        # systemd journal on every routine 403/quota failure (T26 item 1).
        if isinstance(e, HttpError):
            detail = f"HTTP {e.status_code} {e.reason}".strip()
        else:
            detail = str(e)
        logger.warning(
            "channel id DB fallback failed: %s: %s",
            type(e).__name__,
            _redact_secrets(detail),
        )

    raise RuntimeError(
        "No se pudo determinar Channel ID. "
        "Configura YOUTUBE_CHANNEL_ID o usa OAuth."
    )
