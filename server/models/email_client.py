"""
email_client — sends transactional email via Resend's HTTP API.

Mirrors ai_client.py's "optional external service" shape: without
RESEND_API_KEY configured, the send_*_email() functions are no-ops that
return False rather than raising. Callers fall back accordingly -- see
user_model.create()/update() (surface the token directly in the API
response) and user_model.request_password_reset() (log it instead, since a
reset token must never ride in an HTTP response -- see that docstring).

A plain httpx call rather than the official `resend` SDK, which is
synchronous (blocking) and would stall the event loop if awaited naively
from this async codebase.
"""

import logging

import httpx

from server.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


async def _send(to_email: str, subject: str, html: str) -> bool:
    """
    Shared send path for every transactional email this module sends.
    Best-effort -- returns False (never raises) if RESEND_API_KEY isn't
    configured or the send fails for any reason, since a failed email must
    never block whatever triggered it.
    """
    if not settings.resend_api_key:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={
                    "from": settings.resend_from_email,
                    "to": [to_email],
                    "subject": subject,
                    "html": html,
                },
            )
            response.raise_for_status()
            logger.warning("Sent email to %s: %r", to_email, subject)
            return True
    except httpx.HTTPStatusError as e:
        # Resend's response body names the actual problem (e.g. the sandbox
        # restriction that only delivers to your own account email until a
        # custom domain is verified) -- the bare status code alone hides that.
        logger.warning(
            "Resend rejected email to %s (%s): %s",
            to_email, e.response.status_code, e.response.text,
        )
        return False
    except Exception:
        logger.warning("Failed to send email to %s", to_email, exc_info=True)
        return False


async def send_verification_email(to_email: str, token: str) -> bool:
    link = f"{settings.frontend_url}/verify-email?token={token}"
    return await _send(
        to_email,
        "Verify your Lattice email address",
        (
            "<p>Confirm your email address to finish setting up your Lattice account.</p>"
            f'<p><a href="{link}">Verify email address</a></p>'
            "<p>Or paste this link into your browser:<br>"
            f'<a href="{link}">{link}</a></p>'
            "<p style=\"color:#6b6f76;font-size:13px\">"
            "This link expires in 24 hours. If you didn't create a Lattice account, "
            "you can ignore this email.</p>"
        ),
    )


async def send_password_reset_email(to_email: str, token: str) -> bool:
    link = f"{settings.frontend_url}/reset-password?token={token}"
    return await _send(
        to_email,
        "Reset your Lattice password",
        (
            "<p>We received a request to reset your Lattice password.</p>"
            f'<p><a href="{link}">Reset password</a></p>'
            "<p>Or paste this link into your browser:<br>"
            f'<a href="{link}">{link}</a></p>'
            "<p style=\"color:#6b6f76;font-size:13px\">"
            "This link expires in 1 hour. If you didn't request a password reset, "
            "you can ignore this email — your password won't be changed.</p>"
        ),
    )
