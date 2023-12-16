import reflex as rx
from links_bio.components.link_button import link_button

def links() -> rx.Component:
    return rx.vstack(
        # TODO agregar mis links de mis redes sociales
        link_button("Youtube", "https://www.youtube.com/channel/UCa5U18nMgHUsqg-zsE1779Q"),
    )