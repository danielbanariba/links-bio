import reflex as rx 
import links_bio.styles.styles as styles
from links_bio.styles.styles import Size 
from links_bio.styles.colors import Color as Color

def navbar() -> rx.Component:
    return rx.hstack(
        rx.box(
            rx.span("daniel-", color=Color.PRIMARY.value),
            rx.span("banariba", color=Color.SECONDARY.value),
            style=styles.navbar_title_style
        ),
        position="sticky",
        bg=Color.CONTENT.value,
        padding_x=Size.BIG.value,
        padding_y=Size.DEFAULT.value,
        z_index="999",
        top="0"
    )



# def navbar() -> rx.Component:
#     return rx.hstack(
#         rx.box(#TODO {daniel-banariba}; logo de la pagina
#             rx.span("(", color=LogoColor.PARENTESIS.value),
#             rx.span("\"daniel_banariba\"", color=LogoColor.PALABRAS.value),
#             rx.span(")", color=LogoColor.PARENTESIS.value),
#             rx.span(":", color=LogoColor.PUNTO_Y_COMA.value),
#             style=styles.narbar_title_style
#         ),
#         position="sticky", 
#         bg=Color.CONTENT.value, # Color de los botones
#         padding_x=Size.BIG.value, # El padding es el espacio que hay entre el borde y el texto
#         padding_y=Size.DEFAULT.value, 
#         z_index="999", #Esto lo que hace es fijar el logo, para que nada lo pueda mover de su lugar
#         top="0px", # Esto es para que el logo se quede fijo en la parte de arriba
#     )