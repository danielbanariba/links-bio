import reflex as rx
from links_bio.styles.styles import mini_player_style


def mini_player(video_id: rx.Var) -> rx.Component:
    return rx.el.div(
        rx.el.div(
            id="yt-player",
            custom_attrs={"data-video-id": video_id},
            style={
                "width": "100%",
                "height": "100%",
            },
        ),
        id="mini-player",
        custom_attrs={"data-mini-toggle": "1"},
        style=mini_player_style,
    )
