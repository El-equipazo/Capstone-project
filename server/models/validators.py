"""
Reusable validation helpers. Each raises ValidationError with field-level
detail so the API layer can build the standard error envelope (§1.1).
Models call these before touching the DB.
"""

from .errors import ValidationError


def check_enum(value, allowed, field, *, allow_none=False):
    """Membership check against a canonical enum set (see enums.py)."""
    if value is None:
        if allow_none:
            return
        raise ValidationError(f"{field} is required", field=field, issue="required")
    if value not in allowed:
        raise ValidationError(
            f"{field} must be one of: {', '.join(sorted(allowed))}",
            field=field, issue="invalid_enum_value",
        )


def check_rate_range(rate_min, rate_max):
    """expert_profiles.hourly_rate_min must be <= hourly_rate_max."""
    if rate_min is not None and rate_max is not None and rate_min > rate_max:
        raise ValidationError(
            "hourly_rate_min must be <= hourly_rate_max",
            field="hourly_rate_min", issue="must be <= hourly_rate_max",
        )


def check_rating(value, field):
    """Any *_rating column: SMALLINT 1-5 (or NULL for optional sub-ratings)."""
    if value is None:
        return
    # bool is a subclass of int, so `isinstance(True, int)` is True and
    # `1 <= True <= 5` holds -- a JSON `true` would silently validate as 1.
    # Exclude bool explicitly.
    if isinstance(value, bool) or not isinstance(value, int) or not (1 <= value <= 5):
        raise ValidationError(
            f"{field} must be an integer between 1 and 5",
            field=field, issue="out_of_range",
        )