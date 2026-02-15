import reflex as rx


def youtube_embed(video_id: rx.Var[str]) -> rx.Component:
    return rx.cond(
        video_id != "",
        rx.box(
            rx.el.iframe(
                src=f"https://www.youtube.com/embed/{video_id}",
                width="100%",
                height="100%",
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
                allowfullscreen=True,
                loading="lazy",
                style={
                    "position": "absolute",
                    "top": "0",
                    "left": "0",
                },
            ),
            position="relative",
            width="100%",
            padding_top="56.25%",  # 16:9 aspect ratio
            border_radius="0.8em",
            overflow="hidden",
        ),
    )
