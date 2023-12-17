import reflex as rx
from links_bio.styles.styles import Size as Size
from links_bio.components.info_text import info_text
from links_bio.components.link_icon import link_icon

def header() -> rx.Component:
    return rx.vstack(
        rx.hstack(# el hstack es para que el contenido apareza de forma horizontal
            rx.avatar(
                name="Daniel Banariba", 
                size="xl"
            ),
            rx.vstack(
                rx.heading(
                    "Daniel Banariba", 
                    size="lg"
                ),
                rx.text(
                    "@danibanariba",
                    margin_top="0px !important" 
                ),
                rx.hstack(
                    link_icon("dsfgfsfgfsfg") # TODO poner algun link
                ),
                spacing=Size.DEFAULT.value
            )
        ),
        
        rx.flex(
            info_text("+2", "Años de experiencia"),
            rx.spacer(),
            info_text("+2", "Años de experiencia"),
            rx.spacer(),
            info_text("+2", "Años de experiencia"),
            width="100%"
        ),
        
        
        rx.text(
            """Soy estudiante de la carrera de ingenieria en sistemas computaciones en la una 
            Universidad Nacional Autonoma de Honduras (UNAH) y soy un apasionado por la programacion
            y todo el mundo de la tecnologia, me gusta aprender cosas nuevas!"""
        ),
        spacing=Size.BIG.value,
        align_items="start"
    )