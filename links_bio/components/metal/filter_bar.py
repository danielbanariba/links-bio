import reflex as rx
from links_bio.styles.colors import TextColor
from links_bio.states.metal_archive_state import MetalArchiveState


def filter_bar() -> rx.Component:
    return rx.hstack(
        rx.select(
            MetalArchiveState.genre_options,
            value=rx.cond(
                MetalArchiveState.filter_genre != "",
                MetalArchiveState.filter_genre,
                "Todos los generos",
            ),
            on_change=MetalArchiveState.set_filter_genre_option,
            color=TextColor.HEADER.value,
        ),
        rx.select(
            MetalArchiveState.country_options,
            value=rx.cond(
                MetalArchiveState.filter_country != "",
                MetalArchiveState.filter_country,
                "Todos los paises",
            ),
            on_change=MetalArchiveState.set_filter_country_option,
            color=TextColor.HEADER.value,
        ),
        rx.select(
            MetalArchiveState.year_options,
            value=rx.cond(
                MetalArchiveState.filter_year != "",
                MetalArchiveState.filter_year,
                "Todos los anos",
            ),
            on_change=MetalArchiveState.set_filter_year_option,
            color=TextColor.HEADER.value,
        ),
        rx.select(
            MetalArchiveState.release_type_options,
            value=rx.cond(
                MetalArchiveState.filter_release_type != "",
                MetalArchiveState.filter_release_type,
                "Todos los tipos",
            ),
            on_change=MetalArchiveState.set_filter_release_type_option,
            color=TextColor.HEADER.value,
        ),
        rx.select(
            ["Mas recientes", "Mas antiguos", "A - Z", "Z - A", "Mas vistos"],
            value=rx.match(
                MetalArchiveState.sort_order,
                ("newest", "Mas recientes"),
                ("oldest", "Mas antiguos"),
                ("az", "A - Z"),
                ("za", "Z - A"),
                ("views", "Mas vistos"),
                "Mas recientes",
            ),
            on_change=MetalArchiveState.set_sort_option,
            color=TextColor.HEADER.value,
        ),
        width="100%",
        flex_wrap="wrap",
        spacing="3",
    )
