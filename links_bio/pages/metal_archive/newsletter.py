import reflex as rx
from links_bio.styles.styles import METAL_ARCHIVE_MAX_WIDTH, Size
from links_bio.styles.colors import TextColor
from links_bio.components.metal.metal_navbar import metal_navbar
from links_bio.components.metal.newsletter_form import newsletter_form_inline
from links_bio.components.footer import footer


def newsletter_page() -> rx.Component:
    return rx.box(
        metal_navbar(),
        rx.center(
            rx.vstack(
                rx.heading(
                    "Newsletter",
                    font_size="2em",
                    color=TextColor.HEADER.value,
                ),
                rx.text(
                    "Suscribete para recibir noticias sobre nuevos albums, bandas y eventos del metal underground.",
                    color=TextColor.BODY.value,
                    text_align="center",
                    max_width="600px",
                ),
                rx.box(
                    newsletter_form_inline(),
                    width="100%",
                    max_width="600px",
                ),
                max_width=METAL_ARCHIVE_MAX_WIDTH,
                width="100%",
                padding_x=Size.BIG.value,
                padding_y="5em",
                spacing="4",
                align_items="center",
            ),
        ),
        footer(),
    )
