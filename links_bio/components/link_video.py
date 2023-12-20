import reflex as rx
import links_bio.styles.styles as styles
from links_bio.styles.styles import Size
from links_bio.styles.colors import Color

def link_video(title: str, body: str, image: str, url: str) -> rx.Component:
    return rx.hstack(
        rx.hstack(
            rx.box(
                rx.vstack(
                    rx.box(
                        rx.text(title, style=styles.button_title_style),
                        rx.text(body, style=styles.button_body_style),
                        bg=Color.CONTENT.value,
                        padding=Size.DEFAULT.value,
                        border_radius=Size.DEFAULT.value,
                    ),
                    align_items="start",
                    spacing=Size.SMALL.value,
                    padding_y=Size.SMALL.value,
                    padding_right=Size.SMALL.value
                ),
                rx.link(
                    rx.image(
                        src=image, 
                        width="auto", 
                        height="auto",
                        margin="auto",
                        alt=title,
                        border_radius = Size.DEFAULT.value,
                    ),
                ),
                width="100%"
            ),
        ),
        href=url,
        is_external=True, # Se abren los links en una nueva pestaña
        width="100%"
    )