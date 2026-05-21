import reflex as rx
from reflex.plugins.sitemap import SitemapPlugin

config = rx.Config(
    app_name="links_bio",
    db_url="sqlite:///reflex.db",
    disable_plugins=[SitemapPlugin],
    api_url="https://app.danielbanariba.com",
    deploy_url="https://danielbanariba.com",
    cors_allowed_origins=[
        "https://danielbanariba.com",
        "https://www.danielbanariba.com",
        "https://app.danielbanariba.com",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
)