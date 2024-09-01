import reflex as rx 
import links_bio.styles.styles as styles
from links_bio.components.navbar import navbar
from links_bio.views.header.header import header
from links_bio.views.links.links import links
from links_bio.components.footer import footer
from links_bio.styles.styles import Size

def index() -> rx.Component:
    return rx.box(
        rx.script("document.documentElement.lang='es'"),
        navbar(),
        rx.center(
            rx.vstack(
                header(),
                links(),
                max_width=styles.MAX_WIDTH,
                width="100%",
                margin_y=Size.BIG.value,
                padding=Size.ZERO.value,
                id="/"
            )
        ),
        footer()
    )

# Inicializa la app
app = rx.App(
    stylesheets=styles.STYLESHEETS,
    style=styles.BASE_STYLE,
    # head_components=[
    #     #TODO agregar google analytics pero de mi perfil!
    #     rx.script(src=""),
    #     rx.script(
    #         """
    #         window.dataLayer = window.dataLayer || [];
    #         function gtag(){dataLayer.push(arguments);}
    #         gtag('js', new Date());
    #         gtag('config', ''); #TODO agregar el id de google analytics, en las comillas
    #         """
    #     ),
    # ],
)

app.add_page(
    index,
    title="Daniel Banariba | Desarrollador de Software y edición de videos",
    description="Hola! mi nombre es Daniel Alejandro Barrientos Anariba soy un programador amante de la tecnologia, el cine y la música.",
    image="avatar.jpeg"
)