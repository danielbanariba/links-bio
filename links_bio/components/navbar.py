import reflex as rx 
from links_bio.styles.styles import Size as Size

def navbar() -> rx.Component:
    return rx.hstack(
        rx.text(
            "{daniel-banariba};" # El nombre el principio de la pagina
        ),
        position="sticky", 
        bg="lightgray", 
        padding_x=Size.DEFAULT.value, # El padding es el espacio que hay entre el borde y el texto
        padding_y=Size.SMALL.value, 
        z_index="999", #Esto lo que hace es fijar el logo, para que nada lo pueda mover de su lugar
        top="0px", # Esto es para que el logo se quede fijo en la parte de arriba
    )