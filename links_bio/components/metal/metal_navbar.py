import reflex as rx
from links_bio.styles.styles import Size
from links_bio.styles.colors import Color, TextColor, LogoColor
from links_bio.styles.fonts import Font, FontWeight
from links_bio.states.metal_archive_state import MetalArchiveState
import links_bio.constants.metal_archive as MA
from links_bio.components import icons


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
                "Home",
                href=MA.METAL_ARCHIVE_HOME,
                color=TextColor.BODY.value,
                _hover={"color": Color.PRIMARY.value},
                font_size=Size.MEDIUM.value,
            ),
            rx.link(
                "Browse",
                href=MA.METAL_ARCHIVE_BROWSE,
                color=TextColor.BODY.value,
                _hover={"color": Color.PRIMARY.value},
                font_size=Size.MEDIUM.value,
            ),
            rx.link(
                "Submit",
                href=MA.METAL_ARCHIVE_PROMO,
                color=TextColor.BODY.value,
                _hover={"color": Color.PRIMARY.value},
                font_size=Size.MEDIUM.value,
                white_space="nowrap",
            ),
            rx.button(
                icons.icon_dices(size=16),
                rx.tablet_and_desktop(rx.text("Sorpréndeme", as_="span")),
                on_click=MetalArchiveState.surprise_me,
                background="transparent",
                color=TextColor.HEADER.value,
                border=f"1px solid {Color.PRIMARY.value}",
                border_radius="2px",
                padding_x=rx.breakpoints(initial="0.55em", md="0.9em"),
                padding_y="0.5em",
                font_size="0.85em",
                font_weight="600",
                letter_spacing="0.03em",
                cursor="pointer",
                gap="0.4em",
                white_space="nowrap",
                flex_shrink="0",
                _hover={"background": Color.PRIMARY.value, "color": "white"},
                transition="background 0.18s ease, color 0.18s ease",
                aria_label="Sorpréndeme",
            ),
            spacing=rx.breakpoints(initial="2", md="4"),
            align_items="center",
            flex_wrap="nowrap",
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
