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
                padding=Size.ZERO.value
            )
        ),
        footer()
    )


# Compila la app y la ejecuta 
app = rx.App(
    stylesheets=styles.STYLESHEETS,
    style=styles.BASE_STYLE,
    head_components=[
        rx.script(src="https://www.googletagmanager.com/gtag/js?id=G-3YGHT3XJFS"),
        rx.script(
            """
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-3YGHT3XJFS');
            """
        ),
    ],
)
app.add_page(index,
    title="Daniel Banariba | Desarrollador de Software y edición de videos",
    description="Hola!, mi nombre es Daniel Banariba. Soy programador amante de la tecnologia, el cine y la música.",
    image="avatar.jpeg")
app.compile()


# Ideas para la pagina de Arsenal de Odio
# Upload: para que la gente pueda subir imagenes y videos de los eventos de arsenal de odio 
# Link: https://reflex.dev/docs/library/forms/upload/