from __future__ import annotations

from server.db import connection_pool as pool
from .errors import NotFoundError

_COLS = """
    milestone_id, engagement_id, proposed_by_user_id, proposed_by_role,
    title, description, order_index, due_date, deliverable_description,
    status, confirmed_by_expert_id, confirmed_at, completed_at,
    requires_client_approval, client_approved_at, created_at, updated_at
"""

_UPDATABLE = {
    "title", "description", "order_index", "due_date",
    "deliverable_description", "requires_client_approval", "status",
}


async def create(
    engagement_id: int,
    proposed_by_user_id: int,
    proposed_by_role: str,
    title: str,
    description: str = None,
    order_index: int = None,
    due_date=None,
    deliverable_description: str = None,
    requires_client_approval: bool = False,
) -> dict:
    if order_index is None:
        max_idx = await pool.fetchval(
            "SELECT COALESCE(MAX(order_index), 0) FROM engagement_milestones WHERE engagement_id = $1",
            engagement_id,
        )
        order_index = max_idx + 1

    row = await pool.fetchrow(
        f"""
        INSERT INTO engagement_milestones
            (engagement_id, proposed_by_user_id, proposed_by_role, title, description,
             order_index, due_date, deliverable_description, requires_client_approval, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'proposed')
        RETURNING {_COLS}
        """,
        engagement_id, proposed_by_user_id, proposed_by_role, title, description,
        order_index, due_date, deliverable_description, requires_client_approval,
    )
    return dict(row)


async def list_for_engagement(engagement_id: int) -> list:
    rows = await pool.fetch(
        f"SELECT {_COLS} FROM engagement_milestones WHERE engagement_id = $1 ORDER BY order_index ASC, created_at ASC",
        engagement_id,
    )
    return [dict(r) for r in rows]


async def get(milestone_id: int) -> dict:
    row = await pool.fetchrow(
        f"SELECT {_COLS} FROM engagement_milestones WHERE milestone_id = $1",
        milestone_id,
    )
    if row is None:
        raise NotFoundError("milestone not found")
    return dict(row)


async def update(milestone_id: int, **kwargs) -> dict:
    set_parts = {k: v for k, v in kwargs.items() if k in _UPDATABLE and v is not None}
    # Explicit False for booleans must also pass through
    for k in kwargs:
        if k in _UPDATABLE and kwargs[k] is False:
            set_parts[k] = False

    if not set_parts:
        return await get(milestone_id)

    keys = list(set_parts.keys())
    vals = [set_parts[k] for k in keys]
    clauses = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(keys))

    extra = ", completed_at = NOW()" if set_parts.get("status") == "completed" else ""

    row = await pool.fetchrow(
        f"UPDATE engagement_milestones SET {clauses}{extra}, updated_at = NOW() WHERE milestone_id = $1 RETURNING {_COLS}",
        milestone_id, *vals,
    )
    if row is None:
        raise NotFoundError("milestone not found")
    return dict(row)


async def confirm(milestone_id: int) -> dict:
    row = await pool.fetchrow(
        f"""
        UPDATE engagement_milestones
        SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
        WHERE milestone_id = $1
        RETURNING {_COLS}
        """,
        milestone_id,
    )
    if row is None:
        raise NotFoundError("milestone not found")
    return dict(row)


async def delete(milestone_id: int) -> None:
    await pool.query(
        "DELETE FROM engagement_milestones WHERE milestone_id = $1",
        milestone_id,
    )
