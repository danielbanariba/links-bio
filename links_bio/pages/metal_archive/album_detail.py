import reflex as rx
from links_bio.styles.styles import (
    METAL_ARCHIVE_MAX_WIDTH,
    track_row_style,
    primary_button_style,
    Size,
)
from links_bio.styles.colors import Color, TextColor
from links_bio.constants.images import DEFAULT_ALBUM_ARTWORK
from links_bio.states.metal_archive_state import MetalArchiveState
from links_bio.components.metal.metal_navbar import metal_navbar
from links_bio.components.metal.youtube_embed import youtube_embed
from links_bio.components.metal.streaming_links import streaming_links
from links_bio.components.metal.album_card import album_card
from links_bio.components.footer import footer


def _track_row(track: dict) -> rx.Component:
    return rx.hstack(
        rx.text(
            track["track_number"],
            color=TextColor.FOOTER.value,
            font_size=Size.MEDIUM.value,
            min_width="2em",
        ),
        rx.text(
            track["track_name"],
            color=TextColor.HEADER.value,
            font_size=Size.DEFAULT.value,
        ),
        rx.spacer(),
        rx.text(
            track["timestamp"],
            color=TextColor.FOOTER.value,
            font_size=Size.MEDIUM.value,
        ),
        style=track_row_style,
    )


def album_detail_page() -> rx.Component:
    album = MetalArchiveState.current_album
    artwork = rx.cond(
        album["album_artwork_url"] != "",
        album["album_artwork_url"],
        DEFAULT_ALBUM_ARTWORK,
    )

    return rx.box(
        metal_navbar(),
        rx.cond(
            MetalArchiveState.current_album.length() > 0,
            rx.center(
                rx.vstack(
                    # Album header
                    rx.box(
                        rx.hstack(
                            rx.image(
                                src=artwork,
                                width="300px",
                                height="300px",
                                object_fit="cover",
                                border_radius="0.8em",
                                loading="lazy",
                                alt=album["album_title"],
                            ),
                            rx.vstack(
                                rx.text(
                                    album["band_name"],
                                    font_size="1.8em",
                                    font_weight="500",
                                    color=TextColor.HEADER.value,
                                ),
                                rx.text(
                                    album["album_title"],
                                    font_size="1.3em",
                                    color=TextColor.BODY.value,
                                ),
                                rx.hstack(
                                    rx.badge(
                                        album["genre"],
                                        color_scheme="blue",
                                        size="2",
                                        cursor="pointer",
                                        on_click=MetalArchiveState.navigate_to_genre(album["genre"]),
                                    ),
                                    rx.badge(
                                        album["country"],
                                        color_scheme="gray",
                                        size="2",
                                        cursor="pointer",
                                        on_click=MetalArchiveState.navigate_to_country(album["country"]),
                                    ),
                                    rx.badge(
                                        album["year"],
                                        color_scheme="gray",
                                        size="2",
                                    ),
                                    spacing="2",
                                    flex_wrap="wrap",
                                ),
                                rx.cond(
                                    album["description"] != "",
                                    rx.text(
                                        album["description"],
                                        color=TextColor.BODY.value,
                                        font_size=Size.MEDIUM.value,
                                    ),
                                ),
                                # Streaming / social links
                                streaming_links(album),
                                spacing="3",
                                justify="start",
                            ),
                            spacing="5",
                            width="100%",
                            flex_wrap="wrap",
                            align_items="start",
                        ),
                        width="100%",
                    ),
                    # YouTube embed
                    youtube_embed(album["youtube_video_id"]),
                    # Tracklist
                    rx.cond(
                        MetalArchiveState.current_tracks.length() > 0,
                        rx.vstack(
                            rx.heading(
                                "Tracklist",
                                font_size=Size.LARGE.value,
                                color=TextColor.HEADER.value,
                            ),
                            rx.vstack(
                                rx.foreach(
                                    MetalArchiveState.current_tracks,
                                    _track_row,
                                ),
                                width="100%",
                                spacing="0",
                            ),
                            width="100%",
                            spacing="3",
                        ),
                    ),
                    # Similar bands
                    rx.cond(
                        MetalArchiveState.current_similar_bands.length() > 0,
                        rx.vstack(
                            rx.heading(
                                "Bandas similares",
                                font_size=Size.LARGE.value,
                                color=TextColor.HEADER.value,
                            ),
                            rx.hstack(
                                rx.foreach(
                                    MetalArchiveState.current_similar_bands,
                                    lambda name: rx.badge(
                                        name,
                                        color_scheme="blue",
                                        variant="outline",
                                        size="2",
                                    ),
                                ),
                                flex_wrap="wrap",
                                spacing="2",
                            ),
                            width="100%",
                            spacing="2",
                        ),
                    ),
                    # Similar albums
                    rx.cond(
                        MetalArchiveState.similar_albums.length() > 0,
                        rx.vstack(
                            rx.heading(
                                "Albums similares",
                                font_size=Size.LARGE.value,
                                color=TextColor.HEADER.value,
                            ),
                            rx.grid(
                                rx.foreach(
                                    MetalArchiveState.similar_albums,
                                    album_card,
                                ),
                                columns=rx.breakpoints(
                                    initial="1",
                                    sm="2",
                                    md="3",
                                    lg="4",
                                ),
                                spacing="4",
                                width="100%",
                            ),
                            width="100%",
                            spacing="3",
                        ),
                    ),
                    max_width=METAL_ARCHIVE_MAX_WIDTH,
                    width="100%",
                    padding_x=Size.BIG.value,
                    padding_y=Size.BIG.value,
                    spacing="5",
                ),
            ),
            # Album not found
            rx.center(
                rx.text(
                    "Album no encontrado.",
                    color=TextColor.BODY.value,
                    font_size="1.2em",
                ),
                padding_y="5em",
            ),
        ),
        footer(),
    )
