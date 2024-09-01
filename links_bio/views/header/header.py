import reflex as rx
import datetime
import links_bio.views.links.url_social as URL 
from links_bio.styles.styles import Size
from links_bio.styles.styles import TAMANIO_ICON
from links_bio.styles.colors import Color, TextColor
from links_bio.components.info_text import info_text
from links_bio.components.link_icon import icon

def header() -> rx.Component:
    return rx.vstack(
        rx.hstack(
            rx.avatar(
                name="Daniel Banariba", 
                size="8",
                src="avatar.jpg", 
                color=TextColor.BODY.value,
                bg=Color.CONTENT.value,
                padding="2px",
                border="4px solid",
                border_color=Color.PRIMARY.value,
                radius="full"
            ),
            rx.vstack(
                rx.heading(
                    "Daniel Banariba", 
                    font_size=Size.BIG.value,
                ),
                rx.text(
                    "@danielbanariba",
                    margin_top=Size.ZERO.value,
                    color=Color.PRIMARY.value,
                    font_size=Size.ALGO_GRANDE.value
                ),
                rx.tablet_and_desktop(
                    rx.hstack(
                        icon("github", TAMANIO_ICON, URL.GITHUB,"GitHub"),
                        icon("instagram", TAMANIO_ICON, URL.INSTAGRAM, "Instagram"),
                        icon("facebook", TAMANIO_ICON, URL.FACEBOOK,"Facebook"),
                        icon("youtube", TAMANIO_ICON, URL.YOUTUBE, "Youtube"),
                        icon("tiktok", TAMANIO_ICON, URL.TIKTOK, "TikTok"),
                        icon("linkedin", TAMANIO_ICON, URL.LINKEDIN, "LinkedIn"),
                    spacing=Size.GRANDELOGO.value,
                    ),    
                ),
            spacing=Size.SMALL.value,
            justify_content="center",
            align_items="start",
            height="100%",
        ),
        align_items="center",  # Center items vertically
        width="100%"
        ),
        rx.mobile_only(
            rx.container(
                rx.vstack(
                    rx.hstack(
                        icon("github", TAMANIO_ICON, URL.GITHUB,"GitHub"),
                        icon("instagram", TAMANIO_ICON, URL.INSTAGRAM, "Instagram"),
                        icon("facebook", TAMANIO_ICON, URL.FACEBOOK,"Facebook"),
                        icon("youtube", TAMANIO_ICON, URL.YOUTUBE, "Youtube"),
                        icon("tiktok", TAMANIO_ICON, URL.TIKTOK, "TikTok"),
                        icon("linkedin", TAMANIO_ICON, URL.LINKEDIN, "LinkedIn"),
                    spacing=Size.GRANDELOGO.value,
                    ),
                ),
                center_content=True,
                spacing=Size.VERY_BIG.value,
            ),
        ),
        
        rx.hstack(
            info_text(
                f"{experiencePrograming()}+",
                "Años de experiencia programando"
            ),
            rx.spacer(),
            info_text(
                f"{experienceEditorVideo()}+", 
                "Años de experiencia editando y filmando videos"
            ),
            rx.spacer(),
            info_text(
                "+6000 ", 
                "Suscriptores en Youtube"
            ),
            width="100%",
            padding_right=Size.BIG.value,
        ),
        rx.text(
            """Soy un programador amante de la música extrema y la música en general, me encanta el septimo arte
            y todo lo que conlleva que sea edicion, filmacion, y direccion, he trabajado con multiples bandas al rededor de mi carrera
            haciendo trabajos como videos músicales, live seccion, grabaciones en vivo y documentales.
            """,
            font_size=Size.ALGO_GRANDE.value,
            color=TextColor.BODY.value,
            width="100%",
        ),
        width="100%",
        spacing=Size.ALGO_GRANDE.value,
        align_items="start",
        padding_right=Size.BIG.value,
        padding_left=Size.BIG.value,
    )

# Funciones para calcular la experiencia y no tener que estar cambiando el año manualmente
def experiencePrograming() -> int:
    return datetime.date.today().year - 2021

def experienceEditorVideo() -> str:
    return datetime.date.today().year - 2018