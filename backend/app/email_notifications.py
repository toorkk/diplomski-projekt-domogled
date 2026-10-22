import logging
import os
import requests

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def send_error_email(subject: str, body: str) -> bool:
    """
    Pošlje email z napako prek Resend API (HTTPS, ker Railway Hobby blokira odhodni SMTP).
    Če RESEND_API_KEY ali ALERT_EMAIL_TO nista nastavljena, se email ne pošlje.
    """
    api_key = os.environ.get("RESEND_API_KEY")
    to_email = os.environ.get("ALERT_EMAIL_TO")
    # onboarding@resend.dev deluje brez lastne domene, vendar samo za pošiljanje na email Resend računa
    from_email = os.environ.get("ALERT_EMAIL_FROM", "Domogled <onboarding@resend.dev>")

    if not api_key or not to_email:
        logger.warning("RESEND_API_KEY ali ALERT_EMAIL_TO ni nastavljen, email z napako ni bil poslan.")
        return False

    try:
        response = requests.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "from": from_email,
                "to": [email.strip() for email in to_email.split(",")],
                "subject": subject,
                "text": body,
            },
            timeout=15,
        )
        response.raise_for_status()
        logger.info(f"Email z napako poslan na {to_email}")
        return True
    except Exception as e:
        # napaka pri pošiljanju ne sme prekiniti posodabljanja
        logger.error(f"Napaka pri pošiljanju emaila: {e}")
        return False
