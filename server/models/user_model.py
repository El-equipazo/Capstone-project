"""
user_model — data access for the users table.

The Python/asyncpg analogue of userModel.js:
  - one module per resource, thin functions over the pool helpers
  - password_hash is NEVER returned except inside validate_password
  - auth key is `email` (this schema has no username column)

Password hashing uses passlib bcrypt, matching seed.py. Keep BCRYPT_ROUNDS in
sync with whatever the rest of the stack uses so hashes stay portable.
"""

from passlib.context import CryptContext

from server.db import connection_pool as pool
from .enums import USER_ROLE
from .errors import ConflictError, ValidationError
from .validators import check_enum

BCRYPT_ROUNDS = 12  # set explicitly; align with any other hasher in the stack
pwd_context = CryptContext(
    schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=BCRYPT_ROUNDS,
)

# Columns safe to expose. password_hash is deliberately excluded.
_PUBLIC_COLS = (
    "user_id, email, role, is_email_verified, is_active, "
    "last_login_at, created_at, updated_at"
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


async def create(email: str, password: str, role: str):
    """
    Register a user. Returns the public row (no password_hash).
    Raises ValidationError on bad role, ConflictError on duplicate email.
    """
    check_enum(role, USER_ROLE, "role")
    password_hash = hash_password(password)
    try:
        return await pool.fetchrow(
            f"""
            INSERT INTO users (email, password_hash, role)
            VALUES ($1, $2, $3)
            RETURNING {_PUBLIC_COLS}
            """,
            email, password_hash, role,
        )
    except Exception as e:
        # asyncpg raises UniqueViolationError (subclass); check SQLSTATE 23505.
        if getattr(e, "sqlstate", None) == "23505":
            raise ConflictError("email already registered") from e
        raise


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


async def validate_password(email: str, password: str):
    """
    Verify a password. Returns {user_id, email, role} on success, else None.
    This is the ONLY function that reads password_hash.
    """
    row = await pool.fetchrow(
        "SELECT user_id, email, role, password_hash, is_active "
        "FROM users WHERE email = $1",
        email,
    )
    if row is None or not row["is_active"]:
        return None
    if not pwd_context.verify(password, row["password_hash"]):
        return None
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