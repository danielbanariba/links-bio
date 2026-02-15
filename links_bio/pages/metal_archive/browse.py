import reflex as rx
from links_bio.styles.styles import METAL_ARCHIVE_MAX_WIDTH, Size
from links_bio.styles.colors import TextColor
from links_bio.states.metal_archive_state import MetalArchiveState
from links_bio.components.metal.metal_navbar import metal_navbar
from links_bio.components.metal.search_bar import search_bar
from links_bio.components.metal.filter_bar import filter_bar
from links_bio.components.metal.album_grid import album_grid
from links_bio.components.footer import footer


def browse_page() -> rx.Component:
    return rx.box(
        metal_navbar(),
        rx.center(
            rx.vstack(
                rx.heading(
                    "Explorar Albums",
                    font_size="2em",
                    color=TextColor.HEADER.value,
                ),
                search_bar(),
                filter_bar(),
                album_grid(MetalArchiveState.albums),
                max_width=METAL_ARCHIVE_MAX_WIDTH,
                width="100%",
                padding_x=Size.BIG.value,
                padding_y=Size.BIG.value,
                spacing="4",
            ),
        ),
        footer(),
    )
