import reflex as rx
from links_bio.styles.colors import TextColor
from links_bio.states.metal_archive_state import MetalArchiveState
from links_bio.components.metal.album_card import album_card

_INFINITE_SCROLL_JS = """
(function() {
    let debounce = false;
    const io = new IntersectionObserver((entries) => {
        if (entries[0] && entries[0].isIntersecting && !debounce) {
            debounce = true;
            const btn = document.getElementById('load-more-trigger');
            if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            setTimeout(() => { debounce = false; }, 2500);
        }
    }, { rootMargin: '300px' });

    function observe() {
        const el = document.getElementById('scroll-sentinel');
        if (el) io.observe(el);
    }

    new MutationObserver(observe).observe(document.body, { childList: true, subtree: true });
    observe();
})();
"""


def _infinite_scroll_sentinel() -> rx.Component:
    """Hidden button + sentinel div for infinite scroll."""
    return rx.box(
        rx.el.button(
            id="load-more-trigger",
            on_click=MetalArchiveState.load_more_albums,
            style={"position": "absolute", "opacity": "0", "height": "0", "width": "0", "overflow": "hidden", "pointer_events": "none", "padding": "0", "border": "none"},
        ),
        rx.el.div(id="scroll-sentinel"),
        rx.script(_INFINITE_SCROLL_JS),
        height="1px",
    )


def album_grid(albums: rx.Var[list[dict]], show_load_more: bool = True) -> rx.Component:
    children = [
        rx.cond(
            albums.length() > 0,
            rx.box(
                rx.grid(
                    rx.foreach(albums, album_card),
                    columns=rx.breakpoints(
                        initial="1",
                        sm=rx.cond(albums.length() < 2, "1", "2"),
                        md=rx.cond(albums.length() < 3, str(albums.length()), "3"),
                        lg=rx.cond(albums.length() < 4, str(albums.length()), "4"),
                    ),
                    spacing="4",
                    width=rx.cond(albums.length() == 1, "auto", "100%"),
                    justify_content="center",
                ),
                width="100%",
                display="flex",
                justify_content="center",
            ),
            rx.center(
                rx.text(
                    "No se encontraron albums.",
                    color=TextColor.BODY.value,
                    font_size="1.1em",
                ),
                padding_y="3em",
                width="100%",
            ),
        ),
    ]

    if show_load_more:
        children.append(
            rx.cond(
                MetalArchiveState.has_more,
                _infinite_scroll_sentinel(),
            ),
        )

    return rx.vstack(
        *children,
        width="100%",
        spacing="3",
    )
