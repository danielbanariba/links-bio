import reflex as rx
import datetime
import links_bio.styles.styles as styles
from links_bio.styles.styles import Size 
from links_bio.styles.colors import Color, TextColor

def footer() -> rx.Component:
    return rx.vstack(
        # rx.image(
        #     #src="logo.png", 
        #     height="auto",
        #     width="auto",
        #     alt="Logotipo de DanielBanariba."
        #),
        rx.link(# * Cuando empiece a crear las paginas web a las bandas amigas, lo que tengo planeado hacer es que poner el mismo footer en todas las paginas web, pero que el footer tenga un link a mi pagina web
            rx.box(
                f"2023-{datetime.datetime.today().year} © ",
                rx.span(
                    """DanielBanariba""", color=Color.LOGO_CANAL.value,
                    style=styles.logo_canal),
            ),
            #href="www.danibanariba.com", # ! Cuando tenga lista mi pagina web oficial, ponerla aqui la url
            is_external=True,
            font_size=Size.MEDIUM.value
        ),
        rx.text(
            "Gracias por visitar mi pagina web! ╰(*°▽°*)╯",
            font_size=Size.MEDIUM.value,
            margin_top=Size.ZERO.value
        ),
        margin_bottom=Size.BIG.value,
        padding_botoom=Size.BIG.value, # Para que se separare el texto de la parte de abajo
        padding_x=Size.BIG.value,
        spacing=Size.DEFAULT.value,
        color=TextColor.FOOTER.value
    )