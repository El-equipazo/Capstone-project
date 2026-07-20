"""
organization_model — data access for organization_profiles (+ infrastructure).

Currently implements the READ paths the matching feature needs. The remaining
CRUD (create/update/upsert_infrastructure, called by the organizations
controller) is still to be written — until then, the module-level __getattr__
below keeps those endpoints answering 503 NOT_IMPLEMENTED instead of crashing
with an AttributeError.
"""

from server.db import connection_pool as pool
from .errors import NotFoundError, NotImplementedModelError


async def find_by_user(user_id: int):
    """Return the org profile row owned by a user, or None (1:1 with users)."""
    return await pool.fetchrow(
        "SELECT * FROM organization_profiles WHERE user_id = $1", user_id
    )


async def get(org_profile_id: int):
    """Return the org profile row, or raise NotFoundError (-> 404)."""
    row = await pool.fetchrow(
        "SELECT * FROM organization_profiles WHERE org_profile_id = $1",
        org_profile_id,
    )
    if row is None:
        raise NotFoundError("organization profile not found")
    return row


async def find_infrastructure(org_profile_id: int):
    """Return the org's infrastructure row, or None if never filled in."""
    return await pool.fetchrow(
        "SELECT * FROM organization_infrastructure WHERE org_id = $1",
        org_profile_id,
    )


async def get_infrastructure(org_profile_id: int):
    """Return the org's infrastructure row, or raise NotFoundError (-> 404)."""
    row = await find_infrastructure(org_profile_id)
    if row is None:
        raise NotFoundError("organization infrastructure not found")
    return row


def __getattr__(name):
    """Unwritten functions (create, update, upsert_infrastructure, ...) keep
    the old import-stub behavior: a clean 503 via NotImplementedModelError."""
    if name.startswith("__") and name.endswith("__"):
        raise AttributeError(name)  # dunders must fail normally (import machinery)

    async def _not_implemented(*args, **kwargs):
        raise NotImplementedModelError(
            f"organization_model.{name} not implemented yet"
        )
    return _not_implemented
