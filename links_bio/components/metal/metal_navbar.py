import reflex as rx
from links_bio.styles.styles import Size
from links_bio.styles.colors import Color, TextColor, LogoColor
from links_bio.styles.fonts import Font, FontWeight
import links_bio.constants.metal_archive as MA


def metal_navbar() -> rx.Component:
    return rx.hstack(
        rx.link(
            rx.hstack(
                rx.text("{", color=LogoColor.PARENTESIS.value),
                rx.text("daniel_banariba", color=LogoColor.PALABRAS.value),
                rx.text("}", color=LogoColor.PARENTESIS.value),
                rx.text(";", color=LogoColor.PUNTO_Y_COMA.value),
                font_family=Font.LOGO.value,
                font_weight=FontWeight.MEDIUM.value,
                font_size="2.2em",
                spacing="0",
            ),
            href=MA.METAL_ARCHIVE_HOME,
            text_decoration="none",
        ),
        rx.spacer(),
        rx.hstack(
            rx.link(
                "Inicio",
                href=MA.METAL_ARCHIVE_HOME,
                color=TextColor.BODY.value,
                _hover={"color": Color.PRIMARY.value},
                font_size=Size.MEDIUM.value,
            ),
            rx.link(
                "Explorar",
                href=MA.METAL_ARCHIVE_BROWSE,
                color=TextColor.BODY.value,
                _hover={"color": Color.PRIMARY.value},
                font_size=Size.MEDIUM.value,
            ),
            rx.link(
                "Subir musica",
                href=MA.METAL_ARCHIVE_PROMO,
                color=TextColor.BODY.value,
                _hover={"color": Color.PRIMARY.value},
                font_size=Size.MEDIUM.value,
            ),
            spacing="4",
        ),
        position="sticky",
        top="0",
        z_index="999",
        background=Color.CONTENT.value,
        padding_x=Size.BIG.value,
        padding_y=Size.DEFAULT.value,
        width="100%",
        align_items="center",
    )
