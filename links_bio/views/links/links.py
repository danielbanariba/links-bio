import reflex as rx
from links_bio.components.link_button import link_button
from links_bio.components.title import title
from links_bio.styles.styles import Size as Size
from links_bio.views.links.url_social import Url as URL

def links() -> rx.Component:
    return rx.vstack(
        title("Redes Sociales"),
        link_button(
            "Youtube", 
            "Canal de musica extrema", 
            URL.YOUTUBE.value
        ),
        link_button(
            "Instagram", 
            "Fotos de mis viajes y aventuras", 
            URL.INSTAGRAM.value
        ),
        link_button(
            "Facebook",
            "Perfil de Facebook para contactarme",
            URL.FACEBOOK.value
        ),
        link_button(
            "Github",
            "Repositorio de mis proyectos",
            URL.GITHUB.value
        ),
        link_button(
            "Linkedin",
            "Perfil de Linkedin",
            URL.LINKEDIN.value
        ),
        # TODO Aqui tiene que aparecer una preview de los videos de youtube, tambien poner las mejores escenas de los videos
        title("Proyectos audiovisuales"),
        link_button(
            "Blasfemia",
            "Blasfemia - Inmaculada Concepción",
            "https://youtu.be/S8CuyCYvYlE?si=KQ6PR6aBp-aKE54v"
        ),
        link_button(
            "Sobreporrosis",
            "Sobreporrosis - Acá no es Party Sesiones",
            "https://youtu.be/vE5s7QdB95I?si=MnHJZYRI59OFVecq"
        ),
        title("Contacto"),
        link_button(#TODO aqui no seria un boton, tengo que poner literal el correro electronico
            "Email",
            URL.EMAIL.value,
            f"{URL.EMAIL.value}"
        ),
        width="100%",
        spacing=Size.MEDIUM.value
    )