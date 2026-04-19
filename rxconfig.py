import reflex as rx
from reflex.plugins.sitemap import SitemapPlugin

config = rx.Config(
    app_name="links_bio",
    db_url="sqlite:///reflex.db",
    disable_plugins=[SitemapPlugin],
)