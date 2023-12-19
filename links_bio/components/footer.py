import reflex as rx
import datetime
from links_bio.styles.styles import Size 
from links_bio.styles.colors import Color, TextColor

def footer() -> rx.Component:
    return rx.vstack(
        rx.image(
            src="favicon.ico"
        ),
        rx.link(
            rx.box(# TODO Cuando empiece a crear las paginas web a las bandas amigas, lo que tengo planeado hacer es que poner el mismo footer en todas las paginas web, pero que el footer tenga un link a mi pagina web
                f"© 2023-{datetime.datetime.today().year}",
                rx.span("Daniel Banariba", color=Color.PRIMARY.value),
            ),
            #href="www.danibanariba.com", # TODO Cuando tenga lista mi pagina web oficial, ponerla aqui la url
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
    
