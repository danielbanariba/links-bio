import logging
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import reflex as rx
from sqlmodel import select
from links_bio.models.submission import Submission
from links_bio.models.newsletter import NewsletterSubscriber
from links_bio.models.contact_message import ContactMessage

logger = logging.getLogger("form_state")


def _send_email_notification(subject: str, body: str) -> str | None:
    """Send email notification via Gmail SMTP. Returns error string or None."""
    gmail_address = os.environ.get("GMAIL_ADDRESS", "")
    gmail_app_password = os.environ.get("GMAIL_APP_PASSWORD", "")

    if not gmail_address or not gmail_app_password:
        return "GMAIL_ADDRESS o GMAIL_APP_PASSWORD no configurados"

    msg = MIMEMultipart()
    msg["From"] = gmail_address
    msg["To"] = gmail_address
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain", "utf-8"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(gmail_address, gmail_app_password)
            server.send_message(msg)
        logger.info(f"Email enviado: {subject}")
        return None
    except Exception as e:
        logger.error(f"Error enviando email: {e}")
        return str(e)


class FormState(rx.State):
    """State for form submissions."""

    # Submission form
    submission_success: bool = False
    submission_error: str = ""

    # Newsletter
    newsletter_success: bool = False
    newsletter_error: str = ""

    # Contact/Promo form
    contact_success: bool = False
    contact_error: str = ""

    # Promo form: dynamic links
    promo_extra_links: list[str] = []

    # Promo form: custom genre
    promo_show_custom_genre: bool = False

    @rx.event
    def add_promo_link(self):
        if len(self.promo_extra_links) < 5:
            self.promo_extra_links = self.promo_extra_links + [""]

    @rx.event
    def remove_promo_link(self, index: int):
        self.promo_extra_links = [
            v for i, v in enumerate(self.promo_extra_links) if i != index
        ]

    @rx.event
    def set_promo_genre(self, value: str):
        self.promo_show_custom_genre = value == "Otro"

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

        band_name = form_data.get("band_name", "").strip()
        email = form_data.get("email", "").strip()
        album_title = form_data.get("album_title", "").strip()

        if not band_name or not email or not album_title:
            self.contact_error = "Por favor completa todos los campos obligatorios."
            return

        # Genre: custom or selected
        genre = form_data.get("custom_genre", "").strip()
        if not genre:
            genre = form_data.get("genre", "").strip()
        if not genre:
            self.contact_error = "Por favor selecciona un genero."
            return

        country = form_data.get("country", "").strip()
        year = form_data.get("year", "").strip()
        release_format = form_data.get("release_format", "").strip()

        # Collect all links
        links = []
        for key in ["youtube_url", "bandcamp_url"]:
            url = form_data.get(key, "").strip()
            if url:
                links.append(url)
        # Extra links
        for key, val in form_data.items():
            if key.startswith("extra_link_") and val.strip():
                links.append(val.strip())

        if not links:
            self.contact_error = "Por favor agrega al menos un link."
            return

        # Save to DB
        try:
            with rx.session() as session:
                contact = ContactMessage(
                    name=band_name,
                    email=email,
                    company=genre,
                    message=album_title,
                    package_interest=release_format,
                )
                session.add(contact)
                session.commit()
        except Exception:
            self.contact_error = "Error al enviar. Intenta de nuevo."
            return

        # Send email notification
        links_text = "\n".join(f"  - {l}" for l in links)
        email_body = (
            f"Nueva solicitud de subida al Metal Archive\n"
            f"{'=' * 50}\n\n"
            f"Banda: {band_name}\n"
            f"Email: {email}\n"
            f"Genero: {genre}\n"
            f"Pais: {country}\n"
            f"Ano: {year}\n"
            f"Formato: {release_format}\n"
            f"Album: {album_title}\n\n"
            f"Links:\n{links_text}\n"
        )
        email_error = _send_email_notification(
            subject=f"Metal Archive: {band_name} - {album_title}",
            body=email_body,
        )
        if email_error:
            self.contact_error = f"Guardado pero error al enviar email: {email_error}"
            return

        # Reset extra links
        self.promo_extra_links = []
        self.promo_show_custom_genre = False
        self.contact_success = True
