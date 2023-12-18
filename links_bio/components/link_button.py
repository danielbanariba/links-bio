import reflex as rx
import links_bio.styles.styles as styles
from links_bio.styles.styles import Size as Size

# Recibe como parametro el texto del boton y la url a la que se quiere redirigir
def link_button(title: str, body: str, url: str) -> rx.Component:
    return rx.link(
        rx.button(
            rx.hstack(
                rx.icon(
                    tag="arrow_forward",
                    width=Size.BIG.value,
                    height=Size.DEFAULT.value,
                    margin=Size.MEDIUM.value
                ),
                rx.vstack(     
                    rx.text(title, style=styles.button_title_style),
                    rx.text(body, style=styles.button_body_style),
                    spacing=Size.SMALL.value,
                    align_items="start",
                    margin=Size.ZERO.value
                )
            )
        ),
        href=url,
        is_external=True, # Se abren los links en una nueva pestaña
        width="100%"
    )