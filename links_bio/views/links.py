import reflex as rx
import links_bio.constants.url_social as URL
import links_bio.constants.images as IMG
from links_bio.components.link_button import link_button
from links_bio.components.link_video import link_video
from links_bio.components.title import title
from links_bio.styles.styles import Size
from links_bio.components.link_proyects import link_proyects

def links() -> rx.Component:
    return rx.vstack(
        # title("Proyectos de Programación"),
        # link_proyects(#title: str, body: str, image: str, url: str, image_icon: str
        #     "Pagina oficial de Arsenal de Odio",
        #     "Arsenal De Odio es una banda de Thrash Metal de Honduras, que usando el lenguaje de programación Python y la librería Reflex se pudo plasmar su espíritu como banda en la pagina web. Aquí se puede encontrar todo relacionado con la banda, sus integrantes, discografía, mercadería, etc.",
        #     "img_proyect/arsenal_website.jpg",
        #     "https://arsenaldeodio.reflex.run/",
        # ),
        title("Proyectos audiovisuales"),
        link_video(
            "Blasfemia - Inmaculada Concepción",
            "Blasfemia es una banda de Brutal Death Metal originario de Tegucigalpa, Honduras.",
            IMG.LOGO_BLASFEMIA,
            "50%",
            IMG.IMG_BLASFEMIA,
            "https://youtu.be/S8CuyCYvYlE?si=KQ6PR6aBp-aKE54v",
        ),
        link_video(
            "Sobreporrosis - Acá no es Party Sesiones",
            "Sobreporrosis es una banda de Punk Rock originario de Tegucigalpa, Honduras.",
            IMG.LOGO_SOBREPORROSIS,
            "70%",
            IMG.IMG_SOBREPORROSIS,
            "https://youtu.be/vE5s7QdB95I?si=KntI0wqkG7Qj3XVF",
        ),
        link_video(
            "Lesath - El Enviado de Satán",
            "Lesath es una banda de Death Metal Melódico originario de Tegucigalpa, Honduras.",
            IMG.LOGO_LESATH,
            "30%",
            IMG.IMG_LESATH,
            "https://youtu.be/EAZR_GLTHyw",
        ),
        link_video(
            "Desmembramiento - Maldita Enfermedad",
            "Desmembramiento es una banda de Death Metal originario de Tegucigalpa, Honduras.",
            IMG.LOGO_DESMEMBRAMIENTO,
            "70%",
            IMG.IMG_DESMEMBRAMIENTO,
            "https://youtu.be/lvH-dy-Gn0Y",
        ),
        link_video(
            "Krisis - Johd Ass",
            "Krisis es una banda de Grind/Death metal originario de San Pedro Sula, Honduras.",
            IMG.LOGO_KRISIS,
            "50%",
            IMG.IMG_KRISIS,
            "https://youtu.be/548LqsbFhSw"
        ),
        #TODO Aqui o en la primera parte van a ir mis proyectos de programación
        title("Contacto"),
        link_button(
            "Email",
            URL.EMAIL,
            IMG.ICON_EMAIL,
            f"mailto:{URL.EMAIL}"
        ),
        width="100%",
        spacing=Size.DEFAULT_SPACING.value,
        padding_right=Size.BIG.value,
        padding_left=Size.BIG.value,
    )