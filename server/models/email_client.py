"""
email_client — sends transactional email via Resend's HTTP API.

Mirrors ai_client.py's "optional external service" shape: without
RESEND_API_KEY configured, send_verification_email() is a no-op that
returns False rather than raising, so callers (user_model.create()/update())
can fall back to surfacing the token directly in the API response instead
of mailing it -- which is also how local dev works without an account.

A plain httpx call rather than the official `resend` SDK, which is
synchronous (blocking) and would stall the event loop if awaited naively
from this async codebase.
"""

import logging

import httpx

from server.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


async def send_verification_email(to_email: str, token: str) -> bool:
    """
    Best-effort — returns False (never raises) if RESEND_API_KEY isn't
    configured or the send fails for any reason, since a failed email must
    never block registration/email-change itself.
    """
    if not settings.resend_api_key:
        return False

    link = f"{settings.frontend_url}/verify-email?token={token}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={
                    "from": settings.resend_from_email,
                    "to": [to_email],
                    "subject": "Verify your Lattice email address",
                    "html": (
                        "<p>Confirm your email address to finish setting up your Lattice account.</p>"
                        f'<p><a href="{link}">Verify email address</a></p>'
                        "<p>Or paste this link into your browser:<br>"
                        f'<a href="{link}">{link}</a></p>'
                        "<p style=\"color:#6b6f76;font-size:13px\">"
                        "This link expires in 24 hours. If you didn't create a Lattice account, "
                        "you can ignore this email.</p>"
                    ),
                },
            )
            response.raise_for_status()
            return True
    except Exception:
        logger.warning("Failed to send verification email to %s", to_email, exc_info=True)
        return False
