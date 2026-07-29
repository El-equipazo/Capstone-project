"""
ai_client — shared Gemini client singleton, used by ai_matching.py (expert
matching) and ai_verification.py (admin credential review). Both features are
optional: without GEMINI_API_KEY the server still runs fine, only the AI
endpoints answer 503.
"""

from server.config import settings

_client = None


class AIConfigurationError(Exception):
    """GEMINI_API_KEY missing — controllers map this to 503."""


class AIUnavailableError(Exception):
    """Gemini call failed — controllers map this to 502."""


def get_client():
    """Create the Gemini client once, on first use. Raises if unconfigured."""
    global _client
    if not settings.gemini_api_key:
        raise AIConfigurationError(
            "This AI feature requires GEMINI_API_KEY on the server"
        )
    if _client is None:
        from google import genai
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client
