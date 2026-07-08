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


class NotFoundError(ModelError):
    """Missing resource -> 404."""


class TransitionError(ModelError):
    """Illegal status transition -> 422."""