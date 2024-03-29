import reflex as rx
import datetime
import links_bio.styles.styles as styles
from links_bio.styles.styles import Size, Color, TextColor
import links_bio.views.links.url_social as URL 

def footer() -> rx.Component:
    return rx.vstack(
        rx.link(
            rx.box(
                rx.span(
                    """DANIEL\nBANARIBA""",
                    color=Color.LOGO_CANAL.value,
                    style=styles.logo_canal,
                    alt="Logotipo de DanielBanariba.",
                ),
            ),
            href=URL.HOME,
            target="_blank",
            is_external=False,
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