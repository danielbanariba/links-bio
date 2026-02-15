import reflex as rx
from links_bio.styles.styles import Size
from links_bio.styles.colors import Color, TextColor
from links_bio.styles.fonts import Font, FontWeight
import links_bio.constants.metal_archive as MA


def metal_navbar() -> rx.Component:
    return rx.hstack(
        rx.link(
            rx.text(
                "Metal Archive",
                font_family=Font.TITLE.value,
                font_weight=FontWeight.MEDIUM.value,
                font_size=Size.LARGE.value,
                color=TextColor.HEADER.value,
            ),
            href=MA.METAL_ARCHIVE_HOME,
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
                "Enviar",
                href=MA.METAL_ARCHIVE_SUBMIT,
                color=TextColor.BODY.value,
                _hover={"color": Color.PRIMARY.value},
                font_size=Size.MEDIUM.value,
            ),
            rx.link(
                "Promocion",
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
