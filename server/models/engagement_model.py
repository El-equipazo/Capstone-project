"""
engagement_model — data access for the engagements table.
"""
from __future__ import annotations

from datetime import date

from server.db import connection_pool as pool
from .enums import ENGAGEMENT_STATUS, ENGAGEMENT_TYPE, PAYMENT_STRUCTURE
from .errors import ConflictError, NotFoundError, TransitionError
from .validators import check_enum

_TERMINAL = {"completed", "cancelled"}
_MUTABLE_FIELDS = {
    "title", "description", "engagement_type", "payment_structure", "agreed_budget",
    "start_date", "estimated_end_date", "cancellation_reason", "proposal_feedback",
}
_VALID_TRANSITIONS: dict[tuple[str, str], set[str]] = {
    ("scoping", "proposal_sent"):           {"expert"},
    ("proposal_sent", "scoping"):           {"organization"},   # org requests revised timeline
    ("proposal_sent", "proposal_accepted"): {"organization"},
    ("proposal_accepted", "active"):        {"expert", "organization"},
    ("active", "on_hold"):                  {"expert", "organization"},
    ("on_hold", "active"):                  {"expert", "organization"},
    ("active", "completed"):                {"expert"},
}


async def create(
    connection_id: int,
    org_id: int,
    expert_id: int,
    engagement_type: str,
    title: str = None,
    description: str = None,
    payment_structure: str = None,
    agreed_budget=None,
    start_date=None,
    estimated_end_date=None,
) -> dict:
    check_enum(engagement_type, ENGAGEMENT_TYPE, "engagement_type")
    check_enum(payment_structure, PAYMENT_STRUCTURE, "payment_structure", allow_none=True)

    try:
        row = await pool.fetchrow(
            """
            INSERT INTO engagements (
                connection_id, org_id, expert_id, engagement_type, title,
                description, payment_structure, agreed_budget, start_date,
                estimated_end_date, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'scoping')
            RETURNING *
            """,
            connection_id, org_id, expert_id, engagement_type, title,
            description, payment_structure, agreed_budget, start_date,
            estimated_end_date,
        )
    except Exception as e:
        state = getattr(e, "sqlstate", None)
        if state == "23505":  # unique_violation on connection_id (1:1 with engagements)
            raise ConflictError(
                "an engagement already exists for this connection"
            ) from e
        raise
    return dict(row)


def _check_list_filters(status: str = None, engagement_type: str = None) -> None:
    check_enum(status, ENGAGEMENT_STATUS, "status", allow_none=True)
    check_enum(engagement_type, ENGAGEMENT_TYPE, "engagement_type", allow_none=True)


async def list_for_expert(expert_id: int, *, status: str = None, engagement_type: str = None,
                          caller_user_id: int = None) -> list:
    """Return engagements for an expert, with org_name and unread message count joined in."""
    _check_list_filters(status, engagement_type)
    params = [expert_id]
    where = "e.expert_id = $1"
    if status is not None:
        params.append(status)
        where += f" AND e.status = ${len(params)}"
    if engagement_type is not None:
        params.append(engagement_type)
        where += f" AND e.engagement_type = ${len(params)}"

    if caller_user_id is not None:
        params.append(caller_user_id)
        unread_sql = f"""(
            SELECT COUNT(*) FROM messages m
            WHERE m.engagement_id = e.engagement_id
              AND m.is_read = false AND m.sender_id != ${len(params)}
        ) AS unread_count"""
    else:
        unread_sql = "0 AS unread_count"

    rows = await pool.fetch(
        f"""
        SELECT e.engagement_id, e.connection_id, e.org_id, e.expert_id,
               e.engagement_type, e.title, e.description, e.status,
               e.agreed_budget, e.payment_structure,
               e.start_date, e.estimated_end_date, e.actual_end_date,
               e.created_at, e.updated_at,
               op.org_name,
               {unread_sql}
        FROM engagements e
        JOIN organization_profiles op ON op.org_profile_id = e.org_id
        WHERE {where}
        ORDER BY e.created_at DESC
        """,
        *params,
    )
    return [dict(r) for r in rows]


async def list_for_org(org_id: int, *, status: str = None, engagement_type: str = None,
                       caller_user_id: int = None) -> list:
    _check_list_filters(status, engagement_type)
    params = [org_id]
    where = "e.org_id = $1"
    if status is not None:
        params.append(status)
        where += f" AND e.status = ${len(params)}"
    if engagement_type is not None:
        params.append(engagement_type)
        where += f" AND e.engagement_type = ${len(params)}"

    if caller_user_id is not None:
        params.append(caller_user_id)
        unread_sql = f"""(
            SELECT COUNT(*) FROM messages m
            WHERE m.engagement_id = e.engagement_id
              AND m.is_read = false AND m.sender_id != ${len(params)}
        ) AS unread_count"""
    else:
        unread_sql = "0 AS unread_count"

    rows = await pool.fetch(
        f"""
        SELECT e.engagement_id, e.connection_id, e.org_id, e.expert_id,
               e.engagement_type, e.title, e.description, e.status,
               e.agreed_budget, e.payment_structure,
               e.start_date, e.estimated_end_date, e.actual_end_date,
               e.created_at, e.updated_at,
               ep.first_name AS expert_first_name, ep.last_name AS expert_last_name,
               ep.headline AS expert_headline,
               {unread_sql}
        FROM engagements e
        JOIN expert_profiles ep ON ep.expert_profile_id = e.expert_id
        WHERE {where}
        ORDER BY e.created_at DESC
        """,
        *params,
    )
    return [dict(r) for r in rows]


async def get(engagement_id: int) -> dict:
    row = await pool.fetchrow(
        "SELECT * FROM engagements WHERE engagement_id = $1",
        engagement_id,
    )
    if row is None:
        raise NotFoundError("engagement not found")
    return dict(row)


async def get_with_milestones(engagement_id: int) -> dict:
    row = await pool.fetchrow(
        """
        SELECT e.*,
               op.org_name, op.sector AS org_sector, op.country AS org_country,
               op.is_verified AS org_is_verified,
               ep.first_name AS expert_first_name, ep.last_name AS expert_last_name,
               ep.headline AS expert_headline, ep.is_verified AS expert_is_verified
        FROM engagements e
        JOIN organization_profiles op ON op.org_profile_id = e.org_id
        JOIN expert_profiles ep ON ep.expert_profile_id = e.expert_id
        WHERE e.engagement_id = $1
        """,
        engagement_id,
    )
    if row is None:
        raise NotFoundError("engagement not found")
    eng = dict(row)
    milestone_rows = await pool.fetch(
        "SELECT * FROM engagement_milestones WHERE engagement_id = $1 ORDER BY order_index ASC, created_at ASC",
        engagement_id,
    )
    eng["milestones"] = [dict(r) for r in milestone_rows]
    return eng


async def is_participant(engagement_id: int, user_id: int) -> tuple[bool, str | None, int | None]:
    """Returns (is_participant, role, profile_id). Raises NotFoundError if engagement missing."""
    row = await pool.fetchrow(
        """
        SELECT e.org_id, e.expert_id,
               op.user_id AS org_user_id, ep.user_id AS expert_user_id
        FROM engagements e
        JOIN organization_profiles op ON op.org_profile_id = e.org_id
        JOIN expert_profiles ep ON ep.expert_profile_id = e.expert_id
        WHERE e.engagement_id = $1
        """,
        engagement_id,
    )
    if row is None:
        raise NotFoundError("engagement not found")
    if row["org_user_id"] == user_id:
        return True, "organization", row["org_id"]
    if row["expert_user_id"] == user_id:
        return True, "expert", row["expert_id"]
    return False, None, None


async def update(engagement_id: int, caller_role: str, updates: dict) -> dict:
    existing = await get(engagement_id)
    set_parts: dict = {}

    new_status = updates.get("status")
    if new_status is not None:
        old = existing["status"]
        if old in _TERMINAL:
            raise TransitionError(f"engagement is already {old}")
        if new_status == "cancelled":
            pass  # either participant can cancel any non-terminal engagement
        else:
            key = (old, new_status)
            if key not in _VALID_TRANSITIONS:
                raise TransitionError(f"cannot transition from '{old}' to '{new_status}'")
            if caller_role not in _VALID_TRANSITIONS[key]:
                allowed = "/".join(sorted(_VALID_TRANSITIONS[key]))
                raise TransitionError(f"only {allowed} can make this transition")
        set_parts["status"] = new_status
        if new_status == "completed":
            set_parts["actual_end_date"] = date.today()

    for field in _MUTABLE_FIELDS:
        if field in updates:
            set_parts[field] = updates[field]

    if not set_parts:
        return existing

    keys = list(set_parts.keys())
    vals = [set_parts[k] for k in keys]
    clauses = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(keys))

    row = await pool.fetchrow(
        f"UPDATE engagements SET {clauses}, updated_at = NOW() WHERE engagement_id = $1 RETURNING *",
        engagement_id, *vals,
    )

    if new_status == "completed":
        await pool.query(
            "UPDATE expert_profiles SET total_completed_engagements = total_completed_engagements + 1 WHERE expert_profile_id = $1",
            existing["expert_id"],
        )

    return dict(row)
