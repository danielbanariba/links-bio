from enum import Enum

#TODO poner los colores de mi pagina
class Color(Enum):
    PRIMARY = "#463564" 
    SECONDARY = "#262335" # Color de los botones al pasar el mouse
    BACKGROUND = "#09080d" # Color de fondo
    CONTENT = "#151d27" # Color de los botones
    
    

class TextColor(Enum):
    HEADER = "#f1f1f1"
    BODY = "#9ca4ab"
    FOOTER = "#9ca4ab"
    
    


class LogoColor(Enum):
    PARENTESIS = "#fede5a"
    PALABRAS = "#c94992"
    PUNTO_Y_COMA = "#fede5a"