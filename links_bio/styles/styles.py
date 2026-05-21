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
ALBUM_DETAIL_MAX_WIDTH = "1800px"

XEROX_NOISE_URL = (
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' "
    "width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' "
    "baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E"
    "%3Crect width='160' height='160' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")"
)

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

SKELETON_PULSE_CSS = """
@keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.7; }
}
.animate-pulse {
    animation: pulse 1.5s ease-in-out infinite;
}
"""

track_row_clickable_style = dict(
    width="100%",
    padding_y="0.55em",
    padding_x="0.4em",
    border_bottom="1px solid",
    border_color=Color.SECONDARY.value,
    cursor="pointer",
    border_radius="0.3em",
    _hover={
        "background": Color.SECONDARY.value,
    },
)

track_row_active_style = dict(
    width="100%",
    padding_y="0.55em",
    padding_x="0.4em",
    border_bottom="1px solid",
    border_color=Color.SECONDARY.value,
    cursor="pointer",
    border_radius="0.3em",
    background=f"{Color.PRIMARY.value}22",
)

player_column_left_style = dict(
    width=rx.breakpoints(initial="100%", md="40%"),
    flex_shrink="0",
    spacing="4",
    min_width="0",
)

player_column_right_style = dict(
    width=rx.breakpoints(initial="100%", md="60%"),
    spacing="4",
    min_width="0",
    flex="1",
)

# Spotify-style album detail redesign tokens

hero_section_style = {
    "position": "relative",
    "width": "100vw",
    "margin_left": "calc(50% - 50vw)",
    "margin_right": "calc(50% - 50vw)",
    "padding_top": rx.breakpoints(initial="1.5em", md="2.5em"),
    "padding_bottom": "1.2em",
    "background": f"linear-gradient(180deg, {Color.SECONDARY.value} 0%, {Color.SECONDARY.value}80 35%, {Color.BACKGROUND.value} 100%)",
    "transition": "background 0.6s ease",
    "border_bottom": f"2px solid {Color.PRIMARY.value}",
    "border_radius": "0",
    "overflow": "hidden",
    "isolation": "isolate",
}

hero_inner_style = {
    "max_width": ALBUM_DETAIL_MAX_WIDTH,
    "margin": "0 auto",
    "padding_x": rx.breakpoints(initial="1.2em", md="2.5em", lg="3em"),
    "width": "100%",
}

hero_cover_style = dict(
    width=rx.breakpoints(initial="180px", sm="220px", md="280px"),
    height=rx.breakpoints(initial="180px", sm="220px", md="280px"),
    object_fit="cover",
    border_radius="2px",
    box_shadow="0 12px 32px rgba(0,0,0,0.6), 0 6px 14px rgba(0,0,0,0.5)",
    border=f"1px solid {Color.PRIMARY.value}55",
)

hero_release_type_style = dict(
    font_family=Font.DEFAULT.value,
    font_size=rx.breakpoints(initial="0.7em", md="0.78em"),
    color=Color.PRIMARY.value,
    letter_spacing="0.22em",
    text_transform="uppercase",
    font_weight="600",
)

hero_band_name_style = dict(
    font_family=Font.DEFAULT.value,
    font_size="clamp(2.2em, 7vw, 5em)",
    font_weight="900",
    color=TextColor.HEADER.value,
    line_height="0.95",
    letter_spacing="-0.035em",
    margin="0",
)

hero_album_title_style = dict(
    font_family=Font.TITLE.value,
    font_size=rx.breakpoints(initial="1.1em", md="1.5em"),
    color=TextColor.HEADER.value,
    font_weight="500",
    line_height="1.2",
    letter_spacing="-0.01em",
)

hero_meta_style = dict(
    color=TextColor.BODY.value,
    font_size=rx.breakpoints(initial="0.85em", md="0.95em"),
    font_weight=FontWeight.LIGHT.value,
)

play_button_circle_style = dict(
    background=Color.PRIMARY.value,
    width=rx.breakpoints(initial="56px", md="64px"),
    height=rx.breakpoints(initial="56px", md="64px"),
    border_radius="50%",
    display="flex",
    align_items="center",
    justify_content="center",
    cursor="pointer",
    color=TextColor.HEADER.value,
    border="none",
    padding="0",
    box_shadow="0 6px 16px rgba(0,0,0,0.45)",
    transition="transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease",
    _hover={
        "transform": "scale(1.06)",
        "box_shadow": f"0 8px 22px {Color.PRIMARY.value}80",
    },
)

icon_button_ghost_style = dict(
    background="transparent",
    color=TextColor.FOOTER.value,
    width="40px",
    height="40px",
    border_radius="2px",
    display="flex",
    align_items="center",
    justify_content="center",
    cursor="pointer",
    border=f"1px solid {Color.SECONDARY.value}",
    padding="0",
    font_size="1.1em",
    transition="color 0.15s ease, background 0.15s ease, border-color 0.15s ease",
    _hover={
        "color": TextColor.HEADER.value,
        "background": f"{Color.PRIMARY.value}22",
        "border_color": Color.PRIMARY.value,
    },
)

track_table_header_style = dict(
    display="grid",
    grid_template_columns="40px 1fr 80px",
    column_gap="1em",
    padding_y="0.55em",
    padding_x="0.9em",
    border_bottom=f"1px solid {Color.PRIMARY.value}55",
    color=TextColor.FOOTER.value,
    font_size="0.72em",
    letter_spacing="0.18em",
    text_transform="uppercase",
    font_weight=FontWeight.MEDIUM.value,
    align_items="center",
)

track_table_row_style = dict(
    display="grid",
    grid_template_columns="40px 1fr 80px",
    column_gap="1em",
    padding_y="0.65em",
    padding_x="0.9em",
    border_radius="2px",
    cursor="pointer",
    align_items="center",
    transition="background 0.12s ease, color 0.12s ease",
)

track_active_classname = "track-active"

now_playing_bar_style = dict(
    position="fixed",
    bottom="0",
    left="0",
    right="0",
    height=rx.breakpoints(initial="72px", md="72px"),
    background=Color.CONTENT.value,
    border_top=f"2px solid {Color.PRIMARY.value}",
    display="flex",
    align_items="center",
    padding_x=rx.breakpoints(initial="0.8em", md="1.5em"),
    z_index="100",
    box_shadow="0 -4px 16px rgba(0,0,0,0.55)",
)

mini_player_style = dict(
    position="fixed",
    bottom=rx.breakpoints(initial="88px", md="96px"),
    left="20px",
    width="240px",
    height="135px",
    border_radius="2px",
    border=f"1px solid {Color.PRIMARY.value}",
    overflow="hidden",
    z_index="50",
    box_shadow="0 8px 24px rgba(0,0,0,0.65)",
    background="#000",
    display=rx.breakpoints(initial="none", md="block"),
    transition="width 0.3s ease, height 0.3s ease",
)

album_detail_scroll_buffer = "120px"