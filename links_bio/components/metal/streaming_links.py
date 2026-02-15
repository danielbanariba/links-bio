import reflex as rx
from links_bio.styles.styles import streaming_link_style


def streaming_links(album: rx.Var[dict]) -> rx.Component:
    return rx.hstack(
        rx.cond(
            album["youtube_url"] != "",
            rx.link(
                rx.button("YouTube", style=streaming_link_style),
                href=album["youtube_url"],
                is_external=True,
            ),
        ),
        rx.cond(
            album["spotify_url"] != "",
            rx.link(
                rx.button("Spotify", style=streaming_link_style),
                href=album["spotify_url"],
                is_external=True,
            ),
        ),
        rx.cond(
            album["bandcamp_url"] != "",
            rx.link(
                rx.button("Bandcamp", style=streaming_link_style),
                href=album["bandcamp_url"],
                is_external=True,
            ),
        ),
        rx.cond(
            album["apple_music_url"] != "",
            rx.link(
                rx.button("Apple Music", style=streaming_link_style),
                href=album["apple_music_url"],
                is_external=True,
            ),
        ),
        rx.cond(
            album["metal_archives_url"] != "",
            rx.link(
                rx.button("Metal Archives", style=streaming_link_style),
                href=album["metal_archives_url"],
                is_external=True,
            ),
        ),
        rx.cond(
            album["facebook_url"] != "",
            rx.link(
                rx.button("Facebook", style=streaming_link_style),
                href=album["facebook_url"],
                is_external=True,
            ),
        ),
        rx.cond(
            album["instagram_url"] != "",
            rx.link(
                rx.button("Instagram", style=streaming_link_style),
                href=album["instagram_url"],
                is_external=True,
            ),
        ),
        flex_wrap="wrap",
        spacing="2",
    )
