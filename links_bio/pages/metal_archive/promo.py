import reflex as rx
from links_bio.styles.styles import (
    METAL_ARCHIVE_MAX_WIDTH,
    form_input_style,
    primary_button_style,
    Size,
)
from links_bio.styles.colors import Color, TextColor
from links_bio.states.form_state import FormState
from links_bio.components.metal.metal_navbar import metal_navbar
from links_bio.components.footer import footer
from links_bio.constants.metal_archive import GENRES, RELEASE_FORMATS


def _form_field(label: str, component: rx.Component, required: bool = False) -> rx.Component:
    return rx.vstack(
        rx.hstack(
            rx.text(
                label,
                color=TextColor.HEADER.value,
                font_size=Size.MEDIUM.value,
                font_weight="500",
            ),
            rx.cond(
                required,
                rx.text("*", color=Color.PRIMARY.value, font_size=Size.MEDIUM.value),
            ),
            spacing="1",
        ),
        component,
        width="100%",
        spacing="1",
    )


def _two_col(*children) -> rx.Component:
    return rx.flex(
        *children,
        gap="3",
        width="100%",
        flex_wrap="wrap",
        flex_direction=rx.breakpoints(initial="column", sm="row"),
    )


def _extra_link_row(link: rx.Var[str], index: rx.Var[int]) -> rx.Component:
    return rx.hstack(
        rx.input(
            name=rx.cond(True, "extra_link_" + index.to(str), ""),
            placeholder="https://...",
            style=form_input_style,
            width="100%",
        ),
        rx.icon_button(
            rx.icon("x", size=14),
            on_click=FormState.remove_promo_link(index),
            variant="ghost",
            color=TextColor.FOOTER.value,
            cursor="pointer",
            size="1",
        ),
        width="100%",
        spacing="2",
        align_items="center",
    )


def _step_item(number: str, title: str, desc: str, icon_name: str) -> rx.Component:
    return rx.hstack(
        rx.center(
            rx.icon(icon_name, size=20, color=TextColor.HEADER.value),
            width="3em",
            height="3em",
            border_radius="50%",
            background=Color.PRIMARY.value,
            flex_shrink="0",
        ),
        rx.vstack(
            rx.text(title, color=TextColor.HEADER.value, font_weight="600", font_size="1.05em"),
            rx.text(desc, color=TextColor.BODY.value, font_size=Size.MEDIUM.value),
            spacing="1",
        ),
        spacing="3",
        align_items="center",
        width="100%",
    )


def _success_state() -> rx.Component:
    return rx.vstack(
        rx.icon("circle-check", size=56, color=Color.PRIMARY.value),
        rx.heading(
            "Submission received!",
            font_size="1.6em",
            color=TextColor.HEADER.value,
        ),
        rx.text(
            "We'll review your music and get back to you soon. Keep an eye on your inbox.",
            color=TextColor.BODY.value,
            text_align="center",
            max_width="400px",
        ),
        rx.link(
            rx.button(
                rx.icon("arrow-left", size=16),
                "Back to archive",
                variant="outline",
                color=TextColor.BODY.value,
                border_color=Color.SECONDARY.value,
                cursor="pointer",
                _hover={"border_color": Color.PRIMARY.value},
            ),
            href="/metal-archive",
        ),
        spacing="4",
        align_items="center",
        padding_y="3em",
    )


def _form_content() -> rx.Component:
    return rx.form(
        rx.vstack(
            # ── Band + Email ──
            _two_col(
                _form_field(
                    "Band name",
                    rx.input(
                        name="band_name",
                        placeholder="e.g. Blasfemia",
                        style=form_input_style,
                        required=True,
                    ),
                    required=True,
                ),
                _form_field(
                    "Contact email",
                    rx.input(
                        name="email",
                        placeholder="band@email.com",
                        type="email",
                        style=form_input_style,
                        required=True,
                    ),
                    required=True,
                ),
            ),
            # ── Genre + Country ──
            _two_col(
                _form_field(
                    "Genre",
                    rx.vstack(
                        rx.select(
                            GENRES + ["Other"],
                            name="genre",
                            placeholder="Select a genre",
                            color=TextColor.HEADER.value,
                            on_change=FormState.set_promo_genre,
                        ),
                        rx.cond(
                            FormState.promo_show_custom_genre,
                            rx.input(
                                name="custom_genre",
                                placeholder="Type your genre",
                                style=form_input_style,
                            ),
                        ),
                        width="100%",
                        spacing="2",
                    ),
                    required=True,
                ),
                _form_field(
                    "Country",
                    rx.input(
                        name="country",
                        placeholder="e.g. Honduras",
                        style=form_input_style,
                    ),
                ),
            ),
            # ── Album + Year ──
            _two_col(
                _form_field(
                    "Album title",
                    rx.input(
                        name="album_title",
                        placeholder="e.g. Inmaculada Concepcion",
                        style=form_input_style,
                        required=True,
                    ),
                    required=True,
                ),
                _form_field(
                    "Release year",
                    rx.input(
                        name="year",
                        placeholder="e.g. 2024",
                        type="number",
                        min="1960",
                        max="2030",
                        style=form_input_style,
                    ),
                ),
            ),
            # ── Format ──
            _form_field(
                "Format",
                rx.select(
                    RELEASE_FORMATS,
                    name="release_format",
                    placeholder="Release type",
                    color=TextColor.HEADER.value,
                ),
            ),
            # ── Links section ──
            rx.vstack(
                rx.hstack(
                    rx.text(
                        "Links",
                        color=TextColor.HEADER.value,
                        font_size=Size.MEDIUM.value,
                        font_weight="500",
                    ),
                    rx.text("*", color=Color.PRIMARY.value, font_size=Size.MEDIUM.value),
                    rx.text(
                        "(at least one)",
                        color=TextColor.FOOTER.value,
                        font_size=Size.MEDIUM.value,
                    ),
                    spacing="1",
                ),
                _two_col(
                    rx.vstack(
                        rx.hstack(
                            rx.icon("youtube", size=16, color="#FF0000"),
                            rx.text("YouTube", color=TextColor.BODY.value, font_size=Size.MEDIUM.value),
                            spacing="1",
                        ),
                        rx.input(
                            name="youtube_url",
                            placeholder="https://youtu.be/...",
                            style=form_input_style,
                        ),
                        width="100%",
                        spacing="1",
                    ),
                    rx.vstack(
                        rx.hstack(
                            rx.icon("music", size=16, color="#1DB954"),
                            rx.text("Bandcamp / Spotify", color=TextColor.BODY.value, font_size=Size.MEDIUM.value),
                            spacing="1",
                        ),
                        rx.input(
                            name="bandcamp_url",
                            placeholder="https://band.bandcamp.com",
                            style=form_input_style,
                        ),
                        width="100%",
                        spacing="1",
                    ),
                ),
                # Extra links
                rx.foreach(
                    FormState.promo_extra_links,
                    lambda link, idx: _extra_link_row(link, idx),
                ),
                # Add link button
                rx.cond(
                    FormState.promo_extra_links.length() < 5,
                    rx.button(
                        rx.icon("plus", size=14),
                        "Add another link",
                        on_click=FormState.add_promo_link,
                        variant="outline",
                        color=TextColor.BODY.value,
                        border_color=Color.SECONDARY.value,
                        cursor="pointer",
                        size="1",
                        _hover={"border_color": Color.PRIMARY.value},
                    ),
                ),
                width="100%",
                spacing="2",
            ),
            # Error
            rx.cond(
                FormState.contact_error != "",
                rx.callout(
                    FormState.contact_error,
                    icon="triangle_alert",
                    color_scheme="red",
                    width="100%",
                ),
            ),
            # Submit
            rx.button(
                rx.icon("send", size=16),
                "Submit",
                type="submit",
                style=primary_button_style,
                width="100%",
                font_size="1.1em",
                padding_y="0.8em",
            ),
            spacing="4",
            width="100%",
        ),
        on_submit=FormState.handle_contact_form,
        width="100%",
    )


def promo_page() -> rx.Component:
    return rx.box(
        metal_navbar(),
        rx.center(
            rx.vstack(
                # Header
                rx.vstack(
                    rx.icon("disc-3", size=48, color=Color.PRIMARY.value),
                    rx.heading(
                        "Submit your music",
                        font_size="2.2em",
                        color=TextColor.HEADER.value,
                        text_align="center",
                    ),
                    rx.text(
                        "Send us your band or album info and we'll feature it on the channel.",
                        color=TextColor.BODY.value,
                        text_align="center",
                        max_width="550px",
                        font_size="1.1em",
                    ),
                    spacing="3",
                    align_items="center",
                    width="100%",
                    padding_top="1em",
                ),
                # Form card
                rx.box(
                    rx.cond(
                        FormState.contact_success,
                        _success_state(),
                        _form_content(),
                    ),
                    background=Color.CONTENT.value,
                    border="1px solid",
                    border_color=Color.SECONDARY.value,
                    border_radius="1em",
                    padding=rx.breakpoints(initial="1.5em", sm="2em"),
                    width="100%",
                    max_width="700px",
                ),
                # How it works
                rx.vstack(
                    rx.heading(
                        "How it works",
                        font_size=Size.LARGE.value,
                        color=TextColor.HEADER.value,
                    ),
                    _step_item("1", "We review your submission", "We listen to your music and verify the information.", "headphones"),
                    _step_item("2", "We produce the video", "We create the video with cover art, tracklist and audio spectrum.", "video"),
                    _step_item("3", "We publish it", "Your album goes live on YouTube and the Metal Archive.", "rocket"),
                    width="100%",
                    max_width="700px",
                    spacing="4",
                    padding_top="1em",
                ),
                max_width=METAL_ARCHIVE_MAX_WIDTH,
                width="100%",
                padding_x=Size.BIG.value,
                padding_y=Size.BIG.value,
                spacing="5",
                align_items="center",
            ),
        ),
        footer(),
    )
