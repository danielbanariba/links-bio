from enum import Enum

class Color(Enum):
    PRIMARY = "#0073a8" #Puede ser el ff6abf, Pero estoy en duda
    SECONDARY = "#022b44" #Hover color, al pasar el mouse
    BACKGROUND = "#09080d" #ESTA EXCELENTE, NO CAMBIAR!
    CONTENT = "#0a121f" #Botones y el header
    LOGO_CANAL = "#908986"

class TextColor(Enum):
    HEADER = "#fff8ee"
    BODY = "#ccc6be"
    FOOTER = "#99948e"
    
class LogoColor(Enum): 
    PUNTO_Y_COMA = "#bbbbbb"
    PALABRAS = "#c398f4"
    PARENTESIS = "#f1d700"
    