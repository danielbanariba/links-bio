"""Email notifications for form submissions and sync alerts.

Originally extracted from the legacy links_bio.states.form_state module (now
deleted, along with the rest of the Reflex UI) so notification emails could
be sent without importing reflex. `_send_email_notification` is used by
links_bio.fastapi_forms (form submission alerts) and scripts/notify_failure.py
(sync/deploy failure alerts).
"""

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger("notifications")


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
