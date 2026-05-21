import reflex as rx
from links_bio.styles.styles import (
    ALBUM_DETAIL_MAX_WIDTH,
    METAL_ARCHIVE_MAX_WIDTH,
    XEROX_NOISE_URL,
    genre_card_style,
    hero_section_style,
    hero_inner_style,
    hero_cover_style,
    hero_release_type_style,
    hero_band_name_style,
    hero_album_title_style,
    hero_meta_style,
    search_input_style,
    Size,
)
from typing import Any
from links_bio.styles.colors import Color, TextColor
from links_bio.styles.fonts import Font
from links_bio.constants.images import DEFAULT_ALBUM_ARTWORK
from links_bio.states.metal_archive_state import MetalArchiveState
from links_bio.components.metal.metal_navbar import metal_navbar
from links_bio.components.metal.album_grid import album_grid
from links_bio.components.metal.album_carousel import album_carousel, CAROUSEL_CSS
from links_bio.components.footer import footer
from links_bio.components import icons
import links_bio.constants.metal_archive as MA
import links_bio.constants.url_social as URL


_HOME_CSS = """
html, body { overflow-x: hidden; }
#metal-home-hero {
    position: relative;
    width: 100vw;
    margin-left: calc(50% - 50vw);
    margin-right: calc(50% - 50vw);
    background: linear-gradient(180deg, """ + Color.SECONDARY.value + """ 0%, """ + Color.SECONDARY.value + """80 35%, """ + Color.BACKGROUND.value + """ 100%);
    border-bottom: 2px solid """ + Color.PRIMARY.value + """;
    overflow: hidden;
    isolation: isolate;
}
#metal-home-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: """ + XEROX_NOISE_URL + """;
    background-repeat: repeat;
    opacity: 0.08;
    mix-blend-mode: overlay;
    pointer-events: none;
    z-index: 0;
}
#metal-home-hero > * { position: relative; z-index: 1; }
.home-section-divider { border-top: 1px solid """ + Color.SECONDARY.value + """; }
""" + CAROUSEL_CSS


# ─── Loading Skeletons ────────────────────────────────────────────────

def _carousel_skeleton(title: str) -> rx.Component:
    return rx.box(
        rx.text(
            title,
            font_size="1.4em",
            font_weight="700",
            color=TextColor.HEADER.value,
            margin_bottom="0.8em",
        ),
        rx.el.div(
            *[
                rx.box(
                    background=Color.CONTENT.value,
                    width="170px",
                    height="170px",
                    border_radius="2px",
                    opacity="0.5",
                    class_name="animate-pulse",
                    flex_shrink="0",
                )
                for _ in range(6)
            ],
            display="flex",
            gap="1em",
            overflow="hidden",
        ),
        width="100%",
    )


def _hero_skeleton() -> rx.Component:
    return rx.el.div(
        rx.el.div(
            rx.el.div(
                rx.box(
                    background=Color.CONTENT.value,
                    width=rx.breakpoints(initial="180px", md="280px"),
                    height=rx.breakpoints(initial="180px", md="280px"),
                    opacity="0.5",
                    class_name="animate-pulse",
                ),
                rx.vstack(
                    rx.box(
                        background=Color.CONTENT.value,
                        height="14px",
                        width="120px",
                        opacity="0.5",
                        class_name="animate-pulse",
                    ),
                    rx.box(
                        background=Color.CONTENT.value,
                        height="48px",
                        width="80%",
                        opacity="0.5",
                        class_name="animate-pulse",
                    ),
                    rx.box(
                        background=Color.CONTENT.value,
                        height="20px",
                        width="60%",
                        opacity="0.5",
                        class_name="animate-pulse",
                    ),
                    spacing="3",
                    align_items="flex-start",
                    flex="1",
                ),
                style={
                    "display": "flex",
                    "flex_direction": rx.breakpoints(initial="column", md="row"),
                    "align_items": rx.breakpoints(initial="center", md="flex-end"),
                    "gap": rx.breakpoints(initial="1.2em", md="1.8em"),
                    "width": "100%",
                },
            ),
            style=hero_inner_style,
        ),
        style={
            **hero_section_style,
            "padding_top": "2.5em",
            "padding_bottom": "2em",
        },
    )


# ─── Empty State ─────────────────────────────────────────────────────

def _empty_state() -> rx.Component:
    return rx.center(
        rx.vstack(
            icons.icon_disc_3(size=48, color=Color.PRIMARY.value, opacity="0.6"),
            rx.heading(
                "El archivo se está sincronizando",
                font_size=Size.LARGE.value,
                color=TextColor.HEADER.value,
                text_align="center",
            ),
            rx.text(
                "Los álbumes se cargan desde YouTube. Puede tardar unos minutos después de reiniciar el servidor.",
                color=TextColor.BODY.value,
                text_align="center",
                max_width="500px",
            ),
            rx.link(
                rx.button(
                    icons.icon_youtube(size=20),
                    "Visitá el canal mientras tanto",
                    background="#FF0000",
                    color="white",
                    padding_x="2em",
                    padding_y="0.8em",
                    border_radius="0.5em",
                    cursor="pointer",
                    _hover={"opacity": "0.85"},
                ),
                href=URL.YOUTUBE,
                is_external=True,
            ),
            spacing="4",
            align_items="center",
        ),
        padding_y="5em",
        width="100%",
    )


# ─── Hero Featured Album ─────────────────────────────────────────────

def _featured_hero() -> rx.Component:
    album = MetalArchiveState.home_featured_album
    artwork = rx.cond(
        album["album_artwork_url"] != "",
        album["album_artwork_url"],
        DEFAULT_ALBUM_ARTWORK,
    )
    album_href = rx.cond(
        album["id"],
        "/metal-archive/album/" + album["id"].to_string(),
        "/metal-archive/browse",
    )
    return rx.el.div(
        rx.el.div(
            rx.el.div(
                rx.el.a(
                    rx.el.img(
                        src=artwork,
                        alt=album["album_title"],
                        loading="eager",
                        style=hero_cover_style,
                    ),
                    href=album_href,
                    style={"display": "block", "text_decoration": "none"},
                ),
                rx.el.div(
                    rx.el.div(
                        "DESTACADO",
                        style=hero_release_type_style,
                    ),
                    rx.el.h1(
                        album["band_name"],
                        style=hero_band_name_style,
                    ),
                    rx.el.div(
                        album["album_title"],
                        style=hero_album_title_style,
                    ),
                    rx.el.div(
                        rx.fragment(
                            rx.el.span(album["genre"]),
                            rx.el.span(" • ", style={"color": TextColor.FOOTER.value}),
                            rx.el.span(album["year"].to_string()),
                            rx.cond(
                                album["country"] != "",
                                rx.fragment(
                                    rx.el.span(" • ", style={"color": TextColor.FOOTER.value}),
                                    rx.el.span(album["country"]),
                                ),
                            ),
                        ),
                        style=hero_meta_style,
                    ),
                    rx.el.div(
                        rx.el.a(
                            "→ Ver álbum",
                            href=album_href,
                            style={
                                "background": Color.PRIMARY.value,
                                "color": TextColor.HEADER.value,
                                "padding": "0.8em 1.6em",
                                "font_size": "0.95em",
                                "font_weight": "700",
                                "letter_spacing": "0.04em",
                                "text_transform": "uppercase",
                                "text_decoration": "none",
                                "border_radius": "2px",
                                "border": "2px solid " + Color.PRIMARY.value,
                                "transition": "background 0.18s ease, color 0.18s ease",
                                "display": "inline-block",
                                "_hover": {
                                    "background": "transparent",
                                    "color": Color.PRIMARY.value,
                                },
                            },
                        ),
                        style={
                            "margin_top": "1.2em",
                            "display": "flex",
                            "justify_content": rx.breakpoints(
                                initial="center", md="flex-start"
                            ),
                        },
                    ),
                    style={
                        "display": "flex",
                        "flex_direction": "column",
                        "gap": "0.5em",
                        "justify_content": "flex-end",
                        "min_width": "0",
                        "flex": "1",
                    },
                ),
                style={
                    "display": "flex",
                    "flex_direction": rx.breakpoints(initial="column", md="row"),
                    "align_items": rx.breakpoints(initial="center", md="flex-end"),
                    "text_align": rx.breakpoints(initial="center", md="left"),
                    "gap": rx.breakpoints(initial="1.2em", md="1.8em"),
                    "width": "100%",
                },
            ),
            style={
                **hero_inner_style,
                "padding_top": rx.breakpoints(initial="2em", md="3em"),
                "padding_bottom": rx.breakpoints(initial="2em", md="3em"),
            },
        ),
        id="metal-home-hero",
    )


# ─── Search results (when typing) ────────────────────────────────────

def _search_results() -> rx.Component:
    return rx.vstack(
        rx.hstack(
            rx.heading(
                "Resultados de búsqueda",
                font_size=Size.LARGE.value,
                color=TextColor.HEADER.value,
            ),
            rx.spacer(),
            rx.text(
                MetalArchiveState.live_search_results.length().to_string()
                + " resultados",
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


# ─── Browse-by sections (kept, less prominent) ───────────────────────

def _country_card(item: dict) -> rx.Component:
    return rx.box(
        rx.vstack(
            rx.text(item["flag"], font_size="1.5em", line_height="1"),
            rx.text(
                item["country"],
                font_weight="500",
                font_size=Size.DEFAULT.value,
                color=TextColor.HEADER.value,
            ),
            rx.text(
                rx.cond(
                    item["count"] == 1,
                    "1 álbum",
                    item["count"].to(str) + " álbumes",
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
                    "1 álbum",
                    item["count"].to(str) + " álbumes",
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


def _section_title(title: str, href: str = "") -> rx.Component:
    return rx.el.div(
        rx.el.h3(
            title,
            style={
                "font_family": Font.DEFAULT.value,
                "font_size": rx.breakpoints(initial="1.1em", md="1.3em"),
                "font_weight": "700",
                "color": TextColor.HEADER.value,
                "letter_spacing": "-0.01em",
                "margin": "0",
            },
        ),
        rx.cond(
            href != "",
            rx.el.a(
                "Ver todo →",
                href=href,
                style={
                    "color": Color.PRIMARY.value,
                    "font_size": "0.82em",
                    "text_decoration": "none",
                    "font_weight": "600",
                },
            ),
        ),
        style={
            "display": "flex",
            "justify_content": "space-between",
            "align_items": "baseline",
            "width": "100%",
            "margin_bottom": "0.8em",
        },
    )


def _browse_sections() -> rx.Component:
    return rx.vstack(
        rx.cond(
            MetalArchiveState.top_country_counts.length() > 0,
            rx.vstack(
                _section_title("Explorá por país", MA.METAL_ARCHIVE_BROWSE),
                rx.grid(
                    rx.foreach(
                        MetalArchiveState.top_country_counts,
                        _country_card,
                    ),
                    columns=rx.breakpoints(initial="2", sm="3", md="5"),
                    spacing="3",
                    width="100%",
                ),
                width="100%",
                spacing="2",
            ),
        ),
        rx.cond(
            MetalArchiveState.top_year_counts.length() > 0,
            rx.vstack(
                _section_title("Explorá por año", MA.METAL_ARCHIVE_BROWSE),
                rx.grid(
                    rx.foreach(
                        MetalArchiveState.top_year_counts,
                        _year_card,
                    ),
                    columns=rx.breakpoints(initial="3", sm="4", md="6"),
                    spacing="3",
                    width="100%",
                ),
                width="100%",
                spacing="2",
            ),
        ),
        width="100%",
        spacing="5",
    )


# ─── Home content (when not searching) ────────────────────────────────

def _home_content() -> rx.Component:
    return rx.vstack(
        rx.cond(
            MetalArchiveState.home_this_week_albums.length() > 0,
            album_carousel(
                "Esta semana en el archivo",
                MetalArchiveState.home_this_week_albums,
                see_all_href=MA.METAL_ARCHIVE_BROWSE,
            ),
            _carousel_skeleton("Esta semana en el archivo"),
        ),
        rx.cond(
            MetalArchiveState.home_editor_picks.length() > 0,
            album_carousel(
                "Editor's picks",
                MetalArchiveState.home_editor_picks,
                see_all_href=MA.METAL_ARCHIVE_BROWSE,
            ),
        ),
        rx.cond(
            MetalArchiveState.home_deep_cuts.length() > 0,
            album_carousel(
                "Joyas escondidas",
                MetalArchiveState.home_deep_cuts,
                see_all_href=MA.METAL_ARCHIVE_BROWSE,
            ),
        ),
        rx.foreach(
            MetalArchiveState.home_genre_showcases,
            lambda showcase: album_carousel(
                showcase["genre"].to(str),
                showcase["albums"].to(list[dict[str, Any]]),
                see_all_href=showcase["href"].to(str),
            ),
        ),
        rx.cond(
            MetalArchiveState.home_country_showcase_albums.length() > 0,
            album_carousel(
                MetalArchiveState.home_country_showcase_title,
                MetalArchiveState.home_country_showcase_albums,
                see_all_href=MetalArchiveState.home_country_showcase_href,
            ),
        ),
        rx.box(
            _browse_sections(),
            width="100%",
            padding_top="1.5em",
            border_top="1px solid " + Color.SECONDARY.value,
            margin_top="1em",
        ),
        rx.center(
            rx.link(
                rx.button(
                    icons.icon_youtube(size=20),
                    "Suscribite al canal",
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
        spacing="6",
    )


# ─── Page ─────────────────────────────────────────────────────────────

def landing_page() -> rx.Component:
    return rx.box(
        rx.el.style(_HOME_CSS),
        metal_navbar(),
        rx.box(
            rx.center(
                rx.box(
                    rx.debounce_input(
                        rx.input(
                            placeholder="Buscar bandas, álbumes, géneros...",
                            value=MetalArchiveState.live_search_query,
                            on_change=MetalArchiveState.on_live_search,
                            style=search_input_style,
                            size="3",
                            width="100%",
                        ),
                        debounce_timeout=300,
                    ),
                    max_width="600px",
                    width="100%",
                ),
            ),
            padding_x=Size.BIG.value,
            padding_y=Size.DEFAULT.value,
            background=Color.CONTENT.value,
            border_bottom="1px solid " + Color.SECONDARY.value,
            width="100%",
        ),
        rx.cond(
            MetalArchiveState.live_search_open,
            rx.center(
                rx.box(
                    _search_results(),
                    max_width=METAL_ARCHIVE_MAX_WIDTH,
                    width="100%",
                    padding_x=Size.BIG.value,
                    padding_y=Size.BIG.value,
                ),
            ),
            rx.cond(
                MetalArchiveState.stats_loaded
                & (MetalArchiveState.total_albums == 0),
                _empty_state(),
                rx.box(
                    rx.cond(
                        MetalArchiveState.home_featured_album.contains("id"),
                        _featured_hero(),
                        _hero_skeleton(),
                    ),
                    rx.center(
                        rx.box(
                            _home_content(),
                            max_width=ALBUM_DETAIL_MAX_WIDTH,
                            width="100%",
                            padding_x=rx.breakpoints(
                                initial="1.2em", md="2.5em", lg="3em"
                            ),
                            padding_top="2em",
                            padding_bottom="2em",
                        ),
                    ),
                    width="100%",
                ),
            ),
        ),
        footer(),
    )
