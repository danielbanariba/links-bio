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


def _step_item(number: str, title: str, desc: str) -> rx.Component:
    return rx.hstack(
        rx.center(
            rx.text(
                number,
                font_size="1.1em",
                font_weight="600",
                color=TextColor.HEADER.value,
            ),
            width="2.5em",
            height="2.5em",
            border_radius="50%",
            background=Color.PRIMARY.value,
            flex_shrink="0",
        ),
        rx.vstack(
            rx.text(title, color=TextColor.HEADER.value, font_weight="500"),
            rx.text(desc, color=TextColor.BODY.value, font_size=Size.MEDIUM.value),
            spacing="0",
        ),
        spacing="3",
        align_items="center",
        width="100%",
    )


def promo_page() -> rx.Component:
    return rx.box(
        metal_navbar(),
        rx.center(
            rx.vstack(
                # Header
                rx.vstack(
                    rx.icon("disc-3", size=40, color=Color.PRIMARY.value),
                    rx.heading(
                        "Sube tu musica al archivo",
                        font_size="2em",
                        color=TextColor.HEADER.value,
                        text_align="center",
                    ),
                    rx.text(
                        "Envia la informacion de tu banda o disco y nosotros nos encargamos de subirlo al canal.",
                        color=TextColor.BODY.value,
                        text_align="center",
                        max_width="550px",
                    ),
                    spacing="3",
                    align_items="center",
                    width="100%",
                ),
                # Form card
                rx.box(
                    rx.cond(
                        FormState.contact_success,
                        rx.vstack(
                            rx.icon("circle-check", size=48, color=Color.PRIMARY.value),
                            rx.heading(
                                "Recibido!",
                                font_size="1.5em",
                                color=TextColor.HEADER.value,
                            ),
                            rx.text(
                                "Tu informacion fue enviada. Revisaremos tu musica y te contactaremos pronto.",
                                color=TextColor.BODY.value,
                                text_align="center",
                            ),
                            spacing="3",
                            align_items="center",
                            padding_y="3em",
                        ),
                        rx.form(
                            rx.vstack(
                                # ── Banda + Email ──
                                _two_col(
                                    _form_field(
                                        "Nombre de la banda",
                                        rx.input(
                                            name="band_name",
                                            placeholder="Ej: Blasfemia",
                                            style=form_input_style,
                                            required=True,
                                        ),
                                        required=True,
                                    ),
                                    _form_field(
                                        "Email de contacto",
                                        rx.input(
                                            name="email",
                                            placeholder="email@ejemplo.com",
                                            type="email",
                                            style=form_input_style,
                                            required=True,
                                        ),
                                        required=True,
                                    ),
                                ),
                                # ── Genero + Pais ──
                                _two_col(
                                    _form_field(
                                        "Genero",
                                        rx.vstack(
                                            rx.select(
                                                GENRES + ["Otro"],
                                                name="genre",
                                                placeholder="Selecciona un genero",
                                                color=TextColor.HEADER.value,
                                                on_change=FormState.set_promo_genre,
                                            ),
                                            rx.cond(
                                                FormState.promo_show_custom_genre,
                                                rx.input(
                                                    name="custom_genre",
                                                    placeholder="Escribe el genero",
                                                    style=form_input_style,
                                                ),
                                            ),
                                            width="100%",
                                            spacing="2",
                                        ),
                                        required=True,
                                    ),
                                    _form_field(
                                        "Pais",
                                        rx.input(
                                            name="country",
                                            placeholder="Ej: Estados Unidos",
                                            style=form_input_style,
                                        ),
                                    ),
                                ),
                                # ── Album + Año ──
                                _two_col(
                                    _form_field(
                                        "Titulo del album",
                                        rx.input(
                                            name="album_title",
                                            placeholder="Ej: Inmaculada Concepcion",
                                            style=form_input_style,
                                            required=True,
                                        ),
                                        required=True,
                                    ),
                                    _form_field(
                                        "Ano de lanzamiento",
                                        rx.input(
                                            name="year",
                                            placeholder="Ej: 2024",
                                            type="number",
                                            min="1960",
                                            max="2030",
                                            style=form_input_style,
                                        ),
                                    ),
                                ),
                                # ── Formato ──
                                _form_field(
                                    "Formato",
                                    rx.select(
                                        RELEASE_FORMATS,
                                        name="release_format",
                                        placeholder="Tipo de lanzamiento",
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
                                            "(al menos uno)",
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
                                                placeholder="https://banda.bandcamp.com",
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
                                            "Agregar otro link",
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
                                        icon="alert-triangle",
                                        color_scheme="red",
                                        width="100%",
                                    ),
                                ),
                                # Submit
                                rx.button(
                                    rx.icon("send", size=16),
                                    "Enviar informacion",
                                    type="submit",
                                    style=primary_button_style,
                                    width="100%",
                                    font_size="1.05em",
                                ),
                                spacing="4",
                                width="100%",
                            ),
                            on_submit=FormState.handle_contact_form,
                            width="100%",
                        ),
                    ),
                    background=Color.CONTENT.value,
                    border="1px solid",
                    border_color=Color.SECONDARY.value,
                    border_radius="1em",
                    padding="2em",
                    width="100%",
                    max_width="700px",
                ),
                # Steps
                rx.vstack(
                    rx.heading(
                        "Como funciona",
                        font_size=Size.LARGE.value,
                        color=TextColor.HEADER.value,
                    ),
                    _step_item("1", "Revisamos tu envio", "Escuchamos tu musica y verificamos la informacion."),
                    _step_item("2", "Producimos el video", "Creamos el video con portada, tracklist y espectro de audio."),
                    _step_item("3", "Publicamos en el canal", "Tu album aparece en YouTube y en el Metal Archive."),
                    width="100%",
                    max_width="700px",
                    spacing="3",
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
