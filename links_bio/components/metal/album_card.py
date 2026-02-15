import reflex as rx
from links_bio.styles.styles import album_card_style, Size
from links_bio.styles.colors import Color, TextColor
from links_bio.constants.images import DEFAULT_ALBUM_ARTWORK


def album_card(album: dict) -> rx.Component:
    artwork = rx.cond(
        album["album_artwork_url"] != "",
        album["album_artwork_url"],
        DEFAULT_ALBUM_ARTWORK,
    )
    return rx.link(
        rx.box(
            rx.image(
                src=artwork,
                width="100%",
                aspect_ratio="1",
                object_fit="cover",
                loading="lazy",
                alt=album["album_title"],
            ),
            rx.vstack(
                rx.text(
                    album["band_name"],
                    font_weight="500",
                    font_size=Size.DEFAULT.value,
                    color=TextColor.HEADER.value,
                    no_of_lines=1,
                ),
                rx.text(
                    album["album_title"],
                    font_size=Size.MEDIUM.value,
                    color=TextColor.BODY.value,
                    no_of_lines=1,
                ),
                rx.hstack(
                    rx.text(
                        album["genre"],
                        font_size="0.7em",
                        color=Color.PRIMARY.value,
                    ),
                    rx.spacer(),
                    rx.text(
                        album["year"],
                        font_size="0.7em",
                        color=TextColor.FOOTER.value,
                    ),
                    width="100%",
                ),
                padding="0.8em",
                spacing="1",
                width="100%",
            ),
            style=album_card_style,
        ),
        href=rx.cond(
            album["id"],
            f"/metal-archive/album/{album['id']}",
            "#",
        ),
    )
