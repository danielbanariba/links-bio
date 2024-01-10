import reflex as rx
from enum import Enum
from .colors import Color, TextColor
from .fonts import Font, FontWeight

# Ancho maximo de la pagina 
MAX_WIDTH = "800px"
TAMANIO_ICON = 1.7

#Hojas de estilos
STYLESHEETS = [
    "https://fonts.googleapis.com/css2?family=Poppins:wght@300;500&display=swap",
    "fonts/fonts.css"
]

class Size(Enum):
    ZERO = "0px !important"
    VERY_SMALL = "0.2em"
    SMALL = "0.5em"
    MEDIUM = "0.8em"
    DEFAULT = "1em"
    ALGO_GRANDE = "1.1em"
    LARGE = "1.5em"
    GRANDELOGO = "1.7em"
    BIG = "2.2em"
    VERY_BIG = "3em"


# Styles
BASE_STYLE = {
    "font_family": Font.DEFAULT.value, # Fuente de texto
    "font_weight": FontWeight.LIGHT.value,
    "background": Color.BACKGROUND.value,
    rx.Heading: {
        "color": TextColor.HEADER.value,
        "font_family": Font.TITLE.value,
        "font_weight": FontWeight.MEDIUM.value
    },
    rx.Button: {
        "width": "100%",
        "height": "100%",
        "padding": Size.SMALL.value,
        "border_radius": Size.DEFAULT.value,
        "color": TextColor.HEADER.value,
        "background_color": Color.CONTENT.value,
        "white_space": "normal", # Responsive text
        "text_align": "start",
        "_hover": { # Cambia de color al pasar el mouse
            "background_color": Color.SECONDARY.value
        }
    }, 
    rx.Link: {# Desaparece el subrayado de los links
        "text_decoration": "none",
        "_hover": {}
    }
}

navbar_title_style = dict(
    font_family=Font.LOGO.value,
    font_weight=FontWeight.MEDIUM.value,
    font_size=Size.BIG.value
)

logo_canal = dict(
    font_family=Font.LOGO_CANAL.value,
    font_weight=FontWeight.MEDIUM.value,
    font_size=Size.GRANDELOGO.value,
    _hover={"color": "#045b90"},
)

# Estilos de los textos que van arriba de los botones
title_style = dict(
    width="100%",
    padding_top=Size.DEFAULT.value,
    font_size=Size.LARGE.value
)

button_title_style = dict(
    font_family=Font.TITLE.value,
    font_weight=FontWeight.MEDIUM.value,
    font_size=Size.DEFAULT.value,
    color=TextColor.HEADER.value
)

button_body_style = dict(
    font_weight=FontWeight.LIGHT.value,
    font_size=Size.MEDIUM.value,
    color=TextColor.BODY.value
)

title_style_music = dict(
    font_family=Font.TITLE.value,
    font_weight=FontWeight.MEDIUM.value,
    font_size=Size.LARGE.value,
    color=TextColor.HEADER.value
)

body_style_music = dict(
    font_weight=FontWeight.LIGHT.value,
    font_size=Size.ALGO_GRANDE.value,
    color=TextColor.BODY.value
)

body_style_proyect = dict(
    font_weight=FontWeight.LIGHT.value,
    font_size=Size.ALGO_GRANDE.value,
    color=TextColor.BODY.value,
    padding_buttom=Size.ALGO_GRANDE.value
)

miniatura_video_style = dict(
    width="auto", 
    height="auto",
    margin="auto",
    border_radius = Size.DEFAULT.value,
    _hover={
        "transform": "scale(1.1)", #rotate(10deg)
        "transition": "transform 0.2s",
    },
)