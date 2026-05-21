import reflex as rx
from links_bio.styles.styles import now_playing_bar_style
from links_bio.styles.colors import Color, TextColor
from links_bio.constants.images import DEFAULT_ALBUM_ARTWORK


def now_playing_bar(album: rx.Var) -> rx.Component:
    artwork = rx.cond(
        album["album_artwork_url"] != "",
        album["album_artwork_url"],
        DEFAULT_ALBUM_ARTWORK,
    )

    youtube_link = rx.cond(
        album["youtube_url"] != "",
        album["youtube_url"],
        "#",
    )

    left_block = rx.el.div(
        rx.el.img(
            src=artwork,
            id="now-playing-cover",
            class_name="np-cover",
            alt="",
            style={
                "width": "48px",
                "height": "48px",
                "border_radius": "2px",
                "object_fit": "cover",
                "flex_shrink": "0",
                "border": f"1px solid {Color.SECONDARY.value}",
            },
        ),
        rx.el.div(
            rx.el.span(
                "Seleccioná una canción",
                id="now-playing-name",
                custom_attrs={"data-now-name": "1"},
                style={
                    "color": TextColor.HEADER.value,
                    "font_size": "0.9em",
                    "font_weight": "500",
                    "display": "block",
                    "white_space": "nowrap",
                    "overflow": "hidden",
                    "text_overflow": "ellipsis",
                    "max_width": "220px",
                },
            ),
            rx.el.span(
                album["band_name"],
                id="now-playing-artist",
                style={
                    "color": TextColor.FOOTER.value,
                    "font_size": "0.75em",
                    "display": "block",
                    "white_space": "nowrap",
                    "overflow": "hidden",
                    "text_overflow": "ellipsis",
                    "max_width": "220px",
                },
            ),
            style={
                "display": "flex",
                "flex_direction": "column",
                "justify_content": "center",
                "min_width": "0",
            },
        ),
        style={
            "display": "flex",
            "align_items": "center",
            "gap": "0.8em",
            "flex": "1 1 0",
            "min_width": "0",
        },
    )

    center_block = rx.el.div(
        rx.el.div(
            rx.el.button(
                "⏮",
                custom_attrs={
                    "aria-label": "Anterior",
                    "data-np-prev": "1",
                },
                style={
                    "background": "transparent",
                    "color": TextColor.BODY.value,
                    "border": "none",
                    "cursor": "pointer",
                    "font_size": "1.2em",
                    "padding": "0.3em 0.5em",
                },
            ),
            rx.el.button(
                # Glyph + spinner are siblings; JS toggles which is visible so the
                # buffering state (IFrame state 3) shows a spinner, not a frozen icon.
                rx.el.span(
                    "▶",
                    id="now-playing-toggle-glyph",
                ),
                rx.el.span(
                    id="now-playing-toggle-spinner",
                    class_name="mp-spinner mp-spinner-sm",
                    style={"display": "none"},
                ),
                id="now-playing-toggle",
                custom_attrs={
                    "aria-label": "Reproducir / pausar",
                    "data-np-toggle": "1",
                },
                style={
                    "background": Color.PRIMARY.value,
                    "color": TextColor.HEADER.value,
                    "border": "none",
                    "cursor": "pointer",
                    "font_size": "0.9em",
                    "width": "36px",
                    "height": "36px",
                    "border_radius": "2px",
                    "display": "flex",
                    "align_items": "center",
                    "justify_content": "center",
                    "padding": "0",
                    "transition": "transform 0.15s ease",
                    "_hover": {"transform": "scale(1.08)"},
                },
            ),
            rx.el.button(
                "⏭",
                custom_attrs={
                    "aria-label": "Siguiente",
                    "data-np-next": "1",
                },
                style={
                    "background": "transparent",
                    "color": TextColor.BODY.value,
                    "border": "none",
                    "cursor": "pointer",
                    "font_size": "1.2em",
                    "padding": "0.3em 0.5em",
                },
            ),
            style={
                "display": "flex",
                "align_items": "center",
                "gap": "0.4em",
            },
        ),
        rx.el.div(
            rx.el.div(
                id="now-playing-progress-fill",
                style={
                    "height": "100%",
                    "width": "0%",
                    "background": TextColor.HEADER.value,
                    "border_radius": "999px",
                    "transition": "width 0.4s linear",
                },
            ),
            id="now-playing-progress",
            style={
                "width": "100%",
                "max_width": "360px",
                "height": "4px",
                "background": Color.SECONDARY.value,
                "border_radius": "999px",
                "overflow": "hidden",
                "margin_top": "0.4em",
            },
        ),
        style={
            "flex": "2 1 0",
            "display": "flex",
            "flex_direction": "column",
            "align_items": "center",
            "justify_content": "center",
            "min_width": "0",
        },
    )

    right_block = rx.el.div(
        rx.el.a(
            "Ver en YouTube ↗",
            id="now-playing-youtube",
            href=youtube_link,
            target="_blank",
            rel="noopener noreferrer",
            style={
                "color": TextColor.FOOTER.value,
                "font_size": "0.8em",
                "text_decoration": "none",
                "white_space": "nowrap",
            },
        ),
        class_name="now-playing-right",
        style={
            "flex": "1 1 0",
            "display": "flex",
            "align_items": "center",
            "justify_content": "flex-end",
            "min_width": "0",
        },
    )

    return rx.el.div(
        left_block,
        center_block,
        right_block,
        id="now-playing-bar",
        style=now_playing_bar_style,
    )
