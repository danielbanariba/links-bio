import reflex as rx
import links_bio.views.links.url_social as URL 
from links_bio.components.link_button import link_button
from links_bio.components.link_video import link_video
from links_bio.components.title import title
from links_bio.styles.styles import Size 

def links() -> rx.Component:
    return rx.vstack(
        title("Redes Sociales"),
        link_button(
            "Youtube", 
            "Canal de musica extrema", 
            "icons/youtube.svg",
            URL.YOUTUBE
        ),
        link_button(
            "Instagram", 
            "Fotos de mis viajes y aventuras",
            "icons/instagram.svg",
            URL.INSTAGRAM
        ),
        link_button(
            "Facebook",
            "Perfil de Facebook para contactarme",
            "icons/facebook.svg",
            URL.FACEBOOK 
        ),
        link_button(
            "Github",
            "Repositorio de mis proyectos",
            "icons/git.svg",
            URL.GITHUB
        ),
        link_button(
            "Linkedin",
            "Perfil de Linkedin",
            "icons/linkedin.svg",
            URL.LINKEDIN 
        ),
        # TODO Aqui tiene que aparecer una preview de los videos de youtube, tambien poner las mejores escenas de los videos
        title("Proyectos audiovisuales"),
        link_video(
            "Blasfemia - Inmaculada Concepción",
            "Blasfemia es una banda de Brutal Death Metal originaria de Tegucigalpa, Honduras.",
            "img_video/blasfemia.jpg",
            "https://youtu.be/S8CuyCYvYlE?si=KQ6PR6aBp-aKE54v"
        ),
        # link_video(#TODO perzonalizar esto para que salga el video y una miniatura del video
        #     "Blasfemia",
        #     "Blasfemia - Inmaculada Concepción",
        #     "https://youtu.be/S8CuyCYvYlE?si=KQ6PR6aBp-aKE54v"
        # ),
        # link_button(
        #     "Sobreporrosis",
        #     "Sobreporrosis - Acá no es Party Sesiones",
        #     "https://youtu.be/vE5s7QdB95I?si=MnHJZYRI59OFVecq"
        # ),
        title("Contacto"),
        link_button(#TODO aqui no seria un boton, tengo que poner literal el correro electronico
            "Email",
            URL.EMAIL,
            "icons/email.svg",
            f"mailto:{URL.EMAIL}"
        ),
        width="100%",
        spacing=Size.DEFAULT.value,
    )