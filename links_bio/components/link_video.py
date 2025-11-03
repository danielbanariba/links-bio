import reflex as rx
import links_bio.styles.styles as styles
from links_bio.styles.styles import Size, miniatura_video_style, Color

def link_video(title: str, body: str, logo_banda: str, size: str, image: str, url: str) -> rx.Component:
    return rx.hstack(
        rx.hstack(
            rx.box(
                rx.vstack(# se pone los logis de la banda
                    rx.image(
                        src=logo_banda,
                        width=size,
                        height=size,
                        margin=Size.VERY_SMALL.value,
                        alt=title,
                        align_self="center",
                        loading="lazy",
                    ),
                    rx.vstack(
                        rx.text(title, style=styles.title_style_music),
                        rx.text(body, style=styles.body_style_music),
                        align_items="center",
                        spacing=Size.SMALL_SPACING.value,
                        padding_y=Size.SMALL.value,
                        padding_right=Size.SMALL.value
                    ),
                    rx.link(
                        rx.image(
                            src=image,
                            alt=title,
                            style=miniatura_video_style,
                            loading="lazy"
                        ),
                        href=url,
                        is_external=True,
                        width="100%"
                    ),
                    align_items="center",
                    bg=Color.CONTENT.value,
                    padding=Size.DEFAULT.value,
                    border_radius=Size.SMALL.value,
                    width="100%"
                ),
            width="100%"
            ),
        ),
    )