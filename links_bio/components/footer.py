import reflex as rx
import datetime
import links_bio.styles.styles as styles
from links_bio.styles.styles import Size, Color, TextColor
import links_bio.views.links.url_social as URL 

def footer() -> rx.Component:
    return rx.center(
        rx.vstack(
            rx.link(
                rx.box(
                    rx.text(
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
            rx.text(
                "Gracias por visitar mi pagina web! ╰(*°▽°*)╯",
                font_size=Size.MEDIUM.value,
            ),
            rx.center(
                rx.text(
                    f" © 2023-{datetime.datetime.today().year}",
                    font_size=Size.MEDIUM.value,  
                ),
            ),
            width="100%",
            align_items="center",
            margin_bottom=Size.MEDIUM.value,
            padding_botoom=Size.SMALL.value, # Para que se separare el texto de la parte de abajo
            padding_x=Size.BIG.value, # Responsive, se separe el texto de los lados
            spacing=Size.ZERO.value,
            color=TextColor.FOOTER.value
        )
    )