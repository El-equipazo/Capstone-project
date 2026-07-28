"""
ai_verification — Gemini-assisted admin credential review
(POST /admin/verifications/:id/ai-review).

An admin manually triggers this on a pending `professional_credential`
verification. Gemini looks at the credential's claimed details AND the
actual submitted document files (images/PDFs, fetched server-side) and
produces an advisory recommendation + reasoning.

This is explicitly NOT an authoritative verification — no integration exists
with any credentialing body's registry (ISC2, PMI, university registrars,
...), so Gemini can only judge plausibility, internal consistency, and
visible signs of a fabricated document. The admin still makes the actual
approve/reject call; this just gives them a documented second opinion.

Unlike ai_matching.score_single() (silent/best-effort, since it's a
background side-effect of an unrelated action), this is a deliberate,
explicit admin action — failures are raised, not swallowed, so the admin
gets a clear error instead of silent nothing.
"""

import json
import mimetypes
from typing import List, Literal, Optional

from pydantic import BaseModel

from server.config import settings
from .ai_client import AIConfigurationError, AIUnavailableError, get_client

_FETCH_TIMEOUT_SECONDS = 10
_MAX_DOCUMENT_BYTES = 10 * 1024 * 1024  # 10MB
_ALLOWED_SCHEMES = {"http", "https"}


class CredentialAssessment(BaseModel):
    recommendation: Literal["approve", "reject", "needs_more_info"]
    confidence: Literal["low", "medium", "high"]
    reasoning: str          # 2–4 sentences, addressed to the admin
    red_flags: List[str]    # empty list if none


SYSTEM_PROMPT = """\
You are an assistant helping a marketplace admin review a quantum security
expert's submitted professional credential (e.g. a certification, degree,
publication, patent, or award). You are NOT an authoritative verifier — you
have no access to any credentialing body's registry (ISC2, PMI, a
university's registrar, etc.), so you can never confirm with certainty that
a credential is genuine.

What you CAN usefully do:
1. Assess plausibility — is this a real-sounding credential/institution, and
   does the claimed year/expiry timeline make sense?
2. Cross-check consistency — does the submitted document (if provided) match
   the claimed credential_name, institution, and year?
3. Look for visible signs a document may be fabricated or edited (inconsistent
   fonts/formatting, missing expected elements, obviously altered text) —
   note you are assessing an image/PDF, not doing forensic analysis.
4. Be explicit about what you cannot confirm, rather than implying certainty
   you don't have.

Rules:
- recommendation is your honest best guess: "approve" if it looks legitimate
  and consistent, "reject" if there are clear red flags (implausible
  credential, mismatched details, obvious fabrication), "needs_more_info" if
  you can't make a confident call either way (e.g. no document was submitted,
  or the document is illegible).
- confidence reflects how sure you are given the inherent limits above —
  rarely "high" without a document to examine.
- reasoning is 2-4 sentences addressed to the admin, explicitly noting what
  you could and couldn't assess.
- red_flags is a list of specific concerns; empty if none.
"""


def _guess_mime_type(url: str, content_type: Optional[str]) -> str:
    if content_type:
        return content_type.split(";")[0].strip()
    guessed, _ = mimetypes.guess_type(url)
    return guessed or "application/octet-stream"


async def _fetch_document(url: str) -> Optional[tuple[bytes, str]]:
    """Fetch one submitted document, best-effort. Returns (bytes, mime_type)
    or None if it can't be retrieved — a missing/broken document link
    shouldn't abort the whole review, just narrows what Gemini can assess."""
    from urllib.parse import urlparse
    import httpx

    scheme = urlparse(url).scheme.lower()
    if scheme not in _ALLOWED_SCHEMES:
        return None

    try:
        async with httpx.AsyncClient(timeout=_FETCH_TIMEOUT_SECONDS, follow_redirects=True) as client:
            async with client.stream("GET", url) as response:
                if response.status_code != 200:
                    return None
                chunks = bytearray()
                async for chunk in response.aiter_bytes():
                    chunks.extend(chunk)
                    if len(chunks) > _MAX_DOCUMENT_BYTES:
                        return None
                return bytes(chunks), _guess_mime_type(url, response.headers.get("content-type"))
    except (httpx.HTTPError, Exception):
        return None


def _default(value):
    return str(value)


async def review_credential(credential: dict, verification: dict) -> dict:
    """
    Assess one professional_credential verification. Raises
    AIConfigurationError/AIUnavailableError on failure — this is a deliberate
    admin-triggered action, so failures should surface clearly rather than
    be swallowed.
    """
    client = get_client()

    credential_context = {
        "credential_type": credential["credential_type"],
        "credential_name": credential["credential_name"],
        "institution": credential["institution"],
        "year_obtained": credential["year_obtained"],
        "expiry_date": credential["expiry_date"],
        "verification_url": credential["verification_url"],
    }

    document_urls = verification.get("submitted_document_urls") or []
    fetched = [await _fetch_document(url) for url in document_urls]
    fetched = [f for f in fetched if f is not None]

    from google.genai import errors as genai_errors, types

    header = "CLAIMED CREDENTIAL DETAILS:\n" + json.dumps(credential_context, default=_default)
    if not document_urls:
        header += "\n\nNo supporting document was submitted."
    elif not fetched:
        header += f"\n\n{len(document_urls)} document(s) were submitted but none could be retrieved."
    else:
        header += f"\n\n{len(fetched)} of {len(document_urls)} submitted document(s) follow:"

    contents = [header]
    for data, mime_type in fetched:
        contents.append(types.Part.from_bytes(data=data, mime_type=mime_type))

    try:
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=CredentialAssessment,
            ),
        )
    except genai_errors.APIError as e:
        raise AIUnavailableError(f"Gemini request failed: {e}") from e

    assessment = response.parsed
    if assessment is None:
        try:
            assessment = CredentialAssessment.model_validate(json.loads(response.text))
        except Exception as e:
            raise AIUnavailableError("Gemini returned an unparseable assessment") from e

    return {
        "recommendation": assessment.recommendation,
        "reasoning": assessment.reasoning,
        "confidence": assessment.confidence,
        "red_flags": assessment.red_flags,
    }
