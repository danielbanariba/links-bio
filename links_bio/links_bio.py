import reflex as rx 
from links_bio.components.navbar import navbar
from links_bio.views.header.header import header
from links_bio.views.links.links import links
from links_bio.components.footer import footer

class State(rx.State):
    pass

# tiene que ser si o si un index, para que la pagina principal funcione
def index() -> rx.Component:
    return rx.vstack(
        navbar(),
        header(),
        links(),
        footer()
    )

# Compila la app y la ejecuta 
app = rx.App()
app.add_page(index)
app.compile()


# Ideas para la pagina de Arsenal de Odio
# Upload: para que la gente pueda subir imagenes y videos de los eventos de arsenal de odio 
# Link: https://reflex.dev/docs/library/forms/upload/