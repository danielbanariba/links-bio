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
                    "Envia tu Banda",
                    font_size="2em",
                    color=TextColor.HEADER.value,
                ),
                rx.text(
                    "Completa el formulario para que tu banda sea considerada para el archivo.",
                    color=TextColor.BODY.value,
                ),
                rx.cond(
                    FormState.submission_success,
                    rx.callout(
                        "Tu banda ha sido enviada exitosamente! Nos pondremos en contacto pronto.",
                        icon="check",
                        color_scheme="green",
                        width="100%",
                    ),
                    rx.form(
                        rx.vstack(
                            # Band name
                            rx.vstack(
                                rx.text(
                                    "Nombre de la banda *",
                                    color=TextColor.HEADER.value,
                                    font_size=Size.MEDIUM.value,
                                ),
                                rx.input(
                                    name="band_name",
                                    placeholder="Nombre de la banda",
                                    style=form_input_style,
                                    required=True,
                                ),
                                width="100%",
                                spacing="1",
                            ),
                            # Email
                            rx.vstack(
                                rx.text(
                                    "Email de contacto *",
                                    color=TextColor.HEADER.value,
                                    font_size=Size.MEDIUM.value,
                                ),
                                rx.input(
                                    name="contact_email",
                                    placeholder="email@ejemplo.com",
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
                                    "Genero *",
                                    color=TextColor.HEADER.value,
                                    font_size=Size.MEDIUM.value,
                                ),
                                rx.select(
                                    GENRES,
                                    name="genre",
                                    placeholder="Selecciona un genero",
                                    color=TextColor.HEADER.value,
                                    required=True,
                                ),
                                width="100%",
                                spacing="1",
                            ),
                            # Country
                            rx.vstack(
                                rx.text(
                                    "Pais *",
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
                                    "Titulo del album",
                                    color=TextColor.HEADER.value,
                                    font_size=Size.MEDIUM.value,
                                ),
                                rx.input(
                                    name="album_title",
                                    placeholder="Titulo del album",
                                    style=form_input_style,
                                ),
                                width="100%",
                                spacing="1",
                            ),
                            # YouTube URL
                            rx.vstack(
                                rx.text(
                                    "URL de YouTube",
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
                                    "URL de Bandcamp",
                                    color=TextColor.HEADER.value,
                                    font_size=Size.MEDIUM.value,
                                ),
                                rx.input(
                                    name="bandcamp_url",
                                    placeholder="https://banda.bandcamp.com",
                                    style=form_input_style,
                                ),
                                width="100%",
                                spacing="1",
                            ),
                            # Description
                            rx.vstack(
                                rx.text(
                                    "Descripcion",
                                    color=TextColor.HEADER.value,
                                    font_size=Size.MEDIUM.value,
                                ),
                                rx.text_area(
                                    name="description",
                                    placeholder="Cuentanos sobre tu banda...",
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
                                "Enviar",
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
                        "Que pasa despues?",
                        font_size=Size.LARGE.value,
                        color=TextColor.HEADER.value,
                    ),
                    rx.vstack(
                        rx.text(
                            "1. Revisamos tu envio y escuchamos tu musica.",
                            color=TextColor.BODY.value,
                        ),
                        rx.text(
                            "2. Si tu banda es seleccionada, te contactamos para coordinar.",
                            color=TextColor.BODY.value,
                        ),
                        rx.text(
                            "3. Publicamos tu album en el archivo con toda la informacion.",
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
