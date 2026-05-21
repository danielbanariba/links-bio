import reflex as rx
from links_bio.styles.styles import form_input_style, primary_button_style, Size
from links_bio.styles.colors import Color, TextColor
from links_bio.states.form_state import FormState
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
        icons.icon_circle_check(size=48, color=Color.PRIMARY.value),
        rx.text(
            "Mensaje enviado! Te respondo pronto.",
            color=TextColor.HEADER.value,
            font_weight="500",
            font_size="1.1em",
            text_align="center",
        ),
        spacing="3",
        align_items="center",
        padding_y="2em",
    )


def _form_content() -> rx.Component:
    return rx.form(
        rx.vstack(
            _two_col(
                _form_field(
                    "Nombre",
                    rx.input(
                        name="nombre",
                        placeholder="Tu nombre",
                        style=form_input_style,
                        required=True,
                    ),
                    required=True,
                ),
                _form_field(
                    "Email",
                    rx.input(
                        name="email",
                        placeholder="vos@email.com",
                        type="email",
                        style=form_input_style,
                        required=True,
                    ),
                    required=True,
                ),
            ),
            _form_field(
                "Asunto (opcional)",
                rx.input(
                    name="asunto",
                    placeholder="De que se trata?",
                    style=form_input_style,
                ),
            ),
            _form_field(
                "Tu mensaje",
                rx.text_area(
                    name="mensaje",
                    placeholder="Escribi tu mensaje aca...",
                    style=form_input_style,
                    rows="5",
                ),
                required=True,
            ),
            rx.cond(
                FormState.portfolio_contact_error != "",
                rx.callout.root(
                    rx.callout.icon(icons.icon_triangle_alert(size=18)),
                    rx.callout.text(FormState.portfolio_contact_error),
                    color_scheme="red",
                    width="100%",
                ),
            ),
            rx.button(
                icons.icon_send(size=16),
                "Enviar mensaje",
                type="submit",
                style=primary_button_style,
                width="100%",
                font_size="1.1em",
                padding_y="0.8em",
            ),
            spacing="4",
            width="100%",
        ),
        on_submit=FormState.send_contact_message,
        width="100%",
    )


def contact_form() -> rx.Component:
    return rx.box(
        rx.cond(
            FormState.portfolio_contact_success,
            _success_state(),
            _form_content(),
        ),
        background=Color.CONTENT.value,
        border="1px solid",
        border_color=Color.SECONDARY.value,
        border_radius="1em",
        padding=rx.breakpoints(initial="1.5em", sm="2em"),
        width="100%",
    )
