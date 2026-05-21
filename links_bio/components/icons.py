import reflex as rx


def _svg(*children, size=24, color="currentColor", **props):
    return rx.el.svg(
        *children,
        xmlns="http://www.w3.org/2000/svg",
        width=size,
        height=size,
        view_box="0 0 24 24",
        fill="none",
        stroke=color,
        custom_attrs={
            "stroke-width": "2",
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
        },
        **props,
    )


def icon_x(size=24, color="currentColor", **props):
    return _svg(
        rx.el.path(d="M18 6 6 18"),
        rx.el.path(d="m6 6 12 12"),
        size=size,
        color=color,
        **props,
    )


def icon_plus(size=24, color="currentColor", **props):
    return _svg(
        rx.el.path(d="M5 12h14"),
        rx.el.path(d="M12 5v14"),
        size=size,
        color=color,
        **props,
    )


def icon_arrow_left(size=24, color="currentColor", **props):
    return _svg(
        rx.el.path(d="m12 19-7-7 7-7"),
        rx.el.path(d="M19 12H5"),
        size=size,
        color=color,
        **props,
    )


def icon_send(size=24, color="currentColor", **props):
    return _svg(
        rx.el.path(
            d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"
        ),
        rx.el.path(d="m21.854 2.147-10.94 10.939"),
        size=size,
        color=color,
        **props,
    )


def icon_circle_check(size=24, color="currentColor", **props):
    return _svg(
        rx.el.circle(cx="12", cy="12", r="10"),
        rx.el.path(d="m9 12 2 2 4-4"),
        size=size,
        color=color,
        **props,
    )


def icon_youtube(size=24, color="currentColor", **props):
    return _svg(
        rx.el.path(
            d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"
        ),
        rx.el.path(d="m10 15 5-3-5-3z"),
        size=size,
        color=color,
        **props,
    )


def icon_upload(size=24, color="currentColor", **props):
    return _svg(
        rx.el.path(d="M12 3v12"),
        rx.el.path(d="m17 8-5-5-5 5"),
        rx.el.path(d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"),
        size=size,
        color=color,
        **props,
    )


def icon_music(size=24, color="currentColor", **props):
    return _svg(
        rx.el.path(d="M9 18V5l12-2v13"),
        rx.el.circle(cx="6", cy="18", r="3"),
        rx.el.circle(cx="18", cy="16", r="3"),
        size=size,
        color=color,
        **props,
    )


def icon_music_2(size=24, color="currentColor", **props):
    return _svg(
        rx.el.circle(cx="8", cy="18", r="4"),
        rx.el.path(d="M12 18V2l7 4"),
        size=size,
        color=color,
        **props,
    )


def icon_headphones(size=24, color="currentColor", **props):
    return _svg(
        rx.el.path(
            d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"
        ),
        size=size,
        color=color,
        **props,
    )


def icon_video(size=24, color="currentColor", **props):
    return _svg(
        rx.el.path(
            d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"
        ),
        rx.el.rect(x="2", y="6", width="14", height="12", rx="2"),
        size=size,
        color=color,
        **props,
    )


def icon_rocket(size=24, color="currentColor", **props):
    return _svg(
        rx.el.path(d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"),
        rx.el.path(
            d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"
        ),
        rx.el.path(
            d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"
        ),
        rx.el.path(d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"),
        size=size,
        color=color,
        **props,
    )


def icon_disc_3(size=24, color="currentColor", **props):
    return _svg(
        rx.el.circle(cx="12", cy="12", r="10"),
        rx.el.path(d="M6 12c0-1.7.7-3.2 1.8-4.2"),
        rx.el.circle(cx="12", cy="12", r="2"),
        rx.el.path(d="M18 12c0 1.7-.7 3.2-1.8 4.2"),
        size=size,
        color=color,
        **props,
    )


def icon_dices(size=24, color="currentColor", **props):
    return _svg(
        rx.el.rect(width="12", height="12", x="2", y="10", rx="2", ry="2"),
        rx.el.path(
            d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"
        ),
        rx.el.path(d="M6 18h.01"),
        rx.el.path(d="M10 14h.01"),
        rx.el.path(d="M15 6h.01"),
        rx.el.path(d="M18 9h.01"),
        size=size,
        color=color,
        **props,
    )


def icon_dice_5(size=24, color="currentColor", **props):
    return _svg(
        rx.el.rect(width="18", height="18", x="3", y="3", rx="2", ry="2"),
        rx.el.path(d="M16 8h.01"),
        rx.el.path(d="M8 8h.01"),
        rx.el.path(d="M8 16h.01"),
        rx.el.path(d="M16 16h.01"),
        rx.el.path(d="M12 12h.01"),
        size=size,
        color=color,
        **props,
    )


def icon_triangle_alert(size=24, color="currentColor", **props):
    return _svg(
        rx.el.path(
            d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"
        ),
        rx.el.path(d="M12 9v4"),
        rx.el.path(d="M12 17h.01"),
        size=size,
        color=color,
        **props,
    )
