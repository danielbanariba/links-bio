import reflex as rx
from links_bio.styles.styles import mini_player_style
from links_bio.styles.colors import Color, TextColor


def mini_player(video_id: rx.Var, youtube_url: rx.Var) -> rx.Component:
    # Overlay shown until the YT iframe fires onReady. Hidden by JS, not state,
    # so it lives in the user-gesture path and never waits on a Reflex round-trip.
    loader = rx.el.div(
        rx.el.div(class_name="mp-spinner"),
        rx.el.span(
            "Cargando reproductor...",
            style={
                "color": TextColor.BODY.value,
                "font_size": "0.72em",
                "margin_top": "0.6em",
            },
        ),
        id="mini-player-loader",
        class_name="mp-overlay",
    )

    # Shown by JS when the IFrame API onError fires (video removed/private/embed
    # disabled). Falls back to a direct YouTube link so playback stays reachable.
    error_box = rx.el.div(
        rx.el.span(
            "Video no disponible",
            style={
                "color": TextColor.HEADER.value,
                "font_size": "0.8em",
                "font_weight": "600",
            },
        ),
        rx.el.span(
            "No se puede reproducir acá.",
            style={
                "color": TextColor.FOOTER.value,
                "font_size": "0.7em",
                "margin_top": "0.3em",
                "text_align": "center",
            },
        ),
        rx.el.a(
            "Abrir en YouTube ↗",
            href=youtube_url,
            target="_blank",
            rel="noopener noreferrer",
            style={
                "color": Color.PRIMARY.value,
                "font_size": "0.75em",
                "text_decoration": "none",
                "margin_top": "0.6em",
                "font_weight": "600",
            },
        ),
        id="mini-player-error",
        class_name="mp-overlay",
        style={"display": "none"},
    )

    # Shown by JS when the IFrame API script itself never loads in ~8s.
    timeout_box = rx.el.div(
        rx.el.span(
            "El reproductor tarda en cargar.",
            style={
                "color": TextColor.HEADER.value,
                "font_size": "0.78em",
                "font_weight": "600",
                "text_align": "center",
            },
        ),
        rx.el.span(
            "Revisá tu conexión.",
            style={
                "color": TextColor.FOOTER.value,
                "font_size": "0.7em",
                "margin_top": "0.3em",
            },
        ),
        rx.el.button(
            "Reintentar",
            custom_attrs={"data-mp-retry": "1"},
            style={
                "background": Color.PRIMARY.value,
                "color": TextColor.HEADER.value,
                "border": "none",
                "cursor": "pointer",
                "font_size": "0.72em",
                "padding": "0.4em 1em",
                "border_radius": "2px",
                "margin_top": "0.7em",
                "font_weight": "600",
            },
        ),
        id="mini-player-timeout",
        class_name="mp-overlay",
        style={"display": "none"},
    )

    return rx.el.div(
        rx.el.div(
            id="yt-player",
            custom_attrs={"data-video-id": video_id},
            style={
                "width": "100%",
                "height": "100%",
            },
        ),
        loader,
        error_box,
        timeout_box,
        id="mini-player",
        custom_attrs={"data-mini-toggle": "1"},
        style=mini_player_style,
    )
