import reflex as rx
from sqlmodel import select
from links_bio.models.submission import Submission
from links_bio.models.newsletter import NewsletterSubscriber
from links_bio.models.contact_message import ContactMessage


class FormState(rx.State):
    """State for form submissions."""

    # Submission form
    submission_success: bool = False
    submission_error: str = ""

    # Newsletter
    newsletter_success: bool = False
    newsletter_error: str = ""

    # Contact form
    contact_success: bool = False
    contact_error: str = ""

    @rx.event
    def handle_submission(self, form_data: dict):
        self.submission_success = False
        self.submission_error = ""

        band_name = form_data.get("band_name", "").strip()
        contact_email = form_data.get("contact_email", "").strip()
        genre = form_data.get("genre", "").strip()
        country = form_data.get("country", "").strip()

        if not band_name or not contact_email or not genre or not country:
            self.submission_error = "Por favor completa todos los campos obligatorios."
            return

        try:
            with rx.session() as session:
                submission = Submission(
                    band_name=band_name,
                    contact_email=contact_email,
                    genre=genre,
                    country=country,
                    album_title=form_data.get("album_title", "").strip(),
                    youtube_url=form_data.get("youtube_url", "").strip(),
                    bandcamp_url=form_data.get("bandcamp_url", "").strip(),
                    description=form_data.get("description", "").strip(),
                )
                session.add(submission)
                session.commit()
        except Exception:
            self.submission_error = "Error al guardar. Intenta de nuevo."
            return

        self.submission_success = True

    @rx.event
    def handle_newsletter_signup(self, form_data: dict):
        self.newsletter_success = False
        self.newsletter_error = ""

        email = form_data.get("email", "").strip()
        if not email or "@" not in email:
            self.newsletter_error = "Por favor ingresa un email valido."
            return

        try:
            with rx.session() as session:
                existing = session.exec(
                    select(NewsletterSubscriber).where(
                        NewsletterSubscriber.email == email
                    )
                ).first()
                if existing:
                    self.newsletter_error = "Este email ya esta suscrito."
                    return

                subscriber = NewsletterSubscriber(email=email)
                session.add(subscriber)
                session.commit()
        except Exception:
            self.newsletter_error = "Error al suscribir. Intenta de nuevo."
            return

        self.newsletter_success = True

    @rx.event
    def handle_contact_form(self, form_data: dict):
        self.contact_success = False
        self.contact_error = ""

        name = form_data.get("name", "").strip()
        email = form_data.get("email", "").strip()
        message = form_data.get("message", "").strip()

        if not name or not email or not message:
            self.contact_error = "Por favor completa todos los campos obligatorios."
            return

        try:
            with rx.session() as session:
                contact = ContactMessage(
                    name=name,
                    email=email,
                    company=form_data.get("company", "").strip(),
                    message=message,
                    package_interest=form_data.get("package_interest", "").strip(),
                )
                session.add(contact)
                session.commit()
        except Exception:
            self.contact_error = "Error al enviar. Intenta de nuevo."
            return

        self.contact_success = True
