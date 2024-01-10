import reflex as rx
import links_bio.styles.styles as styles
from links_bio.styles.styles import Size
from links_bio.styles.styles import Color

# Recibe como parametro el texto del boton y la url a la que se quiere redirigir
def link_proyects(title: str, body: str, image: str, url: str, *image_icons: str) -> rx.Component:
    # simula un constructor, donde puede recibir un numero indefinido de parametros
    image_components = [rx.image(src=icon, width="60px", height="60px") for icon in image_icons]
    return rx.link(
        rx.button(
            rx.vstack(
                rx.image(
                    src=image,
                    width="100%",
                    height="100%",
                    margin=Size.MEDIUM.value,
                    border_radius=Size.DEFAULT.value,
                    alt=title
                ),
                rx.vstack(
                    rx.text(title, style=styles.title_style_music),
                    rx.text(
                        body, 
                        style=styles.body_style_proyect,
                    ),
                    spacing=Size.SMALL.value,
                    padding_y=Size.SMALL.value,
                    padding_right=Size.SMALL.value
                ),
                    rx.tablet_and_desktop(
                        rx.hstack(
                            rx.image(
                            src="icons/python-alt.svg",
                            width="60px", 
                            height="60px",
                            ),
                            rx.image(
                                src="icons/Reflex.svg",
                                width="100px",
                                height="100px",
                            ),  
                            *image_components,     
                        ),
                    ),
                    rx.mobile_only(
                        rx.wrap(
                            rx.wrap_item(
                                rx.center(
                                    rx.image(
                                         src="icons/python-alt.svg",
                                        width="60px", 
                                        height="60px",
                                    ),
                                    rx.image(
                                        src="icons/Reflex.svg",
                                        width="100px",
                                        height="100px",
                                    ),    
                                )
                            ),
                            rx.wrap_item(
                                rx.center(  
                                    *image_components,    
                                )
                            ),                     
                            align="center",  # Alinea los elementos en el centro verticalmente
                            justify="center",   
                        ),
                    ),
                padding=Size.SMALL.value,
                width="100%"
            ),
            #bg="#09080d !important",
            # bg = "#022b44 !important",
            # _hover= { "background_color": "#0a121f !important"},
        ),
        href=url,
        is_external=True, # Se abren los links en una nueva pestaña
        width="100%"
    )