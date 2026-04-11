"""Email delivery for user feedback reports."""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

from core.config import get_settings

logger = logging.getLogger(__name__)


def send_feedback_email(
    subject: str,
    page: str,
    description: str,
    user_email: str | None,
    sender_name: str | None,
    attachments: list[tuple[str, bytes]] | None = None,
) -> bool:
    """Send feedback email via SMTP. Runs in background thread.

    Args:
        subject: User-provided issue headline
        page: Page where issue occurs (dashboard, portfolio, etc.)
        description: Detailed issue description
        user_email: Optional contact email
        sender_name: Display name of the logged-in user
        attachments: List of (filename, file_bytes) tuples
    """
    settings = get_settings()

    smtp_host = settings.smtp_host
    smtp_port = settings.smtp_port
    smtp_user = settings.smtp_user
    smtp_password = settings.smtp_password
    feedback_to = settings.feedback_email

    if not all([smtp_host, smtp_user, smtp_password, feedback_to]):
        logger.error("SMTP not configured — cannot send feedback email")
        return False

    msg = MIMEMultipart()
    msg["From"] = f"Zumfi Finance <{smtp_user}>"
    msg["To"] = feedback_to
    msg["Subject"] = f"Finance: {subject}"
    if user_email:
        msg["Reply-To"] = user_email

    body_lines = [
        f"Page: {page}",
        f"Subject: {subject}",
        "",
    ]
    if sender_name:
        body_lines.insert(0, f"Reported by: {sender_name}")
    if user_email:
        body_lines.insert(1, f"Contact email: {user_email}")
    body_lines += [
        "--- Description ---",
        description,
    ]
    body = "\n".join(body_lines)
    msg.attach(MIMEText(body, "plain", "utf-8"))

    if attachments:
        for filename, file_bytes in attachments:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(file_bytes)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f'attachment; filename="{filename}"')
            msg.attach(part)

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        logger.info(f"Feedback email sent: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send feedback email: {e}")
        return False
