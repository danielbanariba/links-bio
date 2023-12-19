import reflex as rx
from links_bio.views.links.url_social import Url as URL
from links_bio.components.link_button import link_button
from links_bio.components.title import title
from links_bio.styles.styles import Size 

def links() -> rx.Component:
    return rx.vstack(
        title("Redes Sociales"),
        link_button(
            "Youtube", 
            "Canal de musica extrema", 
            "icons/youtube.svg",
            str(URL.YOUTUBE.value)
        ),
        link_button(
            "Instagram", 
            "Fotos de mis viajes y aventuras",
            "icons/youtube.svg", #TODO cambiar el icono por el de instagram 
            str(URL.INSTAGRAM.value)
        ),
        link_button(
            "Facebook",
            "Perfil de Facebook para contactarme",
            "icons/youtube.svg",
            str(URL.FACEBOOK.value) #TODO buscar el svg de facebook
        ),
        link_button(
            "Github",
            "Repositorio de mis proyectos",
            "icons/git.svg",
            str(URL.GITHUB.value)
        ),
        link_button(
            "Linkedin",
            "Perfil de Linkedin",
            "icons/linkedin.svg",
            str(URL.LINKEDIN.value) #TODO cambiar el icono por el de linkedin
        ),
        # TODO Aqui tiene que aparecer una preview de los videos de youtube, tambien poner las mejores escenas de los videos
        title("Proyectos audiovisuales"),
        #TODO perzonalizar esto para que salga el video y una miniatura del video
        # link_button(
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
            str(URL.EMAIL),
            "icons/email.svg",
            f"mailto:{URL.EMAIL}"
        ),
        width="100%",
        spacing=Size.DEFAULT.value,
    )