"""
connection_model — connection_requests + match_scoring_factors.

Shows three patterns the thinner models don't need:
  1. Translating the DB unique partial index violation into a clean 409.
  2. Writing all match factors in ONE transaction so the DEFERRED weight-sum
     trigger validates at COMMIT (API contract §6 guarantee).
  3. A guarded status transition (pending -> accepted/declined only).
"""

from server.db import connection_pool as pool
from .enums import CONNECTION_STATUS, ENGAGEMENT_TYPE, ORG_STATED_TIMELINE
from .errors import ConflictError, NotFoundError, TransitionError, ValidationError
from .validators import check_enum


async def create(*, org_id, expert_id, initiated_by_user_id,
                 initial_message=None, org_stated_need=None,
                 org_stated_timeline=None, match_score=None,
                 expires_at=None, factors=None):
    """
    Create a pending connection request and (optionally) its scoring factors,
    atomically. org_stated_need may be None ("not sure").

    `factors` is a list of dicts: {factor_name, weight, raw_score,
    weighted_contribution?}. If given, weights must sum to ~1.00 or the DB
    trigger aborts the whole transaction at COMMIT.
    """
    check_enum(org_stated_need, ENGAGEMENT_TYPE, "org_stated_need", allow_none=True)
    check_enum(org_stated_timeline, ORG_STATED_TIMELINE, "org_stated_timeline",
               allow_none=True)

    try:
        async with pool.transaction() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO connection_requests (
                    org_id, expert_id, initiated_by_user_id, status,
                    initial_message, org_stated_need, org_stated_timeline,
                    match_score, expires_at
                ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8)
                RETURNING *
                """,
                org_id, expert_id, initiated_by_user_id,
                initial_message, org_stated_need, org_stated_timeline,
                match_score, expires_at,
            )
            if factors:
                await conn.executemany(
                    """
                    INSERT INTO match_scoring_factors (
                        connection_id, factor_name, weight, raw_score, weighted_contribution
                    ) VALUES ($1, $2, $3, $4, $5)
                    """,
                    [
                        (row["connection_id"], f["factor_name"], f["weight"],
                         f["raw_score"], f.get("weighted_contribution"))
                        for f in factors
                    ],
                )
            # Trigger fires here at COMMIT if factors were inserted.
            return row
    except Exception as e:
        state = getattr(e, "sqlstate", None)
        if state == "23505":  # unique_violation -> open request already exists
            raise ConflictError(
                "an open connection request to this expert already exists"
            ) from e
        if state == "P0001":  # raise_exception from the weight-sum trigger
            raise ValidationError(
                "match factor weights must sum to 1.00",
                field="factors", issue="weight_sum",
            ) from e
        raise


async def get(connection_id: int):
    row = await pool.fetchrow(
        "SELECT * FROM connection_requests WHERE connection_id = $1", connection_id
    )
    if row is None:
        raise NotFoundError("connection request not found")
    return row


async def list_for_org(org_id: int, *, status=None):
    if status is not None:
        check_enum(status, CONNECTION_STATUS, "status")
        return await pool.fetch(
            "SELECT * FROM connection_requests WHERE org_id = $1 AND status = $2 "
            "ORDER BY created_at DESC",
            org_id, status,
        )
    return await pool.fetch(
        "SELECT * FROM connection_requests WHERE org_id = $1 ORDER BY created_at DESC",
        org_id,
    )


async def list_for_expert(expert_id: int, *, status=None):
    if status is not None:
        check_enum(status, CONNECTION_STATUS, "status")
        return await pool.fetch(
            "SELECT * FROM connection_requests WHERE expert_id = $1 AND status = $2 "
            "ORDER BY created_at DESC",
            expert_id, status,
        )
    return await pool.fetch(
        "SELECT * FROM connection_requests WHERE expert_id = $1 ORDER BY created_at DESC",
        expert_id,
    )


async def get_score_factors(connection_id: int):
    return await pool.fetch(
        "SELECT factor_name, weight, raw_score, weighted_contribution "
        "FROM match_scoring_factors WHERE connection_id = $1 ORDER BY factor_id",
        connection_id,
    )


async def respond(connection_id: int, new_status: str):
    """
    Expert accepts/declines. Only valid from 'pending'. Sets responded_at.
    Raises TransitionError (-> 422) if not currently pending.
    Note: 'expired' is set by a scheduled job, never here.
    """
    if new_status not in ("accepted", "declined"):
        raise ValidationError(
            "status must be 'accepted' or 'declined'",
            field="status", issue="invalid_response",
        )
    row = await pool.fetchrow(
        """
        UPDATE connection_requests
        SET status = $2, responded_at = NOW()
        WHERE connection_id = $1 AND status = 'pending'
        RETURNING *
        """,
        connection_id, new_status,
    )
    if row is None:
        # Either missing or not pending; disambiguate for the caller.
        existing = await pool.fetchrow(
            "SELECT status FROM connection_requests WHERE connection_id = $1",
            connection_id,
        )
        if existing is None:
            raise NotFoundError("connection request not found")
        raise TransitionError(
            f"cannot respond to a request in '{existing['status']}' state"
        )
    return row