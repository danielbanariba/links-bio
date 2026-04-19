import reflex as rx
from links_bio.state import AppState


def t(en: str, es: str) -> rx.Component:
    """Return the text in the current language."""
    return rx.cond(AppState.language == "en", en, es)
