"""Email notifications for form submissions and sync alerts.

Extracted from the legacy links_bio.states.form_state module so FastAPI (and,
later, the sync/deploy timer) can send notification emails without importing
reflex. links_bio.states.form_state re-imports `_send_email_notification`
from here so its legacy FormState class keeps working unchanged.
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
