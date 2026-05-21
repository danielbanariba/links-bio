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
from links_bio.components import icons


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
        flex="1",
        min_width="200px",
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


def _success_state() -> rx.Component:
    return rx.vstack(
        icons.icon_circle_check(size=56, color=Color.PRIMARY.value),
        rx.heading(
            "Banda enviada correctamente",
            font_size="1.6em",
            color=TextColor.HEADER.value,
        ),
        rx.text(
            "Revisaremos tu envio y te contactaremos pronto. Atento al correo.",
            color=TextColor.BODY.value,
            text_align="center",
            max_width="400px",
        ),
        rx.link(
            rx.button(
                icons.icon_arrow_left(size=16),
                "Volver al archive",
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
            _two_col(
                _form_field(
                    "Nombre de la banda",
                    rx.input(
                        name="band_name",
                        placeholder="ej. Blasfemia",
                        style=form_input_style,
                        required=True,
                    ),
                    required=True,
                ),
                _form_field(
                    "Email de contacto",
                    rx.input(
                        name="contact_email",
                        placeholder="banda@email.com",
                        type="email",
                        style=form_input_style,
                        required=True,
                    ),
                    required=True,
                ),
            ),
            _two_col(
                _form_field(
                    "Genero",
                    rx.select(
                        GENRES,
                        name="genre",
                        placeholder="Selecciona un genero",
                        color=TextColor.HEADER.value,
                        required=True,
                    ),
                    required=True,
                ),
                _form_field(
                    "Pais",
                    rx.input(
                        name="country",
                        placeholder="ej. Honduras",
                        style=form_input_style,
                        required=True,
                    ),
                    required=True,
                ),
            ),
            _two_col(
                _form_field(
                    "Titulo del album",
                    rx.input(
                        name="album_title",
                        placeholder="ej. Inmaculada Concepcion",
                        style=form_input_style,
                    ),
                ),
                _form_field(
                    "Ano de lanzamiento",
                    rx.input(
                        name="year",
                        placeholder="ej. 2024",
                        type="number",
                        min="1960",
                        max="2030",
                        style=form_input_style,
                    ),
                ),
            ),
            _two_col(
                _form_field(
                    "YouTube URL",
                    rx.input(
                        name="youtube_url",
                        placeholder="https://youtu.be/...",
                        style=form_input_style,
                    ),
                ),
                _form_field(
                    "Bandcamp URL",
                    rx.input(
                        name="bandcamp_url",
                        placeholder="https://band.bandcamp.com",
                        style=form_input_style,
                    ),
                ),
            ),
            _form_field(
                "Descripcion",
                rx.text_area(
                    name="description",
                    placeholder="Contanos sobre tu banda...",
                    style=form_input_style,
                    rows="4",
                ),
            ),
            rx.cond(
                FormState.submission_error != "",
                rx.callout.root(
                    rx.callout.icon(icons.icon_triangle_alert(size=18)),
                    rx.callout.text(FormState.submission_error),
                    color_scheme="red",
                    width="100%",
                ),
            ),
            rx.button(
                icons.icon_upload(size=16),
                "Enviar banda",
                type="submit",
                style=primary_button_style,
                width="100%",
                font_size="1.1em",
                padding_y="0.8em",
            ),
            spacing="4",
            width="100%",
        ),
        on_submit=FormState.handle_submission,
        width="100%",
    )


def submit_page() -> rx.Component:
    return rx.box(
        metal_navbar(),
        rx.center(
            rx.vstack(
                rx.vstack(
                    icons.icon_music_2(size=48, color=Color.PRIMARY.value),
                    rx.heading(
                        "Submit your Band",
                        font_size="2.2em",
                        color=TextColor.HEADER.value,
                        text_align="center",
                    ),
                    rx.text(
                        "Envia tu banda o album para revision e inclusion gratuita en el archivo.",
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
                rx.box(
                    rx.cond(
                        FormState.submission_success,
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
                    max_width="700px",
                    spacing="2",
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
