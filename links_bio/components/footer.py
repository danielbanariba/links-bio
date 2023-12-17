import reflex as rx
import datetime
from links_bio.styles.styles import Size as Size

def footer() -> rx.Component:
    return rx.vstack(
        rx.image(
            src="favicon.ico"
        ),
        rx.link(
            f"2023-{datetime.datetime.today().year} © Daniel Banariba", 
            href="www.danibanariba.com",
            is_external=True,
            font_size=Size.MEDIUM.value
        ),
        rx.text(
            "Gracias por visitar mi pagina web! ╰(*°▽°*)╯",
            font_size=Size.MEDIUM.value),
        margin_botton=Size.BIG.value
    )