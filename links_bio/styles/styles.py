import reflex as rx
from enum import Enum
from .colors import Color as Color
from .colors import TextColor as TextColor

# Contantes
MAX_WIDTH = "560px"

# Sizes
class Size(Enum):
    ZERO = "0px !important"
    SMALL = "0.5em"
    MEDIUM = "0.8em"
    DEFAULT = "1em"
    LARGE = "1.5em"
    BIG = "2em"
    
# 
BASE_STYLE = {
    "background_color": Color.BACKGROUND.value, # Color de fondo
    rx.Button: {
        "width": "100%",
        "height": "100%",
        "display": "block",
        "padding": Size.SMALL.value,
        "border_radius": Size.DEFAULT.value,
        "color": TextColor.HEADER.value,
        "background_color": Color.CONTENT.value,
        "_hover": { # Cambia de color al pasar el mouse
            "background_color": Color.SECONDARY.value
        }
    },
    rx.Link: {
        # Desaparece el subrayado de los links
        "text_decoration": "none",
        "_hover": {}
    }
}

narbar_title_style = dict(#TODO investigar como poner la fuente de mi carpeta font
    stylesheets=(
        "/assets/fonts/myfont.css"  
    ),
        
    font_size=Size.LARGE.value
)

# Estilos de los textos que van arriba de los botones
title_style = dict(
    width="100%",
    padding_top=Size.DEFAULT.value,
    color=TextColor.HEADER.value
)

button_title_style = dict(
    font_size=Size.DEFAULT.value,
    color=TextColor.HEADER.value
)

button_body_style = dict(
    font_size=Size.MEDIUM.value,
    color=TextColor.BODY.value
)