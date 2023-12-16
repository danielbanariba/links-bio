import reflex as rx

def header() -> rx.Component:
    return rx.vstack(
        rx.avatar(name="Daniel Banariba", size="xl"),
        rx.text("@danibanariba"),
        rx.text("Hola! 👀 mi nombre es Daniel Banariba!"),
        rx.text("""Soy estudiante de la carrera de ingenieria en sistemas computaciones en la una 
                Universidad Nacional Autonoma de Honduras (UNAH) y soy un apasionado por la programacion
                y todo el mundo de la tecnologia, me gusta aprender cosas nuevas!""")
        
    )