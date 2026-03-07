import reflex as rx
from links_bio.styles.colors import Color, TextColor
from links_bio.states.metal_archive_state import MetalArchiveState


def filter_bar() -> rx.Component:
    return rx.hstack(
        rx.button(
            rx.icon("dice-5", size=18),
            "Random",
            on_click=MetalArchiveState.random_filters,
            variant="outline",
            color=TextColor.HEADER.value,
            border_color=Color.PRIMARY.value,
            _hover={"background": Color.PRIMARY.value, "color": "white"},
            cursor="pointer",
        ),
        rx.select(
            MetalArchiveState.genre_options,
            value=rx.cond(
                MetalArchiveState.filter_genre != "",
                MetalArchiveState.filter_genre,
                "All genres",
            ),
            on_change=MetalArchiveState.set_filter_genre_option,
            color=TextColor.HEADER.value,
        ),
        rx.select(
            MetalArchiveState.country_options,
            value=rx.cond(
                MetalArchiveState.filter_country != "",
                MetalArchiveState.filter_country,
                "All countries",
            ),
            on_change=MetalArchiveState.set_filter_country_option,
            color=TextColor.HEADER.value,
        ),
        rx.select(
            MetalArchiveState.year_options,
            value=rx.cond(
                MetalArchiveState.filter_year != "",
                MetalArchiveState.filter_year,
                "All years",
            ),
            on_change=MetalArchiveState.set_filter_year_option,
            color=TextColor.HEADER.value,
        ),
        rx.select(
            MetalArchiveState.release_type_options,
            value=rx.cond(
                MetalArchiveState.filter_release_type != "",
                MetalArchiveState.filter_release_type,
                "All types",
            ),
            on_change=MetalArchiveState.set_filter_release_type_option,
            color=TextColor.HEADER.value,
        ),
        rx.select(
            ["Newest", "Oldest", "A - Z", "Z - A", "Most viewed"],
            value=rx.match(
                MetalArchiveState.sort_order,
                ("newest", "Newest"),
                ("oldest", "Oldest"),
                ("az", "A - Z"),
                ("za", "Z - A"),
                ("views", "Most viewed"),
                "Newest",
            ),
            on_change=MetalArchiveState.set_sort_option,
            color=TextColor.HEADER.value,
        ),
        width="100%",
        flex_wrap="wrap",
        spacing="3",
    )
