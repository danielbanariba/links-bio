import reflex as rx
from links_bio.components.link_button import link_button
from links_bio.components.title import title
from links_bio.styles.styles import Size as Size

def links() -> rx.Component:
    return rx.vstack(
        # TODO agregar mis links de mis redes sociales
        title("Redes Sociales"),
        link_button(
            "Youtube", 
            "Canal de musica extrema", 
            "https://www.youtube.com/channel/UCa5U18nMgHUsqg-zsE1779Q"
        ),
        link_button(
            "Instagram", 
            "Fotos de mis viajes y aventuras", 
            "https://www.instagram.com/danielbanariba/"
        ),
        link_button(
            "Facebook",
            "Perfil de Facebook para contactarme",
            "https://www.facebook.com/profile.php?id=100063668491929"
        ),
        link_button(
            "Github",
            "Repositorio de mis proyectos",
            "https://github.com/danielbanariba"
        ),
        link_button(
            "Linkedin",
            "Perfil de Linkedin",
            "https://www.linkedin.com/in/danielbanariba/"
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
        width="100%",
        spacing=Size.MEDIUM.value
    )