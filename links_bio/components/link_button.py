import reflex as rx
import links_bio.styles.styles as styles

# Recibe como parametro el texto del boton y la url a la que se quiere redirigir
def link_button(title: str, body: str, url: str) -> rx.Component:
    return rx.link(
        rx.button(
            rx.hstack(
                rx.icon(
                    tag="arrow_forward",
                    width=styles.Size.BIG.value,
                    height=styles.Size.DEFAULT.value
                ),
                rx.vstack(     
                    rx.text(title, style=styles.button_title_style),
                    rx.text(body, style=styles.button_body_style),
                    align_items="start"
                )
            )
        ),
        href=url,
        is_external=True, # Se abren los links en una nueva pestaña
        width="100%"
    )