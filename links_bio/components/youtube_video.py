import reflex as rx

import links_bio.styles.styles as styles
from links_bio.styles.styles import Size
from links_bio.styles.colors import Color, TextColor


def youtube_video_card(title: str, thumbnail: str, url: str) -> rx.Component:
    return rx.link(
        rx.hstack(
            rx.image(
                src=thumbnail,
                width="160px",
                height="90px",
                border_radius=Size.SMALL.value,
                alt=title,
                loading="lazy",
            ),
            rx.vstack(
                rx.text(title, style=styles.button_title_style),
                rx.text(
                    "Ver en YouTube",
                    color=TextColor.BODY.value,
                    font_size=Size.MEDIUM.value,
                ),
                align_items="start",
                spacing=Size.SMALL_SPACING.value,
            ),
            align_items="center",
            bg=Color.CONTENT.value,
            padding=Size.SMALL.value,
            border_radius=Size.SMALL.value,
            width="100%",
        ),
        href=url,
        is_external=True,
        aria_label=title,
        width="100%",
    )
