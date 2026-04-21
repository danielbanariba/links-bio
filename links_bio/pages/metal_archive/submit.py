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
from links_bio.constants.metal_archive import GENRES


def submit_page() -> rx.Component:
    return rx.box(
        metal_navbar(),
        rx.center(
            rx.vstack(
                rx.heading(
                    "Submit your Band",
                    font_size="2em",
                    color=TextColor.HEADER.value,
                ),
                rx.text(
                    "Send your band or album for review and possible free inclusion in the archive.",
                    color=TextColor.BODY.value,
                ),
                rx.cond(
                    FormState.submission_success,
                    rx.callout(
                        "Your band has been submitted successfully! We'll get in touch soon.",
                        icon="check",
                        color_scheme="green",
                        width="100%",
                    ),
                    rx.form(
                        rx.vstack(
                            # Band name
                            rx.vstack(
                                rx.text(
                                    "Band name *",
                                    color=TextColor.HEADER.value,
                                    font_size=Size.MEDIUM.value,
                                ),
                                rx.input(
                                    name="band_name",
                                    placeholder="Band name",
                                    style=form_input_style,
                                    required=True,
                                ),
                                width="100%",
                                spacing="1",
                            ),
                            # Email
                            rx.vstack(
                                rx.text(
                                    "Contact email *",
                                    color=TextColor.HEADER.value,
                                    font_size=Size.MEDIUM.value,
                                ),
                                rx.input(
                                    name="contact_email",
                                    placeholder="email@example.com",
                                    type="email",
                                    style=form_input_style,
                                    required=True,
                                ),
                                width="100%",
                                spacing="1",
                            ),
                            # Genre
                            rx.vstack(
                                rx.text(
                                    "Genre *",
                                    color=TextColor.HEADER.value,
                                    font_size=Size.MEDIUM.value,
                                ),
                                rx.select(
                                    GENRES,
                                    name="genre",
                                    placeholder="Select a genre",
                                    color=TextColor.HEADER.value,
                                    required=True,
                                ),
                                width="100%",
                                spacing="1",
                            ),
                            # Country
                            rx.vstack(
                                rx.text(
                                    "Country *",
                                    color=TextColor.HEADER.value,
                                    font_size=Size.MEDIUM.value,
                                ),
                                rx.input(
                                    name="country",
                                    placeholder="Honduras",
                                    style=form_input_style,
                                    required=True,
                                ),
                                width="100%",
                                spacing="1",
                            ),
                            # Album title (optional)
                            rx.vstack(
                                rx.text(
                                    "Album title",
                                    color=TextColor.HEADER.value,
                                    font_size=Size.MEDIUM.value,
                                ),
                                rx.input(
                                    name="album_title",
                                    placeholder="Album title",
                                    style=form_input_style,
                                ),
                                width="100%",
                                spacing="1",
                            ),
                            # YouTube URL
                            rx.vstack(
                                rx.text(
                                    "YouTube URL",
                                    color=TextColor.HEADER.value,
                                    font_size=Size.MEDIUM.value,
                                ),
                                rx.input(
                                    name="youtube_url",
                                    placeholder="https://youtu.be/...",
                                    style=form_input_style,
                                ),
                                width="100%",
                                spacing="1",
                            ),
                            # Bandcamp URL
                            rx.vstack(
                                rx.text(
                                    "Bandcamp URL",
                                    color=TextColor.HEADER.value,
                                    font_size=Size.MEDIUM.value,
                                ),
                                rx.input(
                                    name="bandcamp_url",
                                    placeholder="https://band.bandcamp.com",
                                    style=form_input_style,
                                ),
                                width="100%",
                                spacing="1",
                            ),
                            # Description
                            rx.vstack(
                                rx.text(
                                    "Description",
                                    color=TextColor.HEADER.value,
                                    font_size=Size.MEDIUM.value,
                                ),
                                rx.text_area(
                                    name="description",
                                    placeholder="Tell us about your band...",
                                    style=form_input_style,
                                    rows="4",
                                ),
                                width="100%",
                                spacing="1",
                            ),
                            rx.cond(
                                FormState.submission_error != "",
                                rx.text(
                                    FormState.submission_error,
                                    color="red",
                                    font_size=Size.MEDIUM.value,
                                ),
                            ),
                            rx.button(
                                "Submit",
                                type="submit",
                                style=primary_button_style,
                                width="100%",
                            ),
                            spacing="3",
                            width="100%",
                        ),
                        on_submit=FormState.handle_submission,
                        width="100%",
                    ),
                ),
                # Info section
                rx.vstack(
                    rx.heading(
                        "What happens next?",
                        font_size=Size.LARGE.value,
                        color=TextColor.HEADER.value,
                    ),
                    rx.vstack(
                        rx.text(
                            "1. We review your submission and listen to your music.",
                            color=TextColor.BODY.value,
                        ),
                        rx.text(
                            "2. If your band is selected, we'll contact you to coordinate.",
                            color=TextColor.BODY.value,
                        ),
                        rx.text(
                            "3. We publish your album in the archive with all the information.",
                            color=TextColor.BODY.value,
                        ),
                        spacing="2",
                    ),
                    width="100%",
                    spacing="2",
                    padding_top="2em",
                ),
                max_width="700px",
                width="100%",
                padding_x=Size.BIG.value,
                padding_y=Size.BIG.value,
                spacing="4",
            ),
        ),
        footer(),
    )
