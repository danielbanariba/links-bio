import reflex as rx 

def navbar() -> rx.Component:
    return rx.hstack(
        rx.text(
            "{daniel-banariba};",
            height="40px",
            style={"font-family": "'DinaRemaster', sans-serif", # TODO investigar como poner el logo perzonalizado osea el siguiente codigo 
                   # @font-face {
                    # font-family: 'DinaRemaster';
                    # src: url('../font/DinaRemasterII.ttc') format('truetype');
                    #}
                   "font-weight": "100", 
                   "font-size": "30px"}
        ),
        position="sticky",
        padding_x="16px",
        padding_y="8px",
        z_index="999" #Esto lo que hace es fijar el logo, para que nada lo pueda mover de su lugar
    )