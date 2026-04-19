import reflex as rx
import links_bio.styles.styles as styles
from links_bio.styles.styles import Size
from links_bio.styles.colors import Color, LogoColor


def navbar() -> rx.Component:
    return rx.hstack(
        rx.hstack(
            rx.text("{", color=LogoColor.PARENTESIS.value),
            rx.text("daniel_banariba", color=LogoColor.PALABRAS.value),
            rx.text("}", color=LogoColor.PARENTESIS.value),
            rx.text(";", color=LogoColor.PUNTO_Y_COMA.value),
            style=styles.navbar_title_style,
            spacing=Size.ZERO.value,
        ),
        position="sticky",
        bg=Color.CONTENT.value,
        padding_x=Size.BIG.value,
        padding_y=Size.DEFAULT.value,
        z_index="999",
        top="0",
    )