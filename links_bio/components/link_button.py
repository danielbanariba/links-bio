import reflex as rx
import links_bio.styles.styles as styles
from links_bio.styles.styles import Size
from links_bio.styles.colors import Color

# Recibe como parametro el texto del boton y la url a la que se quiere redirigir
def link_button(title: str, body: str, image: str, url: str) -> rx.Component:
    return rx.link(
        rx.button(
            rx.hstack(
                rx.image(
                    src=image, #guarda las url en las imagenes, en pocas palabras al momento de hacer click a la imagen abre una pagina nueva
                    width=Size.LARGE.value,
                    height=Size.LARGE.value,
                    margin=Size.MEDIUM.value,
                    alt=title
                ),
                rx.vstack(
                    rx.text(title, style=styles.button_title_style),
                    rx.text(body, style=styles.button_body_style),
                    align_items="start",
                    spacing=Size.SMALL.value,
                    padding_y=Size.SMALL.value,
                    padding_right=Size.SMALL.value
                ),
                width="100%"
            )
        ),
        href=url,
        is_external=True, # Se abren los links en una nueva pestaña
        width="100%"
    )