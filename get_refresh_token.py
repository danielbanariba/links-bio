"""Genera un refresh token para YouTube API usando las credenciales del proyecto links-bio."""
import os
from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow

load_dotenv()

client_id = os.environ.get("YOUTUBE_CLIENT_ID")
client_secret = os.environ.get("YOUTUBE_CLIENT_SECRET")

if not client_id or not client_secret:
    raise RuntimeError("Configura YOUTUBE_CLIENT_ID y YOUTUBE_CLIENT_SECRET en .env")

SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube",
]

CLIENT_CONFIG = {
    "installed": {
        "client_id": client_id,
        "client_secret": client_secret,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": ["http://localhost"],
    }
}

flow = InstalledAppFlow.from_client_config(CLIENT_CONFIG, SCOPES)
credentials = flow.run_local_server(port=8080)

print("\n" + "=" * 60)
print("REFRESH TOKEN (copia esto):")
print("=" * 60)
print(credentials.refresh_token)
print("=" * 60)
