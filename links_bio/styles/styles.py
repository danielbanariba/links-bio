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
    # Para propiedades spacing en componentes HStack/VStack (valores de 0-9)
    ZERO = "0"
    SMALL_SPACING = "1"
    MEDIUM_SPACING = "2"
    DEFAULT_SPACING = "3"
    LARGE_SPACING = "4"
    BIG_SPACING = "5"
    
    # Para propiedades CSS que necesitan valores con unidades
    ZERO_PX = "0px"
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
    rx.heading: {
        "color": TextColor.HEADER.value,
        "font_family": Font.TITLE.value,
        "font_weight": FontWeight.MEDIUM.value
    },
    rx.button: {
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
    rx.link: {# Desaparece el subrayado de los links
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
    padding_bottom=Size.ALGO_GRANDE.value
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

# ─── Metal Archive Styles ────────────────────────────────────────────

METAL_ARCHIVE_MAX_WIDTH = "1200px"

metal_hero_style = dict(
    background="linear-gradient(135deg, #0a121f 0%, #022b44 50%, #0a121f 100%)",
    padding_y="3em",
    padding_x="2em",
    text_align="center",
    width="100%",
)

album_card_style = dict(
    background=Color.CONTENT.value,
    border_radius="0.8em",
    overflow="hidden",
    transition="transform 0.2s, box-shadow 0.2s",
    _hover={
        "transform": "scale(1.03)",
        "box_shadow": f"0 0 20px {Color.PRIMARY.value}40",
    },
    cursor="pointer",
    width="100%",
)

genre_card_style = dict(
    background=Color.CONTENT.value,
    border_radius="0.8em",
    padding="1.2em",
    text_align="center",
    transition="background 0.2s",
    _hover={
        "background": Color.SECONDARY.value,
    },
    cursor="pointer",
    width="100%",
)

search_input_style = dict(
    background=Color.CONTENT.value,
    border="1px solid",
    border_color=Color.SECONDARY.value,
    color=TextColor.HEADER.value,
    width="100%",
    _focus={
        "border_color": Color.PRIMARY.value,
    },
)

filter_select_style = dict(
    background=Color.CONTENT.value,
    border="1px solid",
    border_color=Color.SECONDARY.value,
    color=TextColor.HEADER.value,
)

form_input_style = dict(
    background=Color.CONTENT.value,
    border="1px solid",
    border_color=Color.SECONDARY.value,
    color=TextColor.HEADER.value,
    width="100%",
    _focus={
        "border_color": Color.PRIMARY.value,
    },
)

primary_button_style = dict(
    background=Color.PRIMARY.value,
    color=TextColor.HEADER.value,
    padding_x="1.5em",
    padding_y="0.6em",
    border_radius="0.5em",
    font_weight=FontWeight.MEDIUM.value,
    cursor="pointer",
    _hover={
        "opacity": "0.85",
    },
)

streaming_link_style = dict(
    background=Color.SECONDARY.value,
    color=TextColor.HEADER.value,
    padding_x="1em",
    padding_y="0.5em",
    border_radius="0.5em",
    font_size=Size.MEDIUM.value,
    _hover={
        "background": Color.PRIMARY.value,
    },
)

track_row_style = dict(
    width="100%",
    padding_y="0.5em",
    border_bottom="1px solid",
    border_color=Color.SECONDARY.value,
)

stat_box_style = dict(
    background=Color.CONTENT.value,
    border="1px solid",
    border_color=Color.SECONDARY.value,
    border_radius="0.8em",
    padding="1.2em 1.5em",
    text_align="center",
    flex="1",
    min_width="140px",
)