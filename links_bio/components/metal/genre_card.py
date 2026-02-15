import reflex as rx
from links_bio.styles.styles import genre_card_style, Size
from links_bio.styles.colors import TextColor
from links_bio.states.metal_archive_state import MetalArchiveState


def genre_card(item: dict) -> rx.Component:
    return rx.box(
        rx.vstack(
            rx.text(
                item["genre"],
                font_weight="500",
                font_size=Size.DEFAULT.value,
                color=TextColor.HEADER.value,
            ),
            rx.text(
                rx.cond(
                    item["count"] == 1,
                    "1 album",
                    item["count"].to(str) + " albums",
                ),
                font_size=Size.MEDIUM.value,
                color=TextColor.BODY.value,
            ),
            spacing="1",
            align_items="center",
        ),
        style=genre_card_style,
        on_click=MetalArchiveState.navigate_to_genre(item["genre"]),
    )
