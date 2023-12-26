import reflex as rx
import datetime
import links_bio.styles.styles as styles
from links_bio.styles.styles import Size, Color, TextColor

def footer() -> rx.Component:
    return rx.vstack(
        rx.link(# * Cuando empiece a crear las paginas web a las bandas amigas, lo que tengo planeado hacer es que poner el mismo footer en todas las paginas web, pero que el footer tenga un link a mi pagina web
            rx.box(
                rx.span(
                    """DANIEL\nBANARIBA""",
                    color=Color.LOGO_CANAL.value,
                    style=styles.logo_canal,
                    _hover={"color": "#045b90"},
                    alt="Logotipo de DanielBanariba.",
                ),
            ),
            href="www.danielbanariba.com", # ! Cuando tenga lista mi pagina web oficial, ponerla aqui la url
            is_external=True,
            font_size=Size.DEFAULT.value,
        ),
        rx.span(
            "Gracias por visitar mi pagina web! ╰(*°▽°*)╯",
            font_size=Size.MEDIUM.value,
        ),
        rx.center(
            rx.span(
                f" © 2023-{datetime.datetime.today().year}",
                font_size=Size.MEDIUM.value,  
            ),
        ),
        margin_bottom=Size.MEDIUM.value,
        padding_botoom=Size.SMALL.value, # Para que se separare el texto de la parte de abajo
        padding_x=Size.BIG.value, # Responsive, se separe el texto de los lados
        spacing=Size.ZERO.value,
        color=TextColor.FOOTER.value
    )