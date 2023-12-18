import reflex as rx
from links_bio.styles.styles import Size as Size
from links_bio.components.info_text import info_text
from links_bio.components.link_icon import link_icon
from links_bio.styles.colors import TextColor as TextColor

def header() -> rx.Component:
    return rx.vstack(
        rx.hstack(# el hstack es para que el contenido apareza de forma horizontal
            rx.avatar(
                name="Daniel Banariba", 
                size="xl"
            ),
            rx.vstack(
                rx.heading(
                    "Daniel Banariba", 
                    size="lg",
                    color=TextColor.HEADER.value
                ),
                rx.text(
                    "@danibanariba",
                    margin_top=Size.ZERO.value,
                    color=TextColor.BODY.value
                ),
                rx.hstack(
                    link_icon("dsfgfsfgfsfg") # TODO poner algun link, const.URL_GITHUB
                ),
                spacing=Size.DEFAULT.value
            )
        ),
        rx.flex(
            info_text(
                "+4", 
                "Años de experiencia filmando"
            ),
            rx.spacer(),
            info_text(
                "+10", 
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
            color=TextColor.BODY.value
        ),
        spacing=Size.BIG.value,
        align_items="start"
    )