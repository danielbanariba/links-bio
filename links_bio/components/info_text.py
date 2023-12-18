import reflex as rx
from links_bio.styles.styles import Size as Size
from links_bio.styles.styles import Color as Color
from links_bio.styles.styles import TextColor as TextColor

def info_text(title: str, body: str) -> rx.Component:
    return rx.box(
        rx.span(
            title, 
            font_weight="bold", 
            color=Color.PRIMARY.value
        ),
        f" {body}", 
        font_size=Size.MEDIUM.value,
        color=TextColor.BODY.value
    )