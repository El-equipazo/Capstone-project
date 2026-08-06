"""
user_model — data access for the users table.

The Python/asyncpg analogue of userModel.js:
  - one module per resource, thin functions over the pool helpers
  - password_hash is NEVER returned; it's only ever read inside
  validate_password and update (for password changes)
  - auth key is `email` (this schema has no username column)

Password hashing uses passlib bcrypt, matching seed.py. Keep BCRYPT_ROUNDS in
sync with whatever the rest of the stack uses so hashes stay portable.
"""

import secrets

from passlib.context import CryptContext

from server.db import connection_pool as pool
from . import email_client
from .enums import USER_ROLE
from .errors import AuthenticationError, ConflictError, DeactivatedError, ValidationError
from .validators import check_enum

BCRYPT_ROUNDS = 12  # set explicitly; align with any other hasher in the stack
pwd_context = CryptContext(
    schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=BCRYPT_ROUNDS,
)

VERIFICATION_TOKEN_TTL_INTERVAL = "24 hours"

# Columns safe to expose. password_hash and verification_token are deliberately excluded.
_PUBLIC_COLS = (
    "user_id, email, role, is_email_verified, is_active, "
    "last_login_at, created_at, updated_at"
)


def _new_verification_token() -> str:
    return secrets.token_urlsafe(32)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


async def create(email: str, password: str, role: str):
    """
    Register a user. Returns the public row (no password_hash), plus a
    verification_token field -- but only when send_verification_email()
    couldn't actually mail it (no RESEND_API_KEY configured, or the send
    failed), in which case it's surfaced directly in the response instead.
    A real deployment with email configured never exposes it here at all.
    Raises ValidationError on bad role, ConflictError on duplicate email.
    """
    check_enum(role, USER_ROLE, "role")
    password_hash = hash_password(password)
    token = _new_verification_token()
    try:
        row = await pool.fetchrow(
            f"""
            INSERT INTO users (email, password_hash, role, verification_token, verification_token_expires_at)
            VALUES ($1, $2, $3, $4, NOW() + INTERVAL '{VERIFICATION_TOKEN_TTL_INTERVAL}')
            RETURNING {_PUBLIC_COLS}, verification_token
            """,
            email, password_hash, role, token,
        )
    except Exception as e:
        # asyncpg raises UniqueViolationError (subclass); check SQLSTATE 23505.
        if getattr(e, "sqlstate", None) == "23505":
            raise ConflictError("email already registered") from e
        raise

    result = dict(row)
    if await email_client.send_verification_email(email, token):
        result["verification_token"] = None
    return result


async def verify_email(token: str):
    """
    Consume a verification token: sets is_email_verified = true and clears
    the token so it can't be reused. Raises ValidationError (-> 400) if the
    token doesn't match any user or has expired.
    """
    row = await pool.fetchrow(
        f"""
        UPDATE users
        SET is_email_verified = true, verification_token = NULL,
            verification_token_expires_at = NULL, updated_at = NOW()
        WHERE verification_token = $1 AND verification_token_expires_at > NOW()
        RETURNING {_PUBLIC_COLS}
        """,
        token,
    )
    if row is None:
        raise ValidationError(
            "invalid or expired verification token",
            field="token", issue="invalid_or_expired",
        )
    return row


async def find(user_id: int):
    """Return the public row for a user_id, or None."""
    return await pool.fetchrow(
        f"SELECT {_PUBLIC_COLS} FROM users WHERE user_id = $1", user_id
    )


async def find_by_email(email: str):
    """Return the public row for an email, or None (used to check availability)."""
    return await pool.fetchrow(
        f"SELECT {_PUBLIC_COLS} FROM users WHERE email = $1", email
    )


async def update(user_id: int, updates: dict) -> dict:
    """
    Update mutable fields on a user (email and/or password). Returns the
    public row, plus verification_token when the email changed AND
    send_verification_email() couldn't actually mail it -- see create()'s
    docstring for why. Fields are handled explicitly rather than looped
    over, so an unrelated key like `current_password` can never be mistaken
    for a column.

    Raises ValidationError (-> 400) if a new password is given without the
    correct current_password, ConflictError (-> 409) on a duplicate email.
    """
    set_parts: dict = {}
    extra_clauses: list[str] = []

    if "password" in updates:
        row = await pool.fetchrow(
            "SELECT password_hash FROM users WHERE user_id = $1", user_id
        )
        current_password = updates.get("current_password") or ""
        if row is None or not pwd_context.verify(current_password, row["password_hash"]):
            raise ValidationError(
                "current password is incorrect",
                field="current_password", issue="incorrect",
            )
        set_parts["password_hash"] = hash_password(updates["password"])

    if "email" in updates:
        set_parts["email"] = updates["email"]
        set_parts["is_email_verified"] = False
        set_parts["verification_token"] = _new_verification_token()
        extra_clauses.append(
            f"verification_token_expires_at = NOW() + INTERVAL '{VERIFICATION_TOKEN_TTL_INTERVAL}'"
        )

    if not set_parts:
        return await find(user_id)

    keys = list(set_parts.keys())
    vals = [set_parts[k] for k in keys]
    clauses = ", ".join([f"{k} = ${i + 2}" for i, k in enumerate(keys)] + extra_clauses)
    # verification_token is only selected back when an email change actually
    # issued one -- a password-only update must never leak a standing token.
    returning_cols = _PUBLIC_COLS + (", verification_token" if "email" in updates else "")

    try:
        row = await pool.fetchrow(
            f"""
            UPDATE users SET {clauses}, updated_at = NOW()
            WHERE user_id = $1
            RETURNING {returning_cols}
            """,
            user_id, *vals,
        )
    except Exception as e:
        if getattr(e, "sqlstate", None) == "23505":
            raise ConflictError("email already registered") from e
        raise

    result = dict(row)
    if "email" in updates:
        if await email_client.send_verification_email(updates["email"], set_parts["verification_token"]):
            result["verification_token"] = None
    return result


async def validate_password(email: str, password: str):
    """
    Verify a password. Returns {user_id, email, role} on success.

    Raises AuthenticationError (-> 401) for an unknown email or wrong
    password, and DeactivatedError (-> 403) for a correct password against a
    deactivated account. The is_active check happens AFTER password
    verification on purpose: returning 403 before verifying the password
    would leak which accounts exist and their active state to an attacker.

    This is the ONLY function that reads password_hash.
    """
    row = await pool.fetchrow(
        "SELECT user_id, email, role, password_hash, is_active "
        "FROM users WHERE email = $1",
        email,
    )
    # Unknown email or wrong password -> indistinguishable 401.
    if row is None or not pwd_context.verify(password, row["password_hash"]):
        raise AuthenticationError("invalid email or password")
    # Correct password, but the account has been soft-deactivated -> 403.
    if not row["is_active"]:
        raise DeactivatedError("account is deactivated")
    return {"user_id": row["user_id"], "email": row["email"], "role": row["role"]}


async def touch_last_login(user_id: int):
    """Set last_login_at = NOW() after a successful login."""
    await pool.query(
        "UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE user_id = $1",
        user_id,
    )


async def deactivate(user_id: int):
    """Soft-delete: is_active = false (DELETE /auth/me). Returns the public row."""
    return await pool.fetchrow(
        f"""
        UPDATE users SET is_active = false, updated_at = NOW()
        WHERE user_id = $1
        RETURNING {_PUBLIC_COLS}
        """,
        user_id,
    )