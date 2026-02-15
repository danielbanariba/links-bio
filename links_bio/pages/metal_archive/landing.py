import reflex as rx
from links_bio.styles.styles import (
    METAL_ARCHIVE_MAX_WIDTH,
    metal_hero_style,
    stat_box_style,
    genre_card_style,
    search_input_style,
    Size,
)
from links_bio.styles.colors import Color, TextColor
from links_bio.states.metal_archive_state import MetalArchiveState
from links_bio.components.metal.metal_navbar import metal_navbar
from links_bio.components.metal.album_grid import album_grid
from links_bio.components.footer import footer
import links_bio.constants.metal_archive as MA
import links_bio.constants.url_social as URL


# ─── Stats Banner ─────────────────────────────────────────────────────

def _stat_box(value: rx.Var, label: str) -> rx.Component:
    return rx.box(
        rx.vstack(
            rx.text(
                value,
                font_size="1.8em",
                font_weight="600",
                color=Color.PRIMARY.value,
            ),
            rx.text(
                label,
                font_size=Size.MEDIUM.value,
                color=TextColor.BODY.value,
            ),
            spacing="1",
            align_items="center",
        ),
        style=stat_box_style,
    )


def _stats_banner() -> rx.Component:
    return rx.flex(
        _stat_box(MetalArchiveState.total_albums.to(str), "Albums"),
        _stat_box(MetalArchiveState.total_genres.to(str), "Generos"),
        _stat_box(MetalArchiveState.total_countries.to(str), "Paises"),
        gap="1em",
        width="100%",
        justify_content="center",
        flex_wrap="wrap",
    )


# ─── Section Header with Toggle ──────────────────────────────────────

def _section_header(title: str, is_expanded: rx.Var, on_toggle) -> rx.Component:
    return rx.hstack(
        rx.heading(
            title,
            font_size=Size.LARGE.value,
            color=TextColor.HEADER.value,
        ),
        rx.spacer(),
        rx.text(
            rx.cond(is_expanded, "\u2190 Ver menos", "Ver todos \u2192"),
            font_size=Size.MEDIUM.value,
            color=Color.PRIMARY.value,
            cursor="pointer",
            _hover={"text_decoration": "underline"},
            on_click=on_toggle,
        ),
        width="100%",
        align_items="baseline",
    )


# ─── Cards (on_click navigation, no href with /) ─────────────────────

def _genre_card(item: dict) -> rx.Component:
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


def _country_card(item: dict) -> rx.Component:
    return rx.box(
        rx.vstack(
            rx.text(
                item["flag"],
                font_size="1.5em",
                line_height="1",
            ),
            rx.text(
                item["country"],
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
        on_click=MetalArchiveState.navigate_to_country(item["country"]),
    )


def _year_card(item: dict) -> rx.Component:
    return rx.box(
        rx.vstack(
            rx.text(
                item["year"],
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
        on_click=MetalArchiveState.navigate_to_year(item["year"]),
    )


# ─── Landing content (shown when NOT searching) ──────────────────────

def _landing_content() -> rx.Component:
    """Stats, genres, countries, years, newsletter — the default view."""
    return rx.vstack(
        # Stats banner
        _stats_banner(),
        # Explorar por genero
        rx.cond(
            MetalArchiveState.top_genre_counts.length() > 0,
            rx.vstack(
                _section_header(
                    "Explorar por Genero",
                    MetalArchiveState.show_all_genres,
                    MetalArchiveState.toggle_all_genres,
                ),
                rx.grid(
                    rx.foreach(
                        MetalArchiveState.visible_genre_counts,
                        _genre_card,
                    ),
                    columns=rx.breakpoints(
                        initial="2",
                        sm="3",
                        md="4",
                        lg="5",
                    ),
                    spacing="3",
                    width="100%",
                ),
                width="100%",
                spacing="3",
            ),
        ),
        # Explorar por pais
        rx.cond(
            MetalArchiveState.top_country_counts.length() > 0,
            rx.vstack(
                _section_header(
                    "Explorar por Pais",
                    MetalArchiveState.show_all_countries,
                    MetalArchiveState.toggle_all_countries,
                ),
                rx.grid(
                    rx.foreach(
                        MetalArchiveState.visible_country_counts,
                        _country_card,
                    ),
                    columns=rx.breakpoints(
                        initial="2",
                        sm="3",
                        md="4",
                        lg="5",
                    ),
                    spacing="3",
                    width="100%",
                ),
                width="100%",
                spacing="3",
            ),
        ),
        # Explorar por ano
        rx.cond(
            MetalArchiveState.top_year_counts.length() > 0,
            rx.vstack(
                _section_header(
                    "Explorar por Ano",
                    MetalArchiveState.show_all_years,
                    MetalArchiveState.toggle_all_years,
                ),
                rx.grid(
                    rx.foreach(
                        MetalArchiveState.visible_year_counts,
                        _year_card,
                    ),
                    columns=rx.breakpoints(
                        initial="3",
                        sm="4",
                        md="5",
                        lg="6",
                    ),
                    spacing="3",
                    width="100%",
                ),
                width="100%",
                spacing="3",
            ),
        ),
        # Browse link
        rx.center(
            rx.link(
                rx.button(
                    "Explorar todo el archivo",
                    background=Color.PRIMARY.value,
                    color=TextColor.HEADER.value,
                    padding_x="2em",
                    padding_y="0.8em",
                    border_radius="0.5em",
                    font_size="1.1em",
                    cursor="pointer",
                    _hover={"opacity": "0.85"},
                ),
                href=MA.METAL_ARCHIVE_BROWSE,
            ),
            width="100%",
            padding_y="1em",
        ),
        # Subscribe to YouTube
        rx.center(
            rx.link(
                rx.button(
                    rx.icon("youtube", size=20),
                    "Suscribete al canal",
                    background="#FF0000",
                    color="white",
                    padding_x="2em",
                    padding_y="0.8em",
                    border_radius="0.5em",
                    font_size="1.1em",
                    cursor="pointer",
                    _hover={"opacity": "0.85"},
                ),
                href=URL.YOUTUBE + "?sub_confirmation=1",
                is_external=True,
            ),
            width="100%",
            padding_y="2em",
        ),
        width="100%",
        spacing="5",
    )


# ─── Search results (shown when typing) ──────────────────────────────

def _search_results() -> rx.Component:
    """Album grid replacing all landing content while searching."""
    return rx.vstack(
        rx.hstack(
            rx.heading(
                "Resultados de busqueda",
                font_size=Size.LARGE.value,
                color=TextColor.HEADER.value,
            ),
            rx.spacer(),
            rx.text(
                MetalArchiveState.live_search_results.length().to(str) + " resultados",
                font_size=Size.MEDIUM.value,
                color=TextColor.BODY.value,
            ),
            width="100%",
            align_items="baseline",
        ),
        album_grid(MetalArchiveState.live_search_results, show_load_more=False),
        width="100%",
        spacing="4",
    )


# ─── Page ─────────────────────────────────────────────────────────────

def landing_page() -> rx.Component:
    return rx.box(
        metal_navbar(),
        # Hero section (always visible)
        rx.box(
            rx.center(
                rx.vstack(
                    rx.heading(
                        "Metal Archive",
                        font_size="2.5em",
                        color=TextColor.HEADER.value,
                    ),
                    rx.text(
                        "Archivo de metal underground hondureno. Videos musicales, bandas y mas.",
                        color=TextColor.BODY.value,
                        font_size="1.1em",
                        text_align="center",
                    ),
                    # Search input (always visible)
                    rx.debounce_input(
                        rx.input(
                            placeholder="Buscar bandas, albums, generos...",
                            value=MetalArchiveState.live_search_query,
                            on_change=MetalArchiveState.on_live_search,
                            style=search_input_style,
                            size="3",
                            width="100%",
                            max_width="600px",
                        ),
                        debounce_timeout=300,
                    ),
                    spacing="4",
                    align_items="center",
                    max_width=METAL_ARCHIVE_MAX_WIDTH,
                    width="100%",
                ),
            ),
            style=metal_hero_style,
        ),
        # Content area: switch between landing and search results
        rx.center(
            rx.box(
                rx.cond(
                    MetalArchiveState.live_search_open,
                    # Searching: show album grid results
                    _search_results(),
                    # Not searching: show normal landing content
                    _landing_content(),
                ),
                max_width=METAL_ARCHIVE_MAX_WIDTH,
                width="100%",
                padding_x=Size.BIG.value,
                padding_y=Size.BIG.value,
            ),
        ),
        footer(),
    )
