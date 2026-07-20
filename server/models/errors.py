"""
Model-layer exceptions. The API layer maps these to HTTP status codes
(see the API contract §1.2) without models needing to know about HTTP.
"""


class ModelError(Exception):
    """Base class."""


class ValidationError(ModelError):
    """Bad input -> 400. Carries optional field-level detail."""
    def __init__(self, message, field=None, issue=None):
        super().__init__(message)
        self.field = field
        self.issue = issue


class ConflictError(ModelError):
    """Uniqueness / duplicate -> 409."""


class AuthenticationError(ModelError):
    """Unknown email or wrong password -> 401. Message is deliberately
    generic so it doesn't reveal whether the email exists."""


class DeactivatedError(ModelError):
    """Correct credentials but the account is deactivated -> 403."""


class NotFoundError(ModelError):
    """Missing resource -> 404."""


class GoneError(ModelError):
    """Resource once existed but is no longer accessible -> 410.
    Used for expired connection requests (§6) and revoked/expired
    document downloads (§8)."""


class TransitionError(ModelError):
    """Illegal status transition -> 422."""


class NotImplementedModelError(ModelError):
    """Model function not written yet -> 503. Raised by the module-level
    __getattr__ guards in organization_model/expert_model so endpoints whose
    data layer isn't built keep returning a clean 503 (same behavior as the
    old controller import stubs) instead of a 500 AttributeError."""