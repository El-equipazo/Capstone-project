"""
review_model — data access for the reviews table.

Org->expert and expert->org reviews are symmetric in storage (one `reviews`
row per side, distinguished by reviewer_role) but asymmetric in visibility:
an expert's reviews are public (GET /experts/:id/reviews); an org's are
private to the org itself and admins (GET /organizations/:id/reviews) --
only the org's aggregate avg_rating is ever exposed elsewhere.
"""
from __future__ import annotations

from server.db import connection_pool as pool
from .enums import REVIEWER_ROLE
from .errors import ConflictError, NotFoundError, ValidationError
from .validators import check_enum, check_rating

_ADMIN_UPDATABLE = {"is_public", "is_flagged"}


async def _recompute_expert_avg_rating(expert_profile_id: int) -> None:
    """
    Averages ALL non-flagged organization->expert reviews of this expert,
    public or private -- this is the real reputation signal used elsewhere
    (e.g. a future rating_min directory filter), independent of what a
    visitor happens to see on the public profile.
    """
    await pool.query(
        """
        UPDATE expert_profiles
        SET avg_rating = (
            SELECT ROUND(AVG(r.overall_rating)::numeric, 2)
            FROM reviews r
            JOIN engagements e ON e.engagement_id = r.engagement_id
            WHERE e.expert_id = $1
              AND r.reviewer_role = 'organization'
              AND r.is_flagged = false
        )
        WHERE expert_profile_id = $1
        """,
        expert_profile_id,
    )


async def _recompute_org_avg_rating(org_profile_id: int) -> None:
    """Mirror of _recompute_expert_avg_rating, keyed to the opposite side."""
    await pool.query(
        """
        UPDATE organization_profiles
        SET avg_rating = (
            SELECT ROUND(AVG(r.overall_rating)::numeric, 2)
            FROM reviews r
            JOIN engagements e ON e.engagement_id = r.engagement_id
            WHERE e.org_id = $1
              AND r.reviewer_role = 'expert'
              AND r.is_flagged = false
        )
        WHERE org_profile_id = $1
        """,
        org_profile_id,
    )


async def create(
    engagement_id: int,
    reviewer_id: int,
    reviewee_id: int,
    reviewer_role: str,
    overall_rating: int,
    review_title: str = None,
    review_body: str = None,
    is_public: bool = True,
) -> dict:
    check_enum(reviewer_role, REVIEWER_ROLE, "reviewer_role")
    if overall_rating is None:
        raise ValidationError("overall_rating is required", field="overall_rating", issue="required")
    check_rating(overall_rating, "overall_rating")

    try:
        row = await pool.fetchrow(
            """
            INSERT INTO reviews (
                engagement_id, reviewer_id, reviewee_id, reviewer_role,
                overall_rating, review_title, review_body, is_public
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING *
            """,
            engagement_id, reviewer_id, reviewee_id, reviewer_role,
            overall_rating, review_title, review_body, is_public,
        )
    except Exception as e:
        if getattr(e, "sqlstate", None) == "23505":
            raise ConflictError("You have already submitted a review for this engagement") from e
        raise

    if reviewer_role == "organization":
        expert_id = await pool.fetchval(
            "SELECT expert_id FROM engagements WHERE engagement_id = $1", engagement_id
        )
        await _recompute_expert_avg_rating(expert_id)
    else:
        org_id = await pool.fetchval(
            "SELECT org_id FROM engagements WHERE engagement_id = $1", engagement_id
        )
        await _recompute_org_avg_rating(org_id)

    return dict(row)


async def get_for_engagement(engagement_id: int) -> list:
    rows = await pool.fetch(
        "SELECT * FROM reviews WHERE engagement_id = $1 ORDER BY reviewer_role ASC",
        engagement_id,
    )
    return [dict(r) for r in rows]


async def list_for_expert(
    expert_profile_id: int, *,
    page: int = 1, limit: int = 20,
    q: str = None, min_stars: int = None, sort: str = "top",
) -> tuple[list, int, dict]:
    where = [
        "e.expert_id = $1", "r.reviewer_role = 'organization'",
        "r.is_public = true", "r.is_flagged = false",
    ]
    params = [expert_profile_id]

    if q:
        params.append(f"%{q}%")
        where.append(f"(r.review_title ILIKE ${len(params)} OR r.review_body ILIKE ${len(params)})")
    if min_stars is not None:
        params.append(min_stars)
        where.append(f"r.overall_rating >= ${len(params)}")

    where_sql = " AND ".join(where)
    order_sql = "r.overall_rating DESC, r.created_at DESC" if sort == "top" else "r.created_at DESC"

    total = await pool.fetchval(
        f"""
        SELECT COUNT(*) FROM reviews r
        JOIN engagements e ON e.engagement_id = r.engagement_id
        WHERE {where_sql}
        """,
        *params,
    )
    agg = await pool.fetchrow(
        f"""
        SELECT ROUND(AVG(r.overall_rating)::numeric, 2) AS avg_overall,
               COUNT(*) AS count
        FROM reviews r
        JOIN engagements e ON e.engagement_id = r.engagement_id
        WHERE {where_sql}
        """,
        *params,
    )

    limit_param, offset_param = len(params) + 1, len(params) + 2
    rows = await pool.fetch(
        f"""
        SELECT r.review_id, r.engagement_id, r.reviewer_id, r.reviewee_id, r.reviewer_role,
               r.overall_rating, r.review_title, r.review_body,
               r.is_public, r.created_at,
               op.org_name AS reviewer_org_name
        FROM reviews r
        JOIN engagements e ON e.engagement_id = r.engagement_id
        JOIN organization_profiles op ON op.org_profile_id = e.org_id
        WHERE {where_sql}
        ORDER BY {order_sql}
        LIMIT ${limit_param} OFFSET ${offset_param}
        """,
        *params, limit, (page - 1) * limit,
    )
    return [dict(r) for r in rows], total, dict(agg)


async def list_for_organization(org_profile_id: int) -> list:
    """Owner/admin-only private view -- every expert->org review, no is_public filter."""
    rows = await pool.fetch(
        """
        SELECT r.review_id, r.engagement_id, r.reviewer_id, r.reviewee_id, r.reviewer_role,
               r.overall_rating, r.review_title, r.review_body, r.is_public, r.is_flagged, r.created_at,
               ep.first_name AS reviewer_first_name, ep.last_name AS reviewer_last_name
        FROM reviews r
        JOIN engagements e ON e.engagement_id = r.engagement_id
        JOIN expert_profiles ep ON ep.expert_profile_id = e.expert_id
        WHERE e.org_id = $1 AND r.reviewer_role = 'expert'
        ORDER BY r.created_at DESC
        """,
        org_profile_id,
    )
    return [dict(r) for r in rows]


async def flag(review_id: int, flagged_reason: str) -> dict:
    row = await pool.fetchrow(
        """
        UPDATE reviews SET is_flagged = true, flagged_reason = $2
        WHERE review_id = $1
        RETURNING *
        """,
        review_id, flagged_reason,
    )
    if row is None:
        raise NotFoundError("review not found")
    review = dict(row)
    await _recompute_after_flag_change(review)
    return review


async def _recompute_after_flag_change(review: dict) -> None:
    eng = await pool.fetchrow(
        "SELECT org_id, expert_id FROM engagements WHERE engagement_id = $1", review["engagement_id"]
    )
    if review["reviewer_role"] == "organization":
        await _recompute_expert_avg_rating(eng["expert_id"])
    else:
        await _recompute_org_avg_rating(eng["org_id"])


async def admin_list(is_flagged: bool = None) -> list:
    where, args = "", []
    if is_flagged is not None:
        args.append(is_flagged)
        where = "WHERE r.is_flagged = $1"
    rows = await pool.fetch(
        f"""
        SELECT r.*, ru.email AS reviewer_email, rv.email AS reviewee_email,
               e.engagement_type, e.title AS engagement_title,
               op.org_name, ep.first_name AS expert_first_name, ep.last_name AS expert_last_name
        FROM reviews r
        JOIN users ru ON ru.user_id = r.reviewer_id
        JOIN users rv ON rv.user_id = r.reviewee_id
        JOIN engagements e ON e.engagement_id = r.engagement_id
        JOIN organization_profiles op ON op.org_profile_id = e.org_id
        JOIN expert_profiles ep ON ep.expert_profile_id = e.expert_id
        {where}
        ORDER BY r.created_at DESC
        """,
        *args,
    )
    return [dict(r) for r in rows]


async def admin_update(review_id: int, updates: dict) -> dict:
    set_parts = {k: v for k, v in updates.items() if k in _ADMIN_UPDATABLE}
    if set_parts.get("is_flagged") is False:
        set_parts["flagged_reason"] = None  # clearing a flag also clears the stale reason

    if not set_parts:
        row = await pool.fetchrow("SELECT * FROM reviews WHERE review_id = $1", review_id)
        if row is None:
            raise NotFoundError("review not found")
        return dict(row)

    keys = list(set_parts.keys())
    vals = [set_parts[k] for k in keys]
    clauses = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(keys))
    row = await pool.fetchrow(
        f"UPDATE reviews SET {clauses} WHERE review_id = $1 RETURNING *",
        review_id, *vals,
    )
    if row is None:
        raise NotFoundError("review not found")
    review = dict(row)
    if "is_flagged" in set_parts:
        await _recompute_after_flag_change(review)
    return review
