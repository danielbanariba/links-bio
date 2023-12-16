import reflex as rx
import datetime

def footer() -> rx.Component:
    return rx.vstack(
        rx.image(src="favicon.ico", width=50, height=50),
        rx.link(
            f"2023-{datetime.datetime.today().year} © Daniel Banariba", 
            href="www.danibanariba.com",
            is_external=True)
    )