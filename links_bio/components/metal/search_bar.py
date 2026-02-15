import reflex as rx
from links_bio.styles.styles import search_input_style, primary_button_style
from links_bio.states.metal_archive_state import MetalArchiveState


def search_bar() -> rx.Component:
    return rx.hstack(
        rx.input(
            placeholder="Buscar bandas, albums, generos...",
            value=MetalArchiveState.search_query,
            on_change=MetalArchiveState.set_search_query,
            style=search_input_style,
            size="3",
        ),
        rx.button(
            "Buscar",
            on_click=MetalArchiveState.search_albums,
            style=primary_button_style,
        ),
        width="100%",
        max_width="600px",
        spacing="2",
    )
