import reflex as rx 
import links_bio.styles.styles as styles
from links_bio.styles.styles import Size 
from links_bio.styles.colors import Color, LogoColor

def navbar() -> rx.Component:
    return rx.hstack(
        rx.box(
            rx.span("{", color=LogoColor.PARENTESIS.value),
            rx.span("daniel_banariba", color=LogoColor.PALABRAS.value),
            rx.span("}", color=LogoColor.PARENTESIS.value),
            rx.span(";", color=LogoColor.PUNTO_Y_COMA.value),
            style=styles.navbar_title_style
        ),
        position="sticky",
        bg=Color.CONTENT.value, # Color de los botones
        padding_x=Size.BIG.value, # El padding es el espacio que hay entre el borde y el texto
        padding_y=Size.DEFAULT.value,
        z_index="999",  #Esto lo que hace es fijar el logo, para que nada lo pueda mover de su lugar
        top="0" # Esto es para que el logo se quede fijo en la parte de arriba
    )