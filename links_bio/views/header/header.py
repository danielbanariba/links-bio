import reflex as rx
import datetime
from links_bio.views.links.url_social import Url as URL
from links_bio.styles.styles import Size 
from links_bio.styles.colors import Color, TextColor
from links_bio.components.info_text import info_text
from links_bio.components.link_icon import link_icon

def header() -> rx.Component:
    return rx.vstack(
        rx.hstack(# el hstack es para que el contenido apareza de forma horizontal
            rx.avatar(
                name="Daniel Banariba", 
                size="xl",
                src="avatar.jpeg", #TODO Funciona, pero se mira muy feo el avatar, hay que buscar una forma de que se vea mejor 
                color=TextColor.BODY.value,
                bg=Color.CONTENT.value,
                padding="2px",
                border="4px",
                border_color=Color.PRIMARY.value
            ),
            rx.vstack(
                rx.heading(
                    "Daniel Banariba", 
                    size="lg"
                ),
                rx.text(
                    "@danibanariba",
                    margin_top=Size.ZERO.value,
                    color=Color.PRIMARY.value
                ),
                rx.hstack(
                    link_icon(
                        "icons/github.svg",
                        str(URL.GITHUB),
                        "GitHub"
                    ),
                    link_icon(
                        "icons/instagram.svg",
                        str(URL.INSTAGRAM),
                        "Instagram"
                    ),
                    link_icon(
                        "icons/tiktok.svg",
                        str(URL.TIKTOK),
                        "TikTok"
                    ),
                    link_icon(
                        "icons/linkedin.svg",
                        str(URL.LINKEDIN),
                        "LinkedIn"
                    ),
                    spacing=Size.LARGE.value
                ),
                align_items="start"
            ),
            spacing=Size.DEFAULT.value
        ),
        rx.flex(
            info_text(
                f"{experienceFilm()}+",
                "Años de experiencia filmando"
            ),
            rx.spacer(),
            info_text(
                f"{experienceEditorVideo()}+", 
                "Años de experiencia como editor de video"
            ),
            rx.spacer(),
            info_text(
                "+6000", 
                "Suscriptores en Youtube"
            ),
            width="100%"
        ),
        rx.text(
            """Soy un programador amante de la musica extrema y la musica en general, me encanta el septimo arte
            y todo lo que conlleva que es edicion, filmacion, y direccion, he trabajado con varias bandas al rededor de mi carrera
            haciendo multiples trabajos como videos musicales, live seccion, grabaciones en vivo y documentales.
            """,
            font_size=Size.DEFAULT.value,
            color=TextColor.BODY.value
        ),
        spacing=Size.BIG.value,
        align_items="start"
    )
    
def experienceFilm() -> int:
    return datetime.date.today().year - 2019

def experienceEditorVideo() -> str:
    return datetime.date.today().year - 2013