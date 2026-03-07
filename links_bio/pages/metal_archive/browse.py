import reflex as rx
from links_bio.styles.styles import METAL_ARCHIVE_MAX_WIDTH, Size
from links_bio.styles.colors import Color, TextColor
from links_bio.states.metal_archive_state import MetalArchiveState
from links_bio.components.metal.metal_navbar import metal_navbar
from links_bio.components.metal.search_bar import search_bar
from links_bio.components.metal.filter_bar import filter_bar
from links_bio.components.metal.album_grid import album_grid
from links_bio.components.footer import footer


def _browse_skeleton() -> rx.Component:
    return rx.vstack(
        rx.grid(
            *[rx.box(
                background=Color.CONTENT.value,
                border_radius="0.8em",
                height="280px",
                width="100%",
                opacity="0.5",
                class_name="animate-pulse",
            ) for _ in range(8)],
            columns=rx.breakpoints(initial="1", sm="2", md="3", lg="4"),
            spacing="4",
            width="100%",
        ),
        width="100%",
    )


def browse_page() -> rx.Component:
    return rx.box(
        metal_navbar(),
        rx.center(
            rx.vstack(
                rx.heading(
                    "Browse Albums",
                    font_size="2em",
                    color=TextColor.HEADER.value,
                ),
                search_bar(),
                filter_bar(),
                rx.cond(
                    MetalArchiveState.is_loading,
                    _browse_skeleton(),
                    album_grid(MetalArchiveState.albums),
                ),
                max_width=METAL_ARCHIVE_MAX_WIDTH,
                width="100%",
                padding_x=Size.BIG.value,
                padding_y=Size.BIG.value,
                spacing="4",
            ),
        ),
        footer(),
    )
