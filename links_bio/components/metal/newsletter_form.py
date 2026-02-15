import reflex as rx
from links_bio.styles.styles import form_input_style, primary_button_style
from links_bio.styles.colors import Color, TextColor
from links_bio.states.form_state import FormState


def newsletter_form_inline() -> rx.Component:
    return rx.box(
        rx.cond(
            FormState.newsletter_success,
            rx.center(
                rx.text(
                    "Gracias por suscribirte!",
                    color=Color.PRIMARY.value,
                    font_size="1.1em",
                    font_weight="500",
                ),
                padding_y="1em",
            ),
            rx.form(
                rx.hstack(
                    rx.input(
                        placeholder="Tu email",
                        name="email",
                        type="email",
                        style=form_input_style,
                        size="3",
                    ),
                    rx.button(
                        "Suscribirme",
                        type="submit",
                        style=primary_button_style,
                    ),
                    width="100%",
                    max_width="500px",
                    spacing="2",
                ),
                on_submit=FormState.handle_newsletter_signup,
                width="100%",
            ),
        ),
        rx.cond(
            FormState.newsletter_error != "",
            rx.text(
                FormState.newsletter_error,
                color="red",
                font_size="0.85em",
                margin_top="0.3em",
            ),
        ),
        width="100%",
    )
