from __future__ import annotations

from server.db import connection_pool as pool
from .errors import NotFoundError, TransitionError
from .validators import check_not_past

_COLS = """
    milestone_id, engagement_id, proposed_by_user_id, proposed_by_role,
    title, description, order_index, due_date, deliverable_description,
    status, confirmed_by_expert_id, confirmed_at, completed_at,
    requires_client_approval, client_approved_at,
    pending_action, pending_due_date, pending_deliverable_description,
    pending_requested_by_user_id, pending_requested_at,
    created_at, updated_at
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
    check_not_past(due_date, "due_date")
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
    check_not_past(kwargs.get("due_date"), "due_date")
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


# -- ORG-PROPOSED CHANGES ------------------------------------------------------
# A milestone has at most one outstanding org-proposed change at a time
# (pending_action: NULL | 'change' | 'cancel'), which the expert must
# accept/decline before it takes effect. Upsert semantics throughout --
# re-proposing before the expert responds simply overwrites the prior one.

async def propose_change(milestone_id: int, user_id: int, *,
                         due_date=None, deliverable_description: str = None) -> dict:
    check_not_past(due_date, "due_date")
    row = await pool.fetchrow(
        f"""
        UPDATE engagement_milestones
        SET pending_action = 'change',
            pending_due_date = $2,
            pending_deliverable_description = $3,
            pending_requested_by_user_id = $4,
            pending_requested_at = NOW(),
            updated_at = NOW()
        WHERE milestone_id = $1
        RETURNING {_COLS}
        """,
        milestone_id, due_date, deliverable_description, user_id,
    )
    if row is None:
        raise NotFoundError("milestone not found")
    return dict(row)


async def propose_cancel(milestone_id: int, user_id: int) -> dict:
    row = await pool.fetchrow(
        f"""
        UPDATE engagement_milestones
        SET pending_action = 'cancel',
            pending_due_date = NULL,
            pending_deliverable_description = NULL,
            pending_requested_by_user_id = $2,
            pending_requested_at = NOW(),
            updated_at = NOW()
        WHERE milestone_id = $1
        RETURNING {_COLS}
        """,
        milestone_id, user_id,
    )
    if row is None:
        raise NotFoundError("milestone not found")
    return dict(row)


async def accept_pending(milestone_id: int) -> dict:
    m = await get(milestone_id)
    if m["pending_action"] is None:
        raise TransitionError("No pending change to accept")

    if m["pending_action"] == "change":
        row = await pool.fetchrow(
            f"""
            UPDATE engagement_milestones
            SET due_date = COALESCE($2, due_date),
                deliverable_description = COALESCE($3, deliverable_description),
                pending_action = NULL, pending_due_date = NULL,
                pending_deliverable_description = NULL,
                pending_requested_by_user_id = NULL, pending_requested_at = NULL,
                updated_at = NOW()
            WHERE milestone_id = $1
            RETURNING {_COLS}
            """,
            milestone_id, m["pending_due_date"], m["pending_deliverable_description"],
        )
    else:  # 'cancel'
        row = await pool.fetchrow(
            f"""
            UPDATE engagement_milestones
            SET status = 'skipped',
                pending_action = NULL, pending_due_date = NULL,
                pending_deliverable_description = NULL,
                pending_requested_by_user_id = NULL, pending_requested_at = NULL,
                updated_at = NOW()
            WHERE milestone_id = $1
            RETURNING {_COLS}
            """,
            milestone_id,
        )
    return dict(row)


async def decline_pending(milestone_id: int) -> dict:
    m = await get(milestone_id)
    if m["pending_action"] is None:
        raise TransitionError("No pending change to decline")

    row = await pool.fetchrow(
        f"""
        UPDATE engagement_milestones
        SET pending_action = NULL, pending_due_date = NULL,
            pending_deliverable_description = NULL,
            pending_requested_by_user_id = NULL, pending_requested_at = NULL,
            updated_at = NOW()
        WHERE milestone_id = $1
        RETURNING {_COLS}
        """,
        milestone_id,
    )
    return dict(row)


async def delete(milestone_id: int) -> None:
    await pool.query(
        "DELETE FROM engagement_milestones WHERE milestone_id = $1",
        milestone_id,
    )
