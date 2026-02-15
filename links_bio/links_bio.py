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
        rx.script(
            """
            const metaOg = [
                {property: 'og:type', content: 'website'},
                {property: 'og:url', content: 'https://danielbanariba.com'},
                {property: 'og:title', content: 'Daniel Banariba | Desarrollador de Software y edición de videos'},
                {property: 'og:description', content: 'Programador amante de la tecnología, el cine y la música. Especializado en desarrollo web y edición de videos musicales.'},
                {property: 'og:image', content: 'https://danielbanariba.com/avatar.jpg'},
            ];
            metaOg.forEach(meta => {
                const element = document.createElement('meta');
                Object.keys(meta).forEach(key => element.setAttribute(key, meta[key]));
                document.head.appendChild(element);
            });
            """,
            type="application/javascript"
        ),
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

# ── Debug API (temporal) ──
import os as _os
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route

async def _debug_sync_handler(request):
    from links_bio.background_sync import _started, _sync_thread
    from links_bio.models.album import Album
    from sqlmodel import select
    album_count = 0
    sample_artworks = []
    deathgrind_count = 0
    youtube_count = 0
    empty_count = 0
    try:
        with rx.session() as session:
            albums = session.exec(select(Album)).all()
            album_count = len(albums)
            for a in albums[:5]:
                sample_artworks.append({
                    "band": a.band_name,
                    "album": a.album_title,
                    "artwork_url": a.album_artwork_url or "",
                })
            for a in albums:
                url = a.album_artwork_url or ""
                if "cdn.deathgrind.club" in url:
                    deathgrind_count += 1
                elif "ytimg.com" in url or "youtube.com" in url:
                    youtube_count += 1
                elif not url:
                    empty_count += 1
    except Exception as e:
        album_count = str(e)
    return JSONResponse({
        "yt_refresh_token": bool(_os.environ.get("YOUTUBE_REFRESH_TOKEN")),
        "yt_client_id": bool(_os.environ.get("YOUTUBE_CLIENT_ID")),
        "sync_started": _started,
        "thread_alive": _sync_thread.is_alive() if _sync_thread else False,
        "album_count": album_count,
        "artwork_deathgrind": deathgrind_count,
        "artwork_youtube": youtube_count,
        "artwork_empty": empty_count,
        "sample_artworks": sample_artworks,
    })

_debug_app = Starlette(routes=[
    Route("/api/debug-sync.json", _debug_sync_handler, methods=["GET", "POST", "HEAD"]),
])

# Inicializa la app
app = rx.App(
    stylesheets=styles.STYLESHEETS,
    style=styles.BASE_STYLE,
    api_transformer=_debug_app,
    # enable_state ahora activo para Metal Archive (requiere backend)
    # head_components=[
    #     #TODO agregar google analytics pero de mi perfil!
    #     rx.script(src=""),
    #     rx.script(
    #         """
    #         window.dataLayer = window.dataLayer || [];
    #         function gtag(){dataLayer.push(arguments);}
    #         gtag('js', new Date());
    #         gtag('config', ''); #TODO agregar el id de google analytics, en las comillas
    #         """
    #     ),
    # ],
)

app.add_page(
    index,
    title="Daniel Banariba | Desarrollador de Software y edición de videos",
    description="Hola! mi nombre es Daniel Alejandro Barrientos Anariba soy un programador amante de la tecnologia, el cine y la música.",
    image=IMG.AVATAR
)

# Metal Archive pages
app.add_page(
    landing_page,
    route=MA.METAL_ARCHIVE_HOME,
    title=MA.META_TITLE,
    description=MA.META_DESCRIPTION,
    on_load=MetalArchiveState.load_landing_page,
)
app.add_page(
    browse_page,
    route=MA.METAL_ARCHIVE_BROWSE,
    title=f"Explorar | {MA.META_TITLE}",
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
    title=f"Genero | {MA.META_TITLE}",
    description=MA.META_DESCRIPTION,
    on_load=MetalArchiveState.load_genre_page,
)
app.add_page(
    country_page,
    route=MA.METAL_ARCHIVE_COUNTRY,
    title=f"Pais | {MA.META_TITLE}",
    description=MA.META_DESCRIPTION,
    on_load=MetalArchiveState.load_country_page,
)
app.add_page(
    year_page,
    route=MA.METAL_ARCHIVE_YEAR,
    title=f"Ano | {MA.META_TITLE}",
    description=MA.META_DESCRIPTION,
    on_load=MetalArchiveState.load_year_page,
)
app.add_page(
    submit_page,
    route=MA.METAL_ARCHIVE_SUBMIT,
    title=f"Enviar tu Banda | {MA.META_TITLE}",
    description="Envia tu banda para ser publicada en el Metal Archive.",
)
app.add_page(
    promo_page,
    route=MA.METAL_ARCHIVE_PROMO,
    title=f"Promocion | {MA.META_TITLE}",
    description="Paquetes de promocion para bandas de metal.",
)
app.add_page(
    newsletter_page,
    route=MA.METAL_ARCHIVE_NEWSLETTER,
    title=f"Newsletter | {MA.META_TITLE}",
    description="Suscribete al newsletter del Metal Archive.",
)

# Crear tablas si no existen (necesario en Reflex Cloud con DB fresca)
rx.Model.create_all()

# Background sync: se activa solo si YOUTUBE_REFRESH_TOKEN esta configurado
from links_bio.background_sync import start_background_sync
start_background_sync()
