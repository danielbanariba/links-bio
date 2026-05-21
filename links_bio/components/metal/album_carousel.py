import reflex as rx
from links_bio.styles.styles import Size
from links_bio.styles.colors import Color, TextColor
from links_bio.styles.fonts import Font
from links_bio.constants.images import DEFAULT_ALBUM_ARTWORK


CAROUSEL_CSS = """
@keyframes carousel-fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}
.album-carousel {
    display: flex;
    flex-direction: row;
    gap: 1em;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding: 0.4em 0.4em 0.8em 0.4em;
    margin: -0.4em -0.4em 0 -0.4em;
}
.album-carousel::-webkit-scrollbar { display: none; }
.album-carousel-card {
    flex: 0 0 auto;
    width: 170px;
    scroll-snap-align: start;
    text-decoration: none;
    color: inherit;
    display: flex;
    flex-direction: column;
    gap: 0.45em;
    transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    animation: carousel-fade-in 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    position: relative;
}
.album-carousel-card:hover { transform: translateY(-6px) scale(1.03); }
.album-carousel-card:hover .album-carousel-cover {
    box-shadow: 0 14px 32px rgba(0,0,0,0.75), 0 0 0 2px """ + Color.PRIMARY.value + """;
}
.album-carousel-card:hover .album-carousel-band { color: """ + Color.PRIMARY.value + """; }
.album-carousel-card:hover .album-carousel-play {
    opacity: 1;
    transform: translateY(0);
}
.album-carousel-cover-wrap {
    position: relative;
    overflow: hidden;
    border-radius: 2px;
}
.album-carousel-cover {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    border-radius: 2px;
    border: 1px solid """ + Color.SECONDARY.value + """;
    box-shadow: 0 6px 16px rgba(0,0,0,0.45);
    background: """ + Color.CONTENT.value + """;
    transition: box-shadow 0.25s ease, transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
    display: block;
}
.album-carousel-card:hover .album-carousel-cover { transform: scale(1.04); }
.album-carousel-play {
    position: absolute;
    bottom: 10px;
    right: 10px;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: """ + Color.PRIMARY.value + """;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.05em;
    line-height: 1;
    padding-left: 3px;
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: 0 6px 16px rgba(0,0,0,0.55);
    pointer-events: none;
}
.album-carousel-band {
    transition: color 0.18s ease;
}
.album-carousel-band {
    font-family: """ + Font.DEFAULT.value + """;
    font-weight: 700;
    font-size: 0.92em;
    color: """ + TextColor.HEADER.value + """;
    line-height: 1.15;
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.album-carousel-title {
    font-size: 0.78em;
    color: """ + TextColor.BODY.value + """;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.album-carousel-tag {
    font-size: 0.66em;
    color: """ + Color.PRIMARY.value + """;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 600;
}
.album-carousel-time {
    font-size: 0.66em;
    color: """ + TextColor.FOOTER.value + """;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 600;
}
@media (max-width: 600px) {
    .album-carousel-card { width: 140px; }
    .album-carousel-band { font-size: 0.85em; }
    .album-carousel-title { font-size: 0.72em; }
}
"""


def _carousel_card(album: dict) -> rx.Component:
    artwork = rx.cond(
        album["album_artwork_thumb"] != "",
        album["album_artwork_thumb"],
        rx.cond(
            album["album_artwork_url"] != "",
            album["album_artwork_url"],
            DEFAULT_ALBUM_ARTWORK,
        ),
    )
    href = rx.cond(
        album["id"],
        "/metal-archive/album/" + album["id"].to_string(),
        "#",
    )
    return rx.el.a(
        rx.el.div(
            rx.el.img(
                src=artwork,
                alt=album["album_title"],
                loading="lazy",
                class_name="album-carousel-cover",
            ),
            rx.el.div("▶", class_name="album-carousel-play"),
            class_name="album-carousel-cover-wrap",
        ),
        rx.el.div(album["band_name"], class_name="album-carousel-band"),
        rx.el.div(album["album_title"], class_name="album-carousel-title"),
        rx.cond(
            album.contains("relative_time") & (album["relative_time"] != ""),
            rx.el.div(album["relative_time"], class_name="album-carousel-time"),
            rx.el.div(album["genre"], class_name="album-carousel-tag"),
        ),
        href=href,
        class_name="album-carousel-card",
    )


def album_carousel(
    title: str,
    albums: rx.Var,
    see_all_href: str = "",
    see_all_label: str = "Ver todo",
) -> rx.Component:
    header = rx.el.div(
        rx.el.h2(
            title,
            style={
                "font_family": Font.DEFAULT.value,
                "font_size": rx.breakpoints(initial="1.25em", md="1.55em"),
                "font_weight": "800",
                "color": TextColor.HEADER.value,
                "letter_spacing": "-0.015em",
                "margin": "0",
                "line_height": "1.1",
            },
        ),
        rx.cond(
            see_all_href != "",
            rx.el.a(
                see_all_label + " →",
                href=see_all_href,
                style={
                    "color": Color.PRIMARY.value,
                    "font_size": "0.85em",
                    "text_decoration": "none",
                    "font_weight": "600",
                    "letter_spacing": "0.02em",
                    "white_space": "nowrap",
                    "padding_left": "0.6em",
                },
            ),
        ),
        style={
            "display": "flex",
            "align_items": "baseline",
            "justify_content": "space-between",
            "width": "100%",
            "margin_bottom": "0.8em",
            "gap": "0.6em",
        },
    )

    body = rx.el.div(
        rx.foreach(albums, _carousel_card),
        class_name="album-carousel",
    )

    return rx.el.section(
        header,
        body,
        style={
            "width": "100%",
            "padding_y": Size.SMALL.value,
        },
    )
