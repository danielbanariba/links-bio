import reflex as rx
import datetime
from links_bio.styles.styles import Size as Size
from links_bio.styles.colors import TextColor as TextColor

def footer() -> rx.Component:
    return rx.vstack(
        rx.image(
            src="favicon.ico"
        ),
        rx.link(
            # TODO Cuando empiece a crear las paginas web a las bandas amigas, lo que tengo planeado hacer es que poner 
            # el mismo footer en todas las paginas web, pero que el footer tenga un link a mi pagina web
            f"2023-{datetime.datetime.today().year} © Daniel Banariba", 
            href="www.danibanariba.com",
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
        color=TextColor.FOOTER.value
    )