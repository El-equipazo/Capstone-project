"""
connection_model — connection_requests + match_scoring_factors.

Shows three patterns the thinner models don't need:
  1. Translating the DB unique partial index violation into a clean 409.
  2. Writing all match factors in ONE transaction so the DEFERRED weight-sum
     trigger validates at COMMIT (API contract §6 guarantee).
  3. A guarded status transition (pending -> accepted/declined only).
"""

from server.db import connection_pool as pool
from .enums import (
    ConnectionStatus, CONNECTION_STATUS, ENGAGEMENT_TYPE, ORG_STATED_TIMELINE,
)
from .errors import (
    ConflictError, GoneError, NotFoundError, TransitionError, ValidationError,
)
from .validators import check_enum


async def create(*, org_id, expert_id, initiated_by_user_id,
                 initial_message=None, org_stated_need=None,
                 org_stated_timeline=None, match_score=None,
                 expiry_days=None, factors=None):
    """
    Create a pending connection request and (optionally) its scoring factors,
    atomically. org_stated_need may be None ("not sure").

    `expiry_days` comes from the org's default_connection_expiry_days; the
    deadline is computed as NOW() + expiry_days ON THE DB CLOCK so it compares
    cleanly against the NOW() guards in respond()/expire_stale() (columns are
    naive TIMESTAMPs — mixing in a Python-side clock invites skew).

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
                ) VALUES ($1, $2, $3, $9, $4, $5, $6, $7,
                          CASE WHEN $8::int IS NULL THEN NULL
                               ELSE NOW() + make_interval(days => $8::int) END)
                RETURNING *
                """,
                org_id, expert_id, initiated_by_user_id,
                initial_message, org_stated_need, org_stated_timeline,
                match_score, expiry_days, ConnectionStatus.PENDING,
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


async def list_requests(*, org_id=None, expert_id=None, status=None,
                        page=1, limit=20):
    """
    Filterable, paginated listing. All filters optional and AND-ed — the
    controller forces org_id/expert_id to the caller's own profile for
    non-admins and passes both through for admins (contract §6 filters).
    Returns (rows, total_items) for the §1.3 pagination envelope.
    """
    if status is not None:
        check_enum(status, CONNECTION_STATUS, "status")

    where, args = [], []
    for col, val in (("cr.org_id", org_id), ("cr.expert_id", expert_id), ("cr.status", status)):
        if val is not None:
            args.append(val)
            where.append(f"{col} = ${len(args)}")
    clause = (" WHERE " + " AND ".join(where)) if where else ""

    total = await pool.fetchval(
        f"""SELECT COUNT(*)
            FROM connection_requests cr
            JOIN organization_profiles op ON op.org_profile_id = cr.org_id
            {clause}""",
        *args,
    )
    rows = await pool.fetch(
        f"""SELECT cr.*,
                   op.org_name, op.sector AS org_sector, op.sub_sector,
                   op.org_description, op.employee_count_range,
                   op.country, op.website, op.quantum_knowledge_level,
                   op.budget_range, op.urgency_level,
                   op.is_verified AS org_is_verified,
                   op.contact_name, op.contact_title
            FROM connection_requests cr
            JOIN organization_profiles op ON op.org_profile_id = cr.org_id
            {clause}
            ORDER BY cr.created_at DESC
            LIMIT ${len(args) + 1} OFFSET ${len(args) + 2}""",
        *args, limit, (page - 1) * limit,
    )
    return rows, total


async def expire_stale():
    """
    Flip lapsed pending requests to 'expired' (§6: clients never set it).
    Idempotent; called opportunistically at the top of the POST/GET endpoints
    in lieu of a scheduler — this also frees the pending-unique index so a
    time-expired request can't cause a spurious 409 on a new one. A future
    cron job can call this too.
    """
    await pool.query(
        "UPDATE connection_requests SET status = $1 "
        "WHERE status = $2 AND expires_at IS NOT NULL AND expires_at < NOW()",
        ConnectionStatus.EXPIRED, ConnectionStatus.PENDING,
    )


async def get_score_factors(connection_id: int):
    return await pool.fetch(
        "SELECT factor_name, weight, raw_score, weighted_contribution "
        "FROM match_scoring_factors WHERE connection_id = $1 ORDER BY factor_id",
        connection_id,
    )


async def respond(connection_id: int, new_status: str):
    """
    Expert accepts/declines. Only valid from 'pending' AND not past
    expires_at. Sets responded_at. 'expired' is set by a scheduled job,
    never here.

    Raises:
      ValidationError (400) if new_status isn't accepted/declined
      NotFoundError   (404) if the request doesn't exist
      GoneError       (410) if the request has expired -- whether the
                            scheduler already flipped it to 'expired' or it's
                            merely past expires_at while still 'pending'
      TransitionError (422) for any other non-pending state (already
                            accepted/declined)
    """
    if new_status not in (ConnectionStatus.ACCEPTED, ConnectionStatus.DECLINED):
        raise ValidationError(
            f"status must be '{ConnectionStatus.ACCEPTED}' or "
            f"'{ConnectionStatus.DECLINED}'",
            field="status", issue="invalid_response",
        )
    # Only update if still pending AND not yet past its expiry wall-clock.
    # The expiry guard closes the race window before the scheduler runs.
    row = await pool.fetchrow(
        """
        UPDATE connection_requests
        SET status = $2, responded_at = NOW()
        WHERE connection_id = $1
          AND status = $3
          AND (expires_at IS NULL OR expires_at > NOW())
        RETURNING *
        """,
        connection_id, new_status, ConnectionStatus.PENDING,
    )
    if row is not None:
        return row

    # No row updated: figure out why so the API layer gets the right code.
    existing = await pool.fetchrow(
        "SELECT status, expires_at FROM connection_requests WHERE connection_id = $1",
        connection_id,
    )
    if existing is None:
        raise NotFoundError("connection request not found")

    status = existing["status"]
    expires_at = existing["expires_at"]

    # Already swept to 'expired', OR still 'pending' but past its wall-clock
    # expiry (scheduler just hasn't run yet) -- both are 410 Gone.
    if status == ConnectionStatus.EXPIRED:
        raise GoneError("connection request has expired")
    if status == ConnectionStatus.PENDING and expires_at is not None:
        raise GoneError("connection request has expired")

    # Otherwise it's a genuine bad transition (already accepted/declined).
    raise TransitionError(f"cannot respond to a request in '{status}' state")