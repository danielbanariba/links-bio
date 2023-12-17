import reflex as rx 
from links_bio.components.navbar import navbar
from links_bio.views.header.header import header
from links_bio.views.links.links import links
from links_bio.components.footer import footer
from links_bio.styles import styles
from links_bio.styles.styles import Size as Size

class State(rx.State):
    pass

# tiene que ser si o si un index, para que la pagina principal funcione
def index() -> rx.Component:
    return rx.box(
        navbar(),
        rx.center(
            rx.vstack(
                header(),
                links(),
                max_width=styles.MAX_WIDTH,
                width="100%",
                margin_y=Size.BIG.value
            )
        ),
        footer()
    )


# Compila la app y la ejecuta 
app = rx.App(
    style=styles.BASE_STYLE
)
app.add_page(index)
app.compile()


# Ideas para la pagina de Arsenal de Odio
# Upload: para que la gente pueda subir imagenes y videos de los eventos de arsenal de odio 
# Link: https://reflex.dev/docs/library/forms/upload/