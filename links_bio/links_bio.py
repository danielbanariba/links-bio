import reflex as rx
import links_bio.styles.styles as styles
import links_bio.constants.images as IMG
from links_bio.components.navbar import navbar
from links_bio.views.header import header
from links_bio.views.links import links
from links_bio.components.footer import footer
from links_bio.styles.styles import Size

# Models (must be imported so Reflex discovers them for DB migrations)
import links_bio.models  # noqa: F401

# Metal Archive pages
from links_bio.pages.metal_archive.landing import landing_page
from links_bio.pages.metal_archive.browse import browse_page
from links_bio.pages.metal_archive.album_detail import album_detail_page
from links_bio.pages.metal_archive.genre_page import genre_page
from links_bio.pages.metal_archive.country_page import country_page
from links_bio.pages.metal_archive.year_page import year_page
from links_bio.pages.metal_archive.submit import submit_page
from links_bio.pages.metal_archive.promo import promo_page
from links_bio.pages.metal_archive.newsletter import newsletter_page

from links_bio.states.metal_archive_state import MetalArchiveState
from links_bio.states.form_state import FormState
import links_bio.constants.metal_archive as MA

def index() -> rx.Component:
    return rx.box(
        rx.script("document.documentElement.lang='es'"),
        navbar(),
        rx.center(
            rx.vstack(
                header(),
                links(),
                max_width=styles.MAX_WIDTH,
                width="100%",
                margin_y=Size.BIG.value,
                padding=Size.ZERO_PX.value,
                id="/"
            )
        ),
        footer()
    )

from links_bio.styles.styles import SKELETON_PULSE_CSS

# Inicializa la app
app = rx.App(
    stylesheets=styles.STYLESHEETS,
    style=styles.BASE_STYLE,
    head_components=[
        rx.el.style(SKELETON_PULSE_CSS),
    ],
)

app.add_page(
    index,
    title="Daniel Banariba | Desarrollador de Software y edicion de videos",
    description="Programador amante de la tecnologia, el cine y la musica. Especializado en desarrollo web y edicion de videos musicales.",
    image=IMG.AVATAR,
    meta=[
        {"property": "og:type", "content": "website"},
        {"property": "og:url", "content": "https://danielbanariba.com"},
        {"property": "og:title", "content": "Daniel Banariba | Desarrollador de Software y edicion de videos"},
        {"property": "og:description", "content": "Programador amante de la tecnologia, el cine y la musica. Especializado en desarrollo web y edicion de videos musicales."},
        {"property": "og:image", "content": "https://danielbanariba.com/avatar.jpg"},
    ],
)

# Metal Archive pages
app.add_page(
    landing_page,
    route=MA.METAL_ARCHIVE_HOME,
    title=MA.META_TITLE,
    description=MA.META_DESCRIPTION,
    on_load=MetalArchiveState.load_landing_page,
    meta=[
        {"property": "og:type", "content": "website"},
        {"property": "og:title", "content": MA.META_TITLE},
        {"property": "og:description", "content": MA.META_DESCRIPTION},
    ],
)
app.add_page(
    browse_page,
    route=MA.METAL_ARCHIVE_BROWSE,
    title=f"Browse | {MA.META_TITLE}",
    description=MA.META_DESCRIPTION,
    on_load=MetalArchiveState.load_browse_page,
)
app.add_page(
    album_detail_page,
    route=MA.METAL_ARCHIVE_ALBUM,
    title=f"Album | {MA.META_TITLE}",
    description=MA.META_DESCRIPTION,
    on_load=MetalArchiveState.load_album_detail,
)
app.add_page(
    genre_page,
    route=MA.METAL_ARCHIVE_GENRE,
    title=f"Genre | {MA.META_TITLE}",
    description=MA.META_DESCRIPTION,
    on_load=MetalArchiveState.load_genre_page,
)
app.add_page(
    country_page,
    route=MA.METAL_ARCHIVE_COUNTRY,
    title=f"Country | {MA.META_TITLE}",
    description=MA.META_DESCRIPTION,
    on_load=MetalArchiveState.load_country_page,
)
app.add_page(
    year_page,
    route=MA.METAL_ARCHIVE_YEAR,
    title=f"Year | {MA.META_TITLE}",
    description=MA.META_DESCRIPTION,
    on_load=MetalArchiveState.load_year_page,
)
app.add_page(
    submit_page,
    route=MA.METAL_ARCHIVE_SUBMIT,
    title=f"Submit your Band | {MA.META_TITLE}",
    description="Submit your band to be featured on the Metal Archive.",
)
app.add_page(
    promo_page,
    route=MA.METAL_ARCHIVE_PROMO,
    title=f"Submit | {MA.META_TITLE}",
    description="Submit your music to the Metal Archive.",
)
app.add_page(
    newsletter_page,
    route=MA.METAL_ARCHIVE_NEWSLETTER,
    title=f"Newsletter | {MA.META_TITLE}",
    description="Subscribe to the Metal Archive newsletter.",
)

# Crear tablas si no existen
rx.Model.create_all()

# Background sync: siempre intentar iniciar (la funcion verifica credenciales)
from links_bio.background_sync import start_background_sync
start_background_sync()
