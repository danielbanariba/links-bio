import reflex as rx

config = rx.Config(
    app_name="links_bio",
    db_url="sqlite:///reflex.db",
    disable_plugins=["reflex.plugins.sitemap.SitemapPlugin"],
)