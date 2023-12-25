import reflex as rx
from links_bio.styles.styles import Size
from links_bio.styles.colors import Color, TextColor

def info_text(title: str, body: str) -> rx.Component:
    return rx.box(
        rx.span(
            title, 
            font_weight="bold", 
            color=Color.PRIMARY.value
        ),
        f"{body}", 
        font_size=Size.DEFAULT.value,
        color=TextColor.BODY.value,
    )