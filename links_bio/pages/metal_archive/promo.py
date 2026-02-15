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
from links_bio.constants.metal_archive import PROMO_PACKAGES


def _package_card(pkg: dict) -> rx.Component:
    return rx.box(
        rx.vstack(
            rx.text(
                pkg["name"],
                font_size="1.3em",
                font_weight="500",
                color=TextColor.HEADER.value,
            ),
            rx.text(
                pkg["price"],
                font_size="1.8em",
                font_weight="500",
                color=Color.PRIMARY.value,
            ),
            rx.divider(color=Color.SECONDARY.value),
            rx.vstack(
                rx.foreach(
                    pkg["features"],
                    lambda f: rx.hstack(
                        rx.text("✓", color=Color.PRIMARY.value),
                        rx.text(f, color=TextColor.BODY.value, font_size=Size.MEDIUM.value),
                        spacing="2",
                    ),
                ),
                spacing="2",
                align_items="start",
            ),
            spacing="3",
            padding="1.5em",
            align_items="center",
        ),
        background=Color.CONTENT.value,
        border_radius="0.8em",
        width="100%",
        border="1px solid",
        border_color=Color.SECONDARY.value,
        _hover={
            "border_color": Color.PRIMARY.value,
        },
    )


def promo_page() -> rx.Component:
    return rx.box(
        metal_navbar(),
        rx.center(
            rx.vstack(
                rx.heading(
                    "Paquetes de Promocion",
                    font_size="2em",
                    color=TextColor.HEADER.value,
                    text_align="center",
                ),
                rx.text(
                    "Lleva tu banda al siguiente nivel con nuestros servicios de produccion audiovisual.",
                    color=TextColor.BODY.value,
                    text_align="center",
                ),
                # Package cards
                rx.grid(
                    rx.foreach(
                        PROMO_PACKAGES,
                        _package_card,
                    ),
                    columns=rx.breakpoints(
                        initial="1",
                        sm="1",
                        md="3",
                    ),
                    spacing="4",
                    width="100%",
                ),
                # Contact form
                rx.vstack(
                    rx.heading(
                        "Contactanos",
                        font_size=Size.LARGE.value,
                        color=TextColor.HEADER.value,
                    ),
                    rx.cond(
                        FormState.contact_success,
                        rx.callout(
                            "Mensaje enviado exitosamente! Te responderemos pronto.",
                            icon="check",
                            color_scheme="green",
                            width="100%",
                        ),
                        rx.form(
                            rx.vstack(
                                rx.vstack(
                                    rx.text(
                                        "Nombre *",
                                        color=TextColor.HEADER.value,
                                        font_size=Size.MEDIUM.value,
                                    ),
                                    rx.input(
                                        name="name",
                                        placeholder="Tu nombre",
                                        style=form_input_style,
                                        required=True,
                                    ),
                                    width="100%",
                                    spacing="1",
                                ),
                                rx.vstack(
                                    rx.text(
                                        "Email *",
                                        color=TextColor.HEADER.value,
                                        font_size=Size.MEDIUM.value,
                                    ),
                                    rx.input(
                                        name="email",
                                        placeholder="email@ejemplo.com",
                                        type="email",
                                        style=form_input_style,
                                        required=True,
                                    ),
                                    width="100%",
                                    spacing="1",
                                ),
                                rx.vstack(
                                    rx.text(
                                        "Banda / Empresa",
                                        color=TextColor.HEADER.value,
                                        font_size=Size.MEDIUM.value,
                                    ),
                                    rx.input(
                                        name="company",
                                        placeholder="Nombre de tu banda o empresa",
                                        style=form_input_style,
                                    ),
                                    width="100%",
                                    spacing="1",
                                ),
                                rx.vstack(
                                    rx.text(
                                        "Paquete de interes",
                                        color=TextColor.HEADER.value,
                                        font_size=Size.MEDIUM.value,
                                    ),
                                    rx.select(
                                        ["Basico", "Profesional", "Premium"],
                                        name="package_interest",
                                        placeholder="Selecciona un paquete",
                                        color=TextColor.HEADER.value,
                                    ),
                                    width="100%",
                                    spacing="1",
                                ),
                                rx.vstack(
                                    rx.text(
                                        "Mensaje *",
                                        color=TextColor.HEADER.value,
                                        font_size=Size.MEDIUM.value,
                                    ),
                                    rx.text_area(
                                        name="message",
                                        placeholder="Cuentanos sobre tu proyecto...",
                                        style=form_input_style,
                                        rows="4",
                                        required=True,
                                    ),
                                    width="100%",
                                    spacing="1",
                                ),
                                rx.cond(
                                    FormState.contact_error != "",
                                    rx.text(
                                        FormState.contact_error,
                                        color="red",
                                        font_size=Size.MEDIUM.value,
                                    ),
                                ),
                                rx.button(
                                    "Enviar mensaje",
                                    type="submit",
                                    style=primary_button_style,
                                    width="100%",
                                ),
                                spacing="3",
                                width="100%",
                            ),
                            on_submit=FormState.handle_contact_form,
                            width="100%",
                        ),
                    ),
                    width="100%",
                    max_width="600px",
                    spacing="3",
                    padding_top="2em",
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
